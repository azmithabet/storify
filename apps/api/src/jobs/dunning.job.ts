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

  // Find all subscriptions with failed_attempts > 0 that haven't been retried recently
  const subs = await masterDb.subscription.findMany({
    where: {
      status: { in: ['PAST_DUE', 'ACTIVE', 'TRIALING'] },
      failedAttempts: { gt: 0 },
      providerCardToken: { not: null },
    },
    include: { plan: true, tenant: true },
  })

  let transientFailures = 0
  for (const sub of subs) {
    const daysSinceLastPayment = sub.lastPaymentAt
      ? Math.floor((now.getTime() - sub.lastPaymentAt.getTime()) / (24 * 3600 * 1000))
      : 999

    const retryDue = RETRY_INTERVALS_DAYS.some((d) => daysSinceLastPayment >= d)
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
