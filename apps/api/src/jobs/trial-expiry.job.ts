import { Queue, Worker, type Job } from 'bullmq'
import { redis } from '@/config/redis'
import { masterDb } from '@/config/database'
import { sendEmail } from '@/shared/utils/email'

export const TRIAL_EXPIRY_QUEUE = 'trial-expiry'

export function getTrialExpiryQueue() {
  return new Queue(TRIAL_EXPIRY_QUEUE, {
    connection: redis,
    defaultJobOptions: { removeOnComplete: true, removeOnFail: { count: 100 } },
  })
}

export function startTrialExpiryWorker() {
  const worker = new Worker(
    TRIAL_EXPIRY_QUEUE,
    async (_job: Job) => {
      await runTrialExpiry()
    },
    { connection: redis },
  )
  worker.on('error', (err) => console.error('[TrialExpiry] Worker error:', err.message))
  return worker
}

export async function scheduleTrialExpiry() {
  const queue = getTrialExpiryQueue()
  await queue.add('daily-trial-expiry', {}, {
    repeat: { pattern: '0 6 * * *' }, // Every day at 06:00
    jobId: 'trial-expiry-daily',
  })
}

async function runTrialExpiry() {
  const now = new Date()

  const expiredTrials = await masterDb.subscription.findMany({
    where: { status: 'TRIALING', trialEndsAt: { lte: now } },
    include: { tenant: true },
  })

  for (const sub of expiredTrials) {
    await masterDb.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAST_DUE', failedAttempts: 1 },
    })

    // Invalidate the cached subscription status so enforcement middleware picks up the change
    await redis.del(`sub:status:${sub.tenantId}`)

    if (sub.tenant) {
      await sendEmail({
        to: sub.tenant.ownerEmail,
        template: 'trial_expired',
        data: { tenantName: sub.tenant.name },
      }).catch(() => {})
    }

    console.info(`[TrialExpiry] Expired trial → PAST_DUE for tenant ${sub.tenantId}`)
  }

  if (expiredTrials.length > 0) {
    console.info(`[TrialExpiry] Processed ${expiredTrials.length} expired trial(s)`)
  }
}
