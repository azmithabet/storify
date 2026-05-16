/**
 * Daily reminder emails for customers with upcoming or overdue installment
 * payments. Mirrors the dunning.job pattern: BullMQ queue + repeatable
 * schedule + worker that calls a pure cycle function.
 *
 * Idempotency lives at the per-payment level via an `entity:'installment_payment',
 * action:'reminder_sent'` audit-log entry — so a manual trigger followed by the
 * scheduled run within 24h doesn't double-email customers.
 */
import { Queue, Worker, type Job } from 'bullmq'
import { redis } from '@/config/redis'
import { masterDb, getTenantDb } from '@/config/database'
import { sendInstallmentReminderEmail } from '@/shared/utils/email'

export const REMINDERS_QUEUE = 'installment-reminders'

/** Window for "due soon" — covers today, tomorrow, and the day after. */
const UPCOMING_DAYS = 3
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function getReminderQueue() {
  return new Queue(REMINDERS_QUEUE, {
    connection: redis,
    defaultJobOptions: { removeOnComplete: true, removeOnFail: { count: 50 } },
  })
}

export function startReminderWorker() {
  const worker = new Worker(
    REMINDERS_QUEUE,
    async (_job: Job) => {
      const summary = await runReminderCycle()
      console.info(`[Reminders] cycle complete:`, summary)
    },
    { connection: redis },
  )
  worker.on('error', (err) => console.error('[Reminders] Worker error:', err.message))
  return worker
}

/** Register the repeatable. Called once at startup. */
export async function scheduleReminders() {
  const queue = getReminderQueue()
  await queue.add('daily-reminders', {}, {
    repeat: { pattern: '0 9 * * *' }, // every day at 09:00
    jobId: 'installment-reminders-daily',
  })
}

export interface ReminderCycleSummary {
  tenants: number
  sent: number
  skippedNoEmail: number
  skippedRecentlyReminded: number
  errors: number
}

/**
 * Walk every active tenant, find pending installment payments due in the next
 * {@link UPCOMING_DAYS} days OR already overdue, and email the customer.
 *
 * Exported so a manual-trigger endpoint can reuse it.
 */
export async function runReminderCycle(): Promise<ReminderCycleSummary> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today.getTime() + UPCOMING_DAYS * ONE_DAY_MS)
  const last24h = new Date(Date.now() - ONE_DAY_MS)

  const summary: ReminderCycleSummary = {
    tenants: 0,
    sent: 0,
    skippedNoEmail: 0,
    skippedRecentlyReminded: 0,
    errors: 0,
  }

  const tenants = await masterDb.tenant.findMany({
    where: { status: { in: ['ACTIVE'] } },
    select: { id: true, name: true, schemaName: true },
  })

  for (const t of tenants) {
    summary.tenants++
    const db = getTenantDb(t.schemaName)
    try {
      // Pending payments either overdue or due in the next N days, on an
      // active contract. Status 'overdue' is also picked up — some flows
      // promote pending → overdue without resetting back.
      const payments = await db.installmentPayment.findMany({
        where: {
          status: { in: ['pending', 'overdue'] },
          dueDate: { lt: horizon },
          contract: { status: { in: ['active', 'overdue'] } },
        },
        include: {
          contract: {
            include: {
              customer: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      })

      for (const p of payments) {
        const email = p.contract.customer.email
        if (!email) {
          summary.skippedNoEmail++
          continue
        }

        // Skip if we've already reminded this payment in the last 24h. Cheap
        // index lookup on (entity, entityId, createdAt).
        const recent = await db.auditLog.findFirst({
          where: {
            entity: 'installment_payment',
            entityId: p.id,
            action: 'reminder_sent',
            createdAt: { gte: last24h },
          },
          select: { id: true },
        })
        if (recent) {
          summary.skippedRecentlyReminded++
          continue
        }

        const isOverdue = p.dueDate.getTime() < today.getTime()

        try {
          await sendInstallmentReminderEmail({
            to: email,
            customerName: p.contract.customer.fullName,
            installmentNumber: p.installmentNumber,
            amount: p.amountPaid.toString(),
            dueDate: p.dueDate.toISOString().slice(0, 10),
            isOverdue,
            storeName: t.name,
          })
          await db.auditLog.create({
            data: {
              actorId: null, // system-issued reminder
              entity: 'installment_payment',
              entityId: p.id,
              action: 'reminder_sent',
              after: { to: email, isOverdue, dueDate: p.dueDate.toISOString().slice(0, 10) },
            },
          })
          summary.sent++
        } catch (err) {
          summary.errors++
          console.error(`[Reminders] tenant=${t.schemaName} payment=${p.id} send failed:`, err)
        }
      }
    } catch (err) {
      summary.errors++
      console.error(`[Reminders] tenant=${t.schemaName} cycle failed:`, err)
    } finally {
      // getTenantDb returns a cached client — do NOT $disconnect or the next
      // request will get a closed connection.
    }
  }

  return summary
}
