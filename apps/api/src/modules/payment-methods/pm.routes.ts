import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import { createPmSchema, updatePmSchema } from './pm.schema'

export async function paymentMethodRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // GET /api/payment-methods
  app.get('/', { preHandler: requirePermission('settings', 'read') }, async (request, reply) => {
    const methods = await request.tenantDb.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ success: true, data: methods })
  })

  // POST /api/payment-methods
  app.post('/', { preHandler: requirePermission('settings', 'update') }, async (request, reply) => {
    const parsed = createPmSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }
    const pm = await request.tenantDb.paymentMethod.create({ data: parsed.data })
    return reply.status(201).send({ success: true, data: pm })
  })

  // PATCH /api/payment-methods/:id
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('settings', 'update') },
    async (request, reply) => {
      const parsed = updatePmSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }
      try {
        const pm = await request.tenantDb.paymentMethod.update({
          where: { id: request.params.id },
          data: parsed.data,
        })
        return reply.send({ success: true, data: pm })
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'طريقة الدفع غير موجودة' } })
      }
    },
  )

  // DELETE /api/payment-methods/:id (soft)
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('settings', 'update') },
    async (request, reply) => {
      try {
        await request.tenantDb.paymentMethod.update({
          where: { id: request.params.id },
          data: { isActive: false },
        })
        return reply.send({ success: true })
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'طريقة الدفع غير موجودة' } })
      }
    },
  )
}
