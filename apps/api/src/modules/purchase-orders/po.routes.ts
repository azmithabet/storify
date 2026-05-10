import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import { auditLog } from '../../shared/utils/audit'
import { toDecimal } from '../../shared/utils/decimal'
import { createPoSchema, receivePoSchema, poPaymentSchema, listPoSchema } from './po.schema'

export async function purchaseOrderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // ─── GET /api/purchase-orders ────────────────────────────────────────────────
  app.get('/', { preHandler: requirePermission('purchase_orders', 'read') }, async (request, reply) => {
    const parsed = listPoSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const { page, limit, status, supplierId, branchId } = parsed.data
    const where = {
      ...(status ? { status } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(branchId ? { branchId } : {}),
    }

    const [total, items] = await Promise.all([
      request.tenantDb.purchaseOrder.count({ where }),
      request.tenantDb.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return reply.send({ success: true, data: items, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
  })

  // ─── POST /api/purchase-orders ───────────────────────────────────────────────
  app.post('/', { preHandler: requirePermission('purchase_orders', 'create') }, async (request, reply) => {
    const parsed = createPoSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const actor = request.user as JWTPayload
    const { supplierId, branchId, items, expectedDate, paymentType } = parsed.data

    const totalAmount = items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0)

    const po = await request.tenantDb.purchaseOrder.create({
      data: {
        supplierId,
        branchId,
        createdById: actor.userId,
        status: 'draft',
        totalAmount,
        paidAmount: 0,
        paymentType: paymentType ?? null,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        items: {
          create: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitCost: i.unitCost,
            subtotal: i.unitCost * i.quantity,
          })),
        },
      },
      include: { items: true },
    })

    await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'purchase_order', entityId: po.id, action: 'create', after: { totalAmount }, ip: request.ip })
    return reply.status(201).send({ success: true, data: po })
  })

  // ─── GET /api/purchase-orders/:id ────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('purchase_orders', 'read') },
    async (request, reply) => {
      const po = await request.tenantDb.purchaseOrder.findUnique({
        where: { id: request.params.id },
        include: {
          supplier: true,
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
          items: { include: { variant: { include: { product: { select: { id: true, name: true } } } } } },
          receipts: true,
          payments: { include: { paidBy: { select: { id: true, fullName: true } } } },
        },
      })
      if (!po) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'أمر الشراء غير موجود' } })
      return reply.send({ success: true, data: po })
    },
  )

  // ─── PATCH /api/purchase-orders/:id/submit (draft → pending) ─────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id/submit',
    { preHandler: requirePermission('purchase_orders', 'update') },
    async (request, reply) => {
      const actor = request.user as JWTPayload
      const po = await request.tenantDb.purchaseOrder.findUnique({ where: { id: request.params.id } })
      if (!po) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'أمر الشراء غير موجود' } })
      if (po.status !== 'draft') return reply.status(400).send({ success: false, error: { code: 'invalid_status', message: 'أمر الشراء ليس في مرحلة المسودة' } })

      const updated = await request.tenantDb.purchaseOrder.update({ where: { id: request.params.id }, data: { status: 'pending' } })
      await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'purchase_order', entityId: po.id, action: 'submit', after: { status: 'pending' }, ip: request.ip })
      return reply.send({ success: true, data: updated })
    },
  )

  // ─── PATCH /api/purchase-orders/:id/approve (pending → approved) ──────────────
  app.patch<{ Params: { id: string } }>(
    '/:id/approve',
    { preHandler: requirePermission('purchase_orders', 'approve') },
    async (request, reply) => {
      const actor = request.user as JWTPayload
      const po = await request.tenantDb.purchaseOrder.findUnique({ where: { id: request.params.id } })
      if (!po) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'أمر الشراء غير موجود' } })
      if (po.status !== 'pending') return reply.status(400).send({ success: false, error: { code: 'invalid_status', message: 'أمر الشراء ليس في مرحلة الانتظار' } })

      const updated = await request.tenantDb.purchaseOrder.update({
        where: { id: request.params.id },
        data: { status: 'approved', approvedById: actor.userId },
      })
      await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'purchase_order', entityId: po.id, action: 'approve', after: { status: 'approved' }, ip: request.ip })
      return reply.send({ success: true, data: updated })
    },
  )

  // ─── POST /api/purchase-orders/:id/receive ────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/receive',
    { preHandler: requirePermission('purchase_orders', 'receive') },
    async (request, reply) => {
      const parsed = receivePoSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }

      const actor = request.user as JWTPayload

      const po = await request.tenantDb.purchaseOrder.findUnique({
        where: { id: request.params.id },
        include: { items: true },
      })
      if (!po) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'أمر الشراء غير موجود' } })
      if (po.status !== 'approved') return reply.status(400).send({ success: false, error: { code: 'invalid_status', message: 'أمر الشراء يجب أن يكون معتمداً أولاً' } })

      const receivedDate = parsed.data.receivedDate ? new Date(parsed.data.receivedDate) : new Date()

      await request.tenantDb.$transaction(async (tx) => {
        // Increment stock for each item
        for (const item of po.items) {
          await tx.stock.upsert({
            where: { uq_stock_variant_branch: { variantId: item.variantId, branchId: po.branchId } },
            create: { variantId: item.variantId, branchId: po.branchId, quantity: item.quantity, minQuantity: 0, updatedAt: new Date() },
            update: { quantity: { increment: item.quantity }, updatedAt: new Date() },
          })

          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              branchId: po.branchId,
              userId: actor.userId,
              type: 'in',
              quantity: item.quantity,
              reference: po.id,
            },
          })
        }

        // Create receipt
        await tx.purchaseReceipt.create({
          data: {
            orderId: po.id,
            receivedById: actor.userId,
            receivedDate,
            notes: parsed.data.notes ?? null,
            invoiceImageUrl: parsed.data.invoiceImageUrl ?? null,
          },
        })

        // Record supplier liability (we now owe them)
        await tx.supplierTransaction.create({
          data: {
            supplierId: po.supplierId,
            branchId: po.branchId,
            userId: actor.userId,
            type: 'purchase',
            amount: po.totalAmount,
            reference: po.id,
          },
        })
        await tx.supplier.update({
          where: { id: po.supplierId },
          data: { balance: { increment: toDecimal(po.totalAmount).toNumber() } },
        })

        // Update PO status
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: 'received' },
        })

        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            entity: 'purchase_order',
            entityId: po.id,
            action: 'receive',
            after: { status: 'received', itemCount: po.items.length },
          },
        })
      })

      return reply.send({ success: true })
    },
  )

  // ─── POST /api/purchase-orders/:id/payments ───────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/payments',
    { preHandler: requirePermission('purchase_orders', 'update') },
    async (request, reply) => {
      const parsed = poPaymentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }

      const actor = request.user as JWTPayload

      const po = await request.tenantDb.purchaseOrder.findUnique({ where: { id: request.params.id } })
      if (!po) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'أمر الشراء غير موجود' } })

      const remaining = toDecimal(po.totalAmount).minus(toDecimal(po.paidAmount)).toNumber()
      if (parsed.data.amount > remaining + 0.0001) {
        return reply.status(400).send({ success: false, error: { code: 'overpayment', message: 'المبلغ يتجاوز المبلغ المستحق' } })
      }

      await request.tenantDb.$transaction([
        request.tenantDb.purchasePayment.create({
          data: {
            orderId: po.id,
            supplierId: po.supplierId,
            paidById: actor.userId,
            amount: parsed.data.amount,
            paymentMethod: parsed.data.paymentMethod ?? null,
            receiptUrl: parsed.data.receiptUrl ?? null,
          },
        }),
        request.tenantDb.purchaseOrder.update({
          where: { id: po.id },
          data: { paidAmount: { increment: parsed.data.amount } },
        }),
        request.tenantDb.supplierTransaction.create({
          data: {
            supplierId: po.supplierId,
            branchId: po.branchId,
            userId: actor.userId,
            type: 'payment',
            amount: parsed.data.amount,
            reference: po.id,
          },
        }),
        request.tenantDb.supplier.update({
          where: { id: po.supplierId },
          data: { balance: { decrement: parsed.data.amount } },
        }),
      ])

      await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'purchase_order', entityId: po.id, action: 'payment', after: { amount: parsed.data.amount }, ip: request.ip })
      return reply.status(201).send({ success: true })
    },
  )
}
