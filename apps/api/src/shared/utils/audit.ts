import type { TenantPrismaClient } from '@storify/database'

interface AuditParams {
  db: TenantPrismaClient
  actorId: string
  entity: string
  entityId: string
  action: string
  before?: unknown
  after?: unknown
  ip?: string
}

export async function auditLog({
  db,
  actorId,
  entity,
  entityId,
  action,
  before,
  after,
  ip,
}: AuditParams): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId,
      entity,
      entityId,
      action,
      before: before ?? undefined,
      after: after ?? undefined,
      ip: ip ?? null,
    },
  })
}
