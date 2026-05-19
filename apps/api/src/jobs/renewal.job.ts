import { Queue, Worker, type Job } from 'bullmq'
import { redis } from '@/config/redis'
import { masterDb } from '@/config/database'
import { PaymobClient } from '@/modules/billing/paymob.client'
import { handleWebhookSuccess, handleWebhookFailure } from '@/modules/billing/billing.service'
import { withLock } from '@/shared/utils/lock'
import Decimal from 'decimal.js'

export const RENEWAL_QUEUE = 'renewal'

const paymob = new PaymobClient()

export function getRenewalQueue() {
  return new Queue(RENEWAL_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: { count: 100 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
    },
  })
}

export function startRenewalWorker() {
  const worker = new Worker(
    RENEWAL_QUEUE,
    async (_job: Job) => {
      // 25 min lock — shorter than the 24h scheduled interval, comfortably
      // longer than any realistic per-cycle work.
      const result = await withLock('renewal-cycle', 25 * 60_000, () => runRenewalCycle())
      if (result === null) console.info('[Renewal] another instance holds the lock — skipping')
    },
    { connection: redis },
  )

  worker.on('error', (err) => console.error('[Renewal] Worker error:', err.message))
  return worker
}

/**
 * Schedules the renewal job as a daily BullMQ repeatable. Slotted between
 * trial-expiry (06:00) and dunning (08:00):
 *
 *   06:00 — trial-expiry: TRIALING whose trialEndsAt passed → PAST_DUE
 *   07:00 — renewal:      ACTIVE whose currentPeriodEnd passed → charge again
 *   08:00 — dunning:      PAST_DUE/ACTIVE with failedAttempts > 0 → retry
 *
 * Order matters: trial expiry first so newly-expired trials don't get a
 * renewal charge attempted on a token they don't have; renewal before
 * dunning so a fresh failure today gets its first retry tomorrow (not
 * immediately in the same cycle).
 */
export async function scheduleRenewal() {
  const queue = getRenewalQueue()
  await queue.add('daily-renewal', {}, {
    repeat: { pattern: '0 7 * * *' }, // Every day at 07:00
    jobId: 'renewal-daily',
  })
}

async function runRenewalCycle() {
  const now = new Date()

  // Subscriptions due for a fresh charge:
  //   • ACTIVE — TRIALING expirations are owned by trial-expiry, not us
  //   • currentPeriodEnd ≤ now — the paid period has ended
  //   • providerCardToken set — we have a card to charge without a fresh
  //     iframe session (no token → interactive checkout is the only path)
  //   • cancelAtPeriodEnd = false — scheduled cancellations get swept by
  //     sweepScheduledCancellations in the trial-expiry job; charging them
  //     would defeat the customer's cancellation request
  //   • failedAttempts = 0 — once a renewal fails, dunning takes over and
  //     runs the 3/7/14 day retry schedule. Re-attempting here every day
  //     would either bypass that cadence or double-bill on rare overlaps.
  const due = await masterDb.subscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: { lte: now },
      providerCardToken: { not: null },
      cancelAtPeriodEnd: false,
      failedAttempts: 0,
    },
    include: { plan: true, tenant: true },
  })

  let processed = 0
  let succeeded = 0
  let failed = 0
  let transientFailures = 0

  for (const sub of due) {
    try {
      const amountCents = new Decimal(sub.priceAtSubscription.toString())
        .times(100)
        .toDecimalPlaces(0)
        .toNumber()

      // Same format used at initial checkout and by dunning — the webhook
      // / charge handler splits on `_` to extract the tenant id.
      const merchantOrderId = `sub_${sub.tenantId}_${Date.now()}`

      const order = await paymob.createOrder({
        amountCents,
        merchantOrderId,
      })

      const charge = await paymob.chargeWithToken({
        amountCents,
        orderId: order.id,
        cardToken: sub.providerCardToken!,
        merchantOrderId,
        // Paymob's token-charge endpoint still requires billing_data even
        // though it's not used for authentication — mirror what dunning
        // sends so behavior is consistent across both flows.
        billingData: {
          first_name: sub.tenant.name,
          last_name: '',
          email: sub.tenant.ownerEmail,
          phone_number: '',
          country: 'EG',
          city: 'Cairo',
          state: 'Cairo',
          street: 'N/A',
          building: 'N/A',
          floor: 'N/A',
          apartment: 'N/A',
        },
      })

      processed += 1
      if (charge.success) {
        // Reuses the same DB writes as the iframe webhook path: extends
        // current_period_end by the billing cycle, sets lastPaymentAt /
        // nextBillingAt, resets failure counters, records a PaymentAttempt.
        // Sends the payment_succeeded email too.
        await handleWebhookSuccess({
          orderId: charge.order.id,
          transactionId: charge.id,
          amountCents,
          cardToken: charge.token,
          merchantOrderId,
        })
        succeeded += 1
      } else {
        // Records the failed attempt and increments failedAttempts. The
        // first failure here sets failedAttempts=1 (no status change yet) so
        // dunning will pick it up on its 08:00 cycle — and from there on
        // the 3/7/14 day cadence kicks in and eventually flips PAST_DUE →
        // SUSPENDED → CANCELLED if the card never recovers.
        await handleWebhookFailure({
          transactionId: charge.id,
          amountCents,
          errorMessage: 'Renewal charge declined',
          merchantOrderId,
        })
        failed += 1
      }
    } catch (err) {
      // Per-subscription error (network, Paymob API outage, etc.) shouldn't
      // abort the whole cycle — count it and let BullMQ retry the job.
      transientFailures += 1
      console.error(`[Renewal] Failed to charge subscription ${sub.id}:`, err)
    }
  }

  console.info(
    `[Renewal] cycle complete: due=${due.length} processed=${processed} ` +
      `succeeded=${succeeded} failed=${failed} transient=${transientFailures}`,
  )

  if (transientFailures > 0) {
    throw new Error(`renewal_cycle_partial_failure:${transientFailures}`)
  }
}
