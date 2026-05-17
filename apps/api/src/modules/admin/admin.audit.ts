import { masterDb } from '../../config/database'

export async function platformAudit(input: {
  actorId: string
  entity: string
  entityId?: string | null
  action: string
  before?: unknown
  after?: unknown
  ip?: string | null
}): Promise<void> {
  try {
    await masterDb.platformAuditLog.create({
      data: {
        actorId: input.actorId,
        entity: input.entity,
        entityId: input.entityId ?? null,
        action: input.action,
        before: input.before === undefined ? undefined : (input.before as object),
        after: input.after === undefined ? undefined : (input.after as object),
        ip: input.ip ?? null,
      },
    })
  } catch (err) {
    // Audit failure must not break the user-visible action.
    console.error('[platformAudit] failed', err)
  }
}
