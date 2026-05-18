import { Queue, Worker, type Job } from 'bullmq'
import { redis } from '@/config/redis'
import { masterDb } from '@/config/database'
import { PaymobClient } from '@/modules/billing/paymob.client'
import { handleWebhookSuccess, handleWebhookFailure } from '@/modules/billing/billing.service'
import { withLock } from '@/shared/utils/lock'
import Decimal from 'decimal.js'

export const DUNNING_QUEUE = 'dunning'

const paymob = new PaymobClient()

export function getDunningQueue() {
  return new Queue(DUNNING_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: { count: 100 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
    },
  })
}

// Retry intervals: day 3, day 7, day 14
const RETRY_INTERVALS_DAYS = [3, 7, 14]

export function startDunningWorker() {
  const worker = new Worker(
    DUNNING_QUEUE,
    async (_job: Job) => {
      // 25 minutes — comfortably longer than any realistic cycle, shorter
      // than the 24h scheduled interval.
      const result = await withLock('dunning-cycle', 25 * 60_000, () => runDunningCycle())
      if (result === null) console.info('[Dunning] another instance holds the lock — skipping')
    },
    { connection: redis },
  )

  worker.on('error', (err) => console.error('[Dunning] Worker error:', err.message))
  return worker
}

/**
 * Schedules the dunning job as a daily BullMQ repeatable.
 * Called once at startup.
 */
export async function scheduleDunning() {
  const queue = getDunningQueue()
  await queue.add('daily-dunning', {}, {
    repeat: { pattern: '0 8 * * *' }, // Every day at 08:00
    jobId: 'dunning-daily',
  })
}

async function runDunningCycle() {
  const now = new Date()

  // Only retry subscriptions that have:
  //   • a card on file (no card → no point retrying — trial-expired tenants
  //     fall into this category and need an interactive checkout)
  //   • at least one failed attempt recorded
  // TRIALING is excluded because trial subs don't have a charge to retry until
  // they actually convert; trial-expiry.job handles them separately.
  const subs = await masterDb.subscription.findMany({
    where: {
      status: { in: ['PAST_DUE', 'ACTIVE'] },
      failedAttempts: { gt: 0 },
      providerCardToken: { not: null },
    },
    include: { plan: true, tenant: true },
  })

  let transientFailures = 0
  for (const sub of subs) {
    // Anchor retries to the *failure* timestamp, not the last successful
    // payment. lastPaymentAt can be months stale on a long-lived ACTIVE sub
    // whose renewal just failed — using it would say "999 days since payment,
    // retry overdue" every single day and either DDoS Paymob or never line up
    // with the intended 3/7/14 cadence.
    //
    // Fallback chain: lastFailedAt (set by handleWebhookFailure and by trial
    // expiry) → updatedAt (set on every state change) → never retry.
    const anchor = sub.lastFailedAt ?? sub.updatedAt
    if (!anchor) continue

    const daysSinceFailure = Math.floor((now.getTime() - anchor.getTime()) / (24 * 3600 * 1000))

    // Pick the largest interval ≤ daysSinceFailure — i.e. the most recent
    // retry milestone the sub has passed. The 24h job cadence means we'll
    // attempt at most one retry per day per sub even if multiple milestones
    // are eligible.
    const retryDue = RETRY_INTERVALS_DAYS.some((d) => daysSinceFailure >= d)
    if (!retryDue) continue

    try {
      const amountCents = new Decimal(sub.priceAtSubscription.toString())
        .times(100)
        .toDecimalPlaces(0)
        .toNumber()

      const retryMerchantOrderId = `sub_${sub.tenantId}_${Date.now()}`

      const order = await paymob.createOrder({
        amountCents,
        merchantOrderId: retryMerchantOrderId,
      })

      const charge = await paymob.chargeWithToken({
        amountCents,
        orderId: order.id,
        cardToken: sub.providerCardToken!,
        merchantOrderId: retryMerchantOrderId,
        billingData: {
          first_name: sub.tenant.name,
          last_name: '',
          email: '',
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

      if (charge.success) {
        await handleWebhookSuccess({
          orderId: charge.order.id,
          transactionId: charge.id,
          amountCents,
          cardToken: charge.token,
          merchantOrderId: retryMerchantOrderId,
        })
      } else {
        await handleWebhookFailure({
          transactionId: charge.id,
          amountCents,
          errorMessage: 'Dunning retry declined',
          merchantOrderId: retryMerchantOrderId,
        })
      }
    } catch (err) {
      // Per-subscription failures shouldn't abort the whole cycle (we still
      // want to retry other tenants), but we count them so the job can
      // re-throw once the loop ends, letting BullMQ retry the cycle.
      transientFailures += 1
      console.error(`[Dunning] Failed to retry subscription ${sub.id}:`, err)
    }
  }

  if (transientFailures > 0) {
    throw new Error(`dunning_cycle_partial_failure:${transientFailures}`)
  }
}

// Reconciliation: catch missed webhooks by comparing Paymob transactions against DB
export async function reconcilePayments() {
  // Fetch last 7 days of transactions from Paymob and verify against payment_attempts.
  // Implementation requires Paymob transactions list endpoint (documented in their API).
  // This is a placeholder — full reconciliation needs Paymob merchant API access.
  console.info('[Reconciliation] Paymob reconciliation run (implement with merchant API access)')
}
