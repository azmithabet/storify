import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import { auditLog } from '../../shared/utils/audit'
import {
  listStockSchema,
  adjustStockSchema,
  setMinQuantitySchema,
  listMovementsSchema,
  createTransferSchema,
  approveTransferSchema,
} from './stock.schema'
import {
  listStock,
  adjustStock,
  setMinQuantity,
  listMovements,
  createTransfer,
  approveTransfer,
  getTransfer,
  listTransfers,
} from './stock.service'

export async function stockRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // ─── GET /api/stock ─────────────────────────────────────────────────────────
  app.get(
    '/',
    { preHandler: requirePermission('stock', 'read') },
    async (request, reply) => {
      const parsed = listStockSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const result = await listStock(request.tenantDb, parsed.data)
      return reply.send({ success: true, data: result.items, meta: result.meta })
    },
  )

  // ─── POST /api/stock/adjust ──────────────────────────────────────────────────
  app.post(
    '/adjust',
    { preHandler: requirePermission('stock', 'adjust') },
    async (request, reply) => {
      const parsed = adjustStockSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const actor = request.user as JWTPayload

      try {
        const result = await adjustStock(request.tenantDb, parsed.data, actor.userId)

        await auditLog({
          db: request.tenantDb,
          actorId: actor.userId,
          entity: 'stock',
          entityId: parsed.data.variantId,
          action: 'manual_adjustment',
          after: { quantity: result.quantity, reason: parsed.data.reason },
          ip: request.ip,
        })

        return reply.send({ success: true, data: result })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'سجل المخزون غير موجود' } })
        }
        if (error.message === 'insufficient_stock') {
          return reply.status(400).send({ success: false, error: { code: 'insufficient_stock', message: 'الكمية الحالية لا تكفي' } })
        }
        throw err
      }
    },
  )

  // ─── PATCH /api/stock/min-quantity ───────────────────────────────────────────
  app.patch(
    '/min-quantity',
    { preHandler: requirePermission('stock', 'adjust') },
    async (request, reply) => {
      const bodyParsed = setMinQuantitySchema.safeParse(request.body)
      const qsParsed = adjustStockSchema
        .pick({ variantId: true, branchId: true })
        .safeParse(request.query)

      if (!bodyParsed.success || !qsParsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: 'variantId, branchId, minQuantity required' },
        })
      }

      const { variantId, branchId } = qsParsed.data
      const { minQuantity } = bodyParsed.data

      try {
        const stock = await setMinQuantity(request.tenantDb, variantId, branchId, minQuantity)
        return reply.send({ success: true, data: stock })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'سجل المخزون غير موجود' } })
        }
        throw err
      }
    },
  )

  // ─── GET /api/stock/movements ────────────────────────────────────────────────
  app.get(
    '/movements',
    { preHandler: requirePermission('stock', 'read') },
    async (request, reply) => {
      const parsed = listMovementsSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const result = await listMovements(request.tenantDb, parsed.data)
      return reply.send({ success: true, data: result.items, meta: result.meta })
    },
  )

  // ─── GET /api/stock/transfers ────────────────────────────────────────────────
  app.get(
    '/transfers',
    { preHandler: requirePermission('stock', 'read') },
    async (request, reply) => {
      const page = Number((request.query as Record<string, string>).page) || 1
      const limit = Number((request.query as Record<string, string>).limit) || 20
      const status = (request.query as Record<string, string>).status

      const result = await listTransfers(request.tenantDb, { status, page, limit })
      return reply.send({ success: true, data: result.items, meta: result.meta })
    },
  )

  // ─── POST /api/stock/transfers ───────────────────────────────────────────────
  app.post(
    '/transfers',
    { preHandler: requirePermission('stock', 'transfer') },
    async (request, reply) => {
      const parsed = createTransferSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const actor = request.user as JWTPayload

      try {
        const transfer = await createTransfer(request.tenantDb, parsed.data, actor.userId)

        await auditLog({
          db: request.tenantDb,
          actorId: actor.userId,
          entity: 'stock_transfer',
          entityId: transfer.id,
          action: 'create',
          after: { fromBranchId: transfer.fromBranchId, toBranchId: transfer.toBranchId, itemCount: transfer.items.length },
          ip: request.ip,
        })

        return reply.status(201).send({ success: true, data: transfer })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'same_branch_transfer') {
          return reply.status(400).send({ success: false, error: { code: 'same_branch_transfer', message: 'لا يمكن التحويل للفرع نفسه' } })
        }
        throw err
      }
    },
  )

  // ─── GET /api/stock/transfers/:id ───────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/transfers/:id',
    { preHandler: requirePermission('stock', 'read') },
    async (request, reply) => {
      try {
        const transfer = await getTransfer(request.tenantDb, request.params.id)
        return reply.send({ success: true, data: transfer })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'طلب التحويل غير موجود' } })
        }
        throw err
      }
    },
  )

  // ─── PATCH /api/stock/transfers/:id/approve ──────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/transfers/:id/approve',
    { preHandler: requirePermission('stock', 'transfer') },
    async (request, reply) => {
      const parsed = approveTransferSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const actor = request.user as JWTPayload

      try {
        const transfer = await approveTransfer(
          request.tenantDb,
          request.params.id,
          actor.userId,
          parsed.data.action,
        )

        await auditLog({
          db: request.tenantDb,
          actorId: actor.userId,
          entity: 'stock_transfer',
          entityId: request.params.id,
          action: parsed.data.action === 'approve' ? 'transfer_approved' : 'transfer_rejected',
          ip: request.ip,
        })

        return reply.send({ success: true, data: transfer })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'طلب التحويل غير موجود' } })
        }
        if (error.message === 'transfer_not_pending') {
          return reply.status(400).send({ success: false, error: { code: 'transfer_not_pending', message: 'الطلب ليس في حالة انتظار' } })
        }
        if (error.message?.startsWith('insufficient_stock')) {
          return reply.status(400).send({ success: false, error: { code: 'insufficient_stock', message: 'المخزون غير كافٍ لإتمام التحويل' } })
        }
        throw err
      }
    },
  )
}
