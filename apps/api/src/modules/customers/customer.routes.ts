import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import { getUploadUrl } from '../../config/r2'
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersSchema,
  documentUploadSchema,
} from './customer.schema'

export async function customerRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // GET /api/customers
  app.get('/', { preHandler: requirePermission('customers', 'read') }, async (request, reply) => {
    const parsed = listCustomersSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }

    const { page, limit, search } = parsed.data
    const where = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
            { nationalId: { contains: search } },
          ],
        }
      : {}

    const [total, items] = await Promise.all([
      request.tenantDb.customer.count({ where }),
      request.tenantDb.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return reply.send({
      success: true,
      data: items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  })

  // POST /api/customers
  app.post('/', { preHandler: requirePermission('customers', 'create') }, async (request, reply) => {
    const parsed = createCustomerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }
    const customer = await request.tenantDb.customer.create({ data: parsed.data })
    return reply.status(201).send({ success: true, data: customer })
  })

  // GET /api/customers/:id
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('customers', 'read') },
    async (request, reply) => {
      const customer = await request.tenantDb.customer.findUnique({
        where: { id: request.params.id },
        include: {
          documents: true,
          _count: { select: { invoices: true } },
        },
      })
      if (!customer) {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'العميل غير موجود' } })
      }
      return reply.send({ success: true, data: customer })
    },
  )

  // PATCH /api/customers/:id
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('customers', 'update') },
    async (request, reply) => {
      const parsed = updateCustomerSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }
      try {
        const customer = await request.tenantDb.customer.update({
          where: { id: request.params.id },
          data: parsed.data,
        })
        return reply.send({ success: true, data: customer })
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'العميل غير موجود' } })
      }
    },
  )

  // POST /api/customers/:id/credit
  app.post<{ Params: { id: string } }>(
    '/:id/credit',
    { preHandler: requirePermission('customers', 'update') },
    async (request, reply) => {
      const { z } = await import('zod')
      const schema = z.object({
        amount: z.number().positive(),
        type: z.enum(['add', 'deduct']),
        note: z.string().optional(),
      })
      const parsed = schema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }

      const customer = await request.tenantDb.customer.findUnique({ where: { id: request.params.id } })
      if (!customer) {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'العميل غير موجود' } })
      }

      const delta = parsed.data.type === 'add' ? parsed.data.amount : -parsed.data.amount
      const newBalance = Number(customer.creditBalance) + delta
      if (newBalance < 0) {
        return reply.status(400).send({ success: false, error: { code: 'insufficient_credit', message: 'الرصيد غير كافٍ' } })
      }

      const actor = request.user as JWTPayload
      const updated = await request.tenantDb.customer.update({
        where: { id: request.params.id },
        data: { creditBalance: newBalance },
      })

      const { auditLog } = await import('../../shared/utils/audit')
      await auditLog({
        db: request.tenantDb,
        actorId: actor.userId,
        entity: 'customer',
        entityId: customer.id,
        action: parsed.data.type === 'add' ? 'credit_add' : 'credit_deduct',
        before: { creditBalance: customer.creditBalance.toString() },
        after: { creditBalance: newBalance.toString(), note: parsed.data.note },
        ip: request.ip,
      })

      return reply.send({ success: true, data: updated })
    },
  )

  // POST /api/customers/:id/documents — get presigned URL, then caller stores the returned publicUrl
  app.post<{ Params: { id: string } }>(
    '/:id/documents',
    { preHandler: requirePermission('customers', 'update') },
    async (request, reply) => {
      const parsed = documentUploadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const customer = await request.tenantDb.customer.findUnique({
        where: { id: request.params.id },
      })
      if (!customer) {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'العميل غير موجود' } })
      }

      const actor = request.user as JWTPayload
      const ext = parsed.data.contentType.split('/')[1]
      const key = `customers/${request.params.id}/${randomUUID()}.${ext}`

      try {
        const { uploadUrl, publicUrl } = await getUploadUrl(key, parsed.data.contentType)

        // Record the document row immediately so the DB is the source of truth.
        // Client must PUT to uploadUrl; if they don't, the row has a broken link.
        const doc = await request.tenantDb.customerDocument.create({
          data: {
            customerId: request.params.id,
            docType: parsed.data.docType,
            fileUrl: publicUrl,
            uploadedById: actor.userId,
          },
        })

        return reply.status(201).send({ success: true, data: { document: doc, uploadUrl } })
      } catch {
        return reply.status(503).send({
          success: false,
          error: { code: 'storage_unavailable', message: 'R2 storage not configured' },
        })
      }
    },
  )
}
