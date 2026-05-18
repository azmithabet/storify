import { Queue, Worker, type Job } from 'bullmq'
import { redis } from '@/config/redis'
import { masterDb } from '@/config/database'
import { sendEmail } from '@/shared/utils/email'
import { withLock } from '@/shared/utils/lock'
import { config } from '@/config/env'
import { sweepScheduledCancellations } from '@/modules/billing/billing.service'

export const TRIAL_EXPIRY_QUEUE = 'trial-expiry'

/**
 * Pre-expiry reminder schedule (days before trialEndsAt):
 *   index 0 → first reminder when ≤ 3 days remain
 *   index 1 → second reminder when ≤ 1 day remains
 *
 * trialRemindersSent on the subscription is a monotonic counter — we only
 * send reminder N if the counter is still < N+1, which makes the job
 * idempotent across daily runs and crash-restarts.
 */
const REMINDER_DAYS = [3, 1]

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
      const result = await withLock('trial-expiry-cycle', 10 * 60_000, () => runTrialExpiry())
      if (result === null) console.info('[TrialExpiry] another instance holds the lock — skipping')
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

/** Per-tenant checkout URL the user can click from the email. */
function checkoutUrlFor(subdomain: string): string {
  const base = config.APP_BASE_DOMAIN
    ? `https://${subdomain}.${config.APP_BASE_DOMAIN}`
    : config.FRONTEND_URL
  return `${base}/billing/checkout`
}

async function runTrialExpiry() {
  const now = new Date()

  // ─── 1. Pre-expiry reminders ──────────────────────────────────────────────
  // Find every trial whose end is in the future but within the longest reminder
  // window, then pick the right reminder by remaining-days math. Doing this in
  // SQL would require either a fragile generated column or per-day separate
  // queries — in-process filtering on a small set is fine.
  const upcomingTrials = await masterDb.subscription.findMany({
    where: {
      status: 'TRIALING',
      trialEndsAt: { gt: now },
    },
    include: { tenant: true },
  })

  for (const sub of upcomingTrials) {
    if (!sub.trialEndsAt || !sub.tenant) continue
    const daysRemaining = Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / (24 * 3600 * 1000))

    // Find the highest-priority reminder that's both due (days ≤ threshold)
    // and not yet sent (counter < reminderIndex + 1).
    let reminderToSend: number | null = null
    for (let i = 0; i < REMINDER_DAYS.length; i++) {
      if (daysRemaining <= REMINDER_DAYS[i] && sub.trialRemindersSent < i + 1) {
        reminderToSend = i
      }
    }
    if (reminderToSend === null) continue

    try {
      await sendEmail({
        to: sub.tenant.ownerEmail,
        template: 'trial_ending_soon',
        data: {
          tenantName: sub.tenant.name,
          daysRemaining: String(daysRemaining),
          checkoutUrl: checkoutUrlFor(sub.tenant.subdomain),
        },
      })
    } catch (err) {
      console.error(`[TrialExpiry] reminder send failed for ${sub.tenantId}:`, err)
      // Don't bump the counter — let the next run try again.
      continue
    }

    // Bump the counter to (reminderIndex + 1) so we don't re-send. Using an
    // explicit value (not increment) is safe even if the worker double-runs:
    // setting to 2 twice is still 2.
    await masterDb.subscription.update({
      where: { id: sub.id },
      data: { trialRemindersSent: reminderToSend + 1 },
    })
    console.info(`[TrialExpiry] T-${daysRemaining}d reminder sent for tenant ${sub.tenantId}`)
  }

  // ─── 2. Hard expiry ───────────────────────────────────────────────────────
  const expiredTrials = await masterDb.subscription.findMany({
    where: { status: 'TRIALING', trialEndsAt: { lte: now } },
    include: { tenant: true },
  })

  for (const sub of expiredTrials) {
    await masterDb.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'PAST_DUE',
        failedAttempts: 1,
        // Anchor dunning's retry math from now, not from the (possibly never-
        // set) lastPaymentAt. Without this, dunning's 3/7/14-day cadence would
        // be undefined for trial-converted PAST_DUE subs.
        lastFailedAt: now,
        lastFailureReason: 'trial_expired_no_payment',
      },
    })

    // Invalidate the cached subscription status so enforcement middleware picks up the change
    await redis.del(`sub:status:${sub.tenantId}`)

    if (sub.tenant) {
      await sendEmail({
        to: sub.tenant.ownerEmail,
        template: 'trial_expired',
        data: {
          tenantName: sub.tenant.name,
          checkoutUrl: checkoutUrlFor(sub.tenant.subdomain),
        },
      }).catch(() => {})
    }

    console.info(`[TrialExpiry] Expired trial → PAST_DUE for tenant ${sub.tenantId}`)
  }

  if (expiredTrials.length > 0) {
    console.info(`[TrialExpiry] Processed ${expiredTrials.length} expired trial(s)`)
  }

  // ─── 3. Cancel-at-period-end sweep ────────────────────────────────────────
  // Run on the same daily cron — both are once-per-day lifecycle transitions
  // and share the same lock window, so there's no benefit to a separate job.
  try {
    const cancelled = await sweepScheduledCancellations()
    if (cancelled > 0) {
      console.info(`[TrialExpiry] Swept ${cancelled} scheduled cancellation(s)`)
    }
  } catch (err) {
    // Don't let cancellation failures abort the trial-expiry results — log
    // and continue; the next daily run will retry.
    console.error('[TrialExpiry] scheduled cancellation sweep failed:', err)
  }
}
