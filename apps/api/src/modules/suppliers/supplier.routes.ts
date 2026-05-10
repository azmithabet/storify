import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import { auditLog } from '../../shared/utils/audit'
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersSchema,
  createTransactionSchema,
} from './supplier.schema'

// balance delta per transaction type
const BALANCE_DELTA: Record<string, 1 | -1> = {
  purchase: 1,   // we owe them more
  payment: -1,   // we owe them less
  return: -1,    // credit reduces liability
}

export async function supplierRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // ─── GET /api/suppliers ──────────────────────────────────────────────────────
  app.get('/', { preHandler: requirePermission('suppliers', 'read') }, async (request, reply) => {
    const parsed = listSuppliersSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const { page, limit, search, isActive } = parsed.data
    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
    }

    const [total, items] = await Promise.all([
      request.tenantDb.supplier.count({ where }),
      request.tenantDb.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return reply.send({ success: true, data: items, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
  })

  // ─── POST /api/suppliers ─────────────────────────────────────────────────────
  app.post('/', { preHandler: requirePermission('suppliers', 'create') }, async (request, reply) => {
    const parsed = createSupplierSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const actor = request.user as JWTPayload
    const supplier = await request.tenantDb.supplier.create({ data: parsed.data })
    await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'supplier', entityId: supplier.id, action: 'create', after: { name: supplier.name }, ip: request.ip })
    return reply.status(201).send({ success: true, data: supplier })
  })

  // ─── GET /api/suppliers/:id ──────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('suppliers', 'read') },
    async (request, reply) => {
      const supplier = await request.tenantDb.supplier.findUnique({
        where: { id: request.params.id },
        include: { _count: { select: { purchaseOrders: true, transactions: true } } },
      })
      if (!supplier) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المورد غير موجود' } })
      return reply.send({ success: true, data: supplier })
    },
  )

  // ─── PATCH /api/suppliers/:id ────────────────────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('suppliers', 'update') },
    async (request, reply) => {
      const parsed = updateSupplierSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }
      try {
        const actor = request.user as JWTPayload
        const supplier = await request.tenantDb.supplier.update({ where: { id: request.params.id }, data: parsed.data })
        await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'supplier', entityId: supplier.id, action: 'update', ip: request.ip })
        return reply.send({ success: true, data: supplier })
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المورد غير موجود' } })
      }
    },
  )

  // ─── DELETE /api/suppliers/:id (soft) ────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('suppliers', 'delete') },
    async (request, reply) => {
      try {
        await request.tenantDb.supplier.update({ where: { id: request.params.id }, data: { isActive: false } })
        return reply.send({ success: true })
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المورد غير موجود' } })
      }
    },
  )

  // ─── GET /api/suppliers/:id/transactions ─────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/transactions',
    { preHandler: requirePermission('suppliers', 'read') },
    async (request, reply) => {
      const page = Number((request.query as Record<string, string>).page) || 1
      const limit = Number((request.query as Record<string, string>).limit) || 20

      const [total, items] = await Promise.all([
        request.tenantDb.supplierTransaction.count({ where: { supplierId: request.params.id } }),
        request.tenantDb.supplierTransaction.findMany({
          where: { supplierId: request.params.id },
          include: { user: { select: { id: true, fullName: true } }, branch: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ])

      return reply.send({ success: true, data: items, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
    },
  )

  // ─── POST /api/suppliers/:id/transactions ────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/transactions',
    { preHandler: requirePermission('suppliers', 'update') },
    async (request, reply) => {
      const parsed = createTransactionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }

      const actor = request.user as JWTPayload
      const delta = BALANCE_DELTA[parsed.data.type]

      const supplier = await request.tenantDb.supplier.findUnique({ where: { id: request.params.id } })
      if (!supplier) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المورد غير موجود' } })

      await request.tenantDb.$transaction([
        request.tenantDb.supplierTransaction.create({
          data: {
            supplierId: request.params.id,
            branchId: parsed.data.branchId,
            userId: actor.userId,
            type: parsed.data.type,
            amount: parsed.data.amount,
            reference: parsed.data.reference ?? null,
            note: parsed.data.note ?? null,
          },
        }),
        request.tenantDb.supplier.update({
          where: { id: request.params.id },
          data: { balance: { [delta > 0 ? 'increment' : 'decrement']: parsed.data.amount } },
        }),
      ])

      return reply.status(201).send({ success: true })
    },
  )
}
