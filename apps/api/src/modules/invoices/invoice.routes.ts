import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import {
  createInvoiceSchema,
  listInvoicesSchema,
  returnInvoiceSchema,
} from './invoice.schema'
import { listInvoices, getInvoice, createInvoice, returnInvoice, cancelInvoice } from './invoice.service'

export async function invoiceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // ─── GET /api/invoices ───────────────────────────────────────────────────────
  app.get('/', { preHandler: requirePermission('invoices', 'read') }, async (request, reply) => {
    const parsed = listInvoicesSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }
    const result = await listInvoices(request.tenantDb, parsed.data)
    return reply.send({ success: true, data: result.items, meta: result.meta })
  })

  // ─── POST /api/invoices ──────────────────────────────────────────────────────
  app.post('/', { preHandler: requirePermission('invoices', 'create') }, async (request, reply) => {
    const parsed = createInvoiceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }

    const actor = request.user as JWTPayload

    // Resolve defaults for optional fields
    let { branchId, currencyId } = parsed.data
    if (!branchId) branchId = actor.branchId
    if (!currencyId) {
      const baseCurrency = await request.tenantDb.currency.findFirst({ where: { isBase: true } })
      if (!baseCurrency) {
        return reply.status(400).send({ success: false, error: { code: 'no_base_currency', message: 'لا توجد عملة أساسية' } })
      }
      currencyId = baseCurrency.id
    }

    try {
      const invoice = await createInvoice(request.tenantDb, { ...parsed.data, branchId: branchId!, currencyId: currencyId! }, actor.userId)
      return reply.status(201).send({ success: true, data: invoice })
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number }
      if (error.statusCode === 400) {
        const code = error.message
        const messages: Record<string, string> = {
          payment_method_not_found: 'طريقة الدفع غير موجودة أو غير نشطة',
          currency_not_found: 'العملة غير موجودة',
          coupon_invalid: 'الكوبون غير صالح',
          coupon_expired: 'الكوبون منتهي الصلاحية',
          coupon_exhausted: 'تم استنفاد حد استخدام الكوبون',
        }
        const insufficientStock = code.startsWith('insufficient_stock:')
        const variantNotFound = code.startsWith('variant_not_found:')

        if (insufficientStock) {
          const variantId = code.split(':')[1]
          return reply.status(400).send({
            success: false,
            error: { code: 'insufficient_stock', message: 'المخزون غير كافٍ', variantId },
          })
        }
        if (variantNotFound) {
          return reply.status(400).send({
            success: false,
            error: { code: 'variant_not_found', message: 'المنتج غير موجود' },
          })
        }

        return reply.status(400).send({
          success: false,
          error: { code, message: messages[code] ?? code },
        })
      }
      app.log.error(err)
      return reply.status(500).send({ success: false, error: { code: 'internal_error', message: 'خطأ داخلي' } })
    }
  })

  // ─── GET /api/invoices/:id ───────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('invoices', 'read') },
    async (request, reply) => {
      try {
        const invoice = await getInvoice(request.tenantDb, request.params.id)
        return reply.send({ success: true, data: invoice })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الفاتورة غير موجودة' } })
        }
        throw err
      }
    },
  )

  // ─── POST /api/invoices/:id/return ───────────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/return',
    { preHandler: requirePermission('invoices', 'update') },
    async (request, reply) => {
      const parsed = returnInvoiceSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const actor = request.user as JWTPayload

      try {
        const returnRecord = await returnInvoice(
          request.tenantDb,
          request.params.id,
          parsed.data,
          actor.userId,
        )
        return reply.status(201).send({ success: true, data: returnRecord })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الفاتورة غير موجودة' } })
        }
        if (error.statusCode === 400) {
          return reply.status(400).send({ success: false, error: { code: error.message, message: error.message } })
        }
        throw err
      }
    },
  )

  // ─── POST /api/invoices/:id/cancel ───────────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/cancel',
    { preHandler: requirePermission('invoices', 'update') },
    async (request, reply) => {
      const actor = request.user as JWTPayload
      try {
        const invoice = await cancelInvoice(request.tenantDb, request.params.id, actor.userId)
        return reply.send({ success: true, data: invoice })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الفاتورة غير موجودة' } })
        }
        if (error.message === 'already_cancelled') {
          return reply.status(409).send({ success: false, error: { code: 'already_cancelled', message: 'الفاتورة ملغاة بالفعل' } })
        }
        if (error.message === 'invoice_returned') {
          return reply.status(409).send({ success: false, error: { code: 'invoice_returned', message: 'لا يمكن إلغاء فاتورة مرتجعة — استخدم تدفق الإرجاع' } })
        }
        throw err
      }
    },
  )

  // ─── GET /api/returns — list all returns ─────────────────────────────────────
  app.get('/returns', { preHandler: requirePermission('invoices', 'read') }, async (request, reply) => {
    const { z } = await import('zod')
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      returnType: z.enum(['refund', 'credit']).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).safeParse(request.query)

    if (!q.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: q.error.errors[0].message } })
    const { page, limit, returnType, from, to } = q.data

    const where = {
      ...(returnType ? { returnType } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } } : {}),
    }

    const [returns, total] = await Promise.all([
      request.tenantDb.return.findMany({
        where,
        include: {
          invoice: { select: { invoiceNumber: true, customer: { select: { fullName: true } } } },
          processedBy: { select: { fullName: true } },
          items: { include: { variant: { select: { sku: true, product: { select: { name: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      request.tenantDb.return.count({ where }),
    ])

    return reply.send({ success: true, data: returns, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
  })
}
