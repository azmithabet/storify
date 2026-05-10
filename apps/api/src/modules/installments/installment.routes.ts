import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import {
  createInstallmentSchema,
  recordPaymentSchema,
  listInstallmentsSchema,
} from './installment.schema'
import {
  listContracts,
  getContract,
  createContract,
  approveContract,
  rejectContract,
  recordPayment,
} from './installment.service'

export async function installmentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // ─── GET /api/installments ───────────────────────────────────────────────────
  app.get('/', { preHandler: requirePermission('installments', 'read') }, async (request, reply) => {
    const parsed = listInstallmentsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }
    const result = await listContracts(request.tenantDb, parsed.data)
    return reply.send({ success: true, data: result.items, meta: result.meta })
  })

  // ─── POST /api/installments ──────────────────────────────────────────────────
  app.post('/', { preHandler: requirePermission('installments', 'create') }, async (request, reply) => {
    const parsed = createInstallmentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }

    const actor = request.user as JWTPayload

    try {
      const result = await createContract(request.tenantDb, parsed.data, actor.userId)
      return reply.status(201).send({ success: true, data: result })
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number }
      if (error.statusCode === 400) {
        return reply.status(400).send({ success: false, error: { code: error.message, message: error.message } })
      }
      throw err
    }
  })

  // ─── GET /api/installments/:id ───────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('installments', 'read') },
    async (request, reply) => {
      try {
        const contract = await getContract(request.tenantDb, request.params.id)
        return reply.send({ success: true, data: contract })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'العقد غير موجود' } })
        }
        throw err
      }
    },
  )

  // ─── PATCH /api/installments/:id/approve ────────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id/approve',
    { preHandler: requirePermission('installments', 'approve') },
    async (request, reply) => {
      const actor = request.user as JWTPayload

      try {
        const contract = await approveContract(request.tenantDb, request.params.id, actor.userId)
        return reply.send({ success: true, data: contract })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'العقد غير موجود' } })
        }
        if (error.message === 'contract_not_pending') {
          return reply.status(400).send({ success: false, error: { code: 'contract_not_pending', message: 'العقد ليس في حالة انتظار الموافقة' } })
        }
        if (error.message?.startsWith('insufficient_stock:')) {
          const variantId = error.message.split(':')[1]
          return reply.status(400).send({ success: false, error: { code: 'insufficient_stock', message: 'المخزون غير كافٍ', variantId } })
        }
        throw err
      }
    },
  )

  // ─── PATCH /api/installments/:id/reject ─────────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id/reject',
    { preHandler: requirePermission('installments', 'approve') },
    async (request, reply) => {
      const actor = request.user as JWTPayload

      try {
        await rejectContract(request.tenantDb, request.params.id, actor.userId)
        return reply.send({ success: true })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'العقد غير موجود' } })
        }
        if (error.message === 'contract_not_pending') {
          return reply.status(400).send({ success: false, error: { code: 'contract_not_pending', message: 'العقد ليس في حالة انتظار الموافقة' } })
        }
        throw err
      }
    },
  )

  // ─── POST /api/installments/:id/payments/:paymentId ─────────────────────────
  app.post<{ Params: { id: string; paymentId: string } }>(
    '/:id/payments/:paymentId',
    { preHandler: requirePermission('installments', 'update') },
    async (request, reply) => {
      const parsed = recordPaymentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const actor = request.user as JWTPayload

      try {
        const payment = await recordPayment(
          request.tenantDb,
          request.params.id,
          request.params.paymentId,
          parsed.data,
          actor.userId,
        )
        return reply.send({ success: true, data: payment })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الدفعة غير موجودة' } })
        }
        if (error.message === 'already_paid') {
          return reply.status(400).send({ success: false, error: { code: 'already_paid', message: 'هذه الدفعة مسددة بالفعل' } })
        }
        throw err
      }
    },
  )
}
