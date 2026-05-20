import type { FastifyInstance } from 'fastify'
import { Prisma } from '@storify/database'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import { requireFeature } from '../../shared/middleware/feature.middleware'
import { auditLog } from '../../shared/utils/audit'
import {
  createWorkOrderSchema,
  updateWorkOrderSchema,
  transitionStatusSchema,
  addServiceSchema,
  recordPaymentSchema,
  listWorkOrdersSchema,
  parseItemDetails,
  ALLOWED_TRANSITIONS,
  type ItemType,
  type WorkOrderStatus,
} from './workOrder.schema'

// Ticket number: WO-YYYYMMDD-{last6 of UUID}. UUID-derived so no race
// conditions; matches the invoice_number convention (see invoice.service.ts).
function makeTicketNumber(id: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = id.replace(/-/g, '').slice(-6).toUpperCase()
  return `WO-${datePart}-${suffix}`
}

function recomputeFinalTotal(
  lines: Array<{ quantity: number; unitPrice: Prisma.Decimal | number }>,
): Prisma.Decimal {
  return lines.reduce((acc, l) => {
    const lineTotal = new Prisma.Decimal(l.unitPrice).mul(l.quantity)
    return acc.add(lineTotal)
  }, new Prisma.Decimal(0))
}

export async function workOrderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('preHandler', requireFeature('services'))

  // ─── GET /api/work-orders ─────────────────────────────────────────────────
  app.get('/', { preHandler: requirePermission('work_orders', 'read') }, async (request, reply) => {
    const parsed = listWorkOrdersSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const { page, limit, status, branchId, customerId, assignedUserId, search } = parsed.data
    const where = {
      ...(status ? { status } : {}),
      ...(branchId ? { branchId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(assignedUserId ? { assignedUserId } : {}),
      ...(search ? { ticketNumber: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    const [total, items] = await Promise.all([
      request.tenantDb.workOrder.count({ where }),
      request.tenantDb.workOrder.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          customer: { select: { id: true, fullName: true, phone: true } },
          assignedUser: { select: { id: true, fullName: true } },
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { services: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return reply.send({ success: true, data: items, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
  })

  // ─── POST /api/work-orders ────────────────────────────────────────────────
  app.post('/', { preHandler: requirePermission('work_orders', 'create') }, async (request, reply) => {
    const parsed = createWorkOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const actor = request.user as JWTPayload

    // Validate itemDetails shape against itemType — fail fast before we open a tx.
    let validatedDetails: Record<string, unknown>
    try {
      validatedDetails = parseItemDetails(parsed.data.itemType as ItemType, parsed.data.itemDetails)
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: { code: 'invalid_item_details', message: `بيانات العنصر غير صالحة: ${(err as Error).message}` },
      })
    }

    // If services are attached at create time, snapshot their prices from the catalog
    // when the caller didn't override unitPrice. We do this before the tx so a missing
    // service id 404s cleanly instead of rolling back.
    const serviceIds = parsed.data.services.map((s) => s.serviceId)
    const catalog = serviceIds.length
      ? await request.tenantDb.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, defaultPrice: true, isActive: true },
        })
      : []
    const catalogMap = new Map(catalog.map((s) => [s.id, s]))
    for (const line of parsed.data.services) {
      const cat = catalogMap.get(line.serviceId)
      if (!cat) {
        return reply.status(404).send({
          success: false,
          error: { code: 'service_not_found', message: `الخدمة ${line.serviceId} غير موجودة` },
        })
      }
    }

    const resolvedLines = parsed.data.services.map((line) => ({
      serviceId: line.serviceId,
      quantity: line.quantity,
      unitPrice: line.unitPrice ?? Number(catalogMap.get(line.serviceId)!.defaultPrice),
      notes: line.notes ?? null,
    }))

    const initialEstimate = parsed.data.estimatedTotal ?? Number(recomputeFinalTotal(resolvedLines))

    const created = await request.tenantDb.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          ticketNumber: 'TEMP', // overwritten below once we have the UUID
          branchId: parsed.data.branchId,
          customerId: parsed.data.customerId ?? null,
          assignedUserId: parsed.data.assignedUserId ?? null,
          createdById: actor.userId,
          itemType: parsed.data.itemType,
          itemDetails: validatedDetails as Prisma.InputJsonValue,
          scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
          deposit: parsed.data.deposit,
          estimatedTotal: initialEstimate,
          diagnosisNotes: parsed.data.diagnosisNotes ?? null,
          customerNotes: parsed.data.customerNotes ?? null,
          status: parsed.data.itemType === 'appointment' && parsed.data.scheduledAt ? 'scheduled' : 'received',
          services: { create: resolvedLines },
          statusHistory: {
            create: {
              oldStatus: null,
              newStatus: parsed.data.itemType === 'appointment' && parsed.data.scheduledAt ? 'scheduled' : 'received',
              changedById: actor.userId,
              note: 'تم إنشاء الطلب',
            },
          },
        },
        include: {
          services: { include: { service: { select: { id: true, name: true } } } },
        },
      })

      const ticketNumber = makeTicketNumber(wo.id)
      const final = await tx.workOrder.update({
        where: { id: wo.id },
        data: { ticketNumber },
        include: {
          branch: { select: { id: true, name: true } },
          customer: { select: { id: true, fullName: true, phone: true } },
          assignedUser: { select: { id: true, fullName: true } },
          createdBy: { select: { id: true, fullName: true } },
          services: { include: { service: { select: { id: true, name: true } } } },
        },
      })
      return final
    })

    await auditLog({
      db: request.tenantDb,
      actorId: actor.userId,
      entity: 'work_order',
      entityId: created.id,
      action: 'create',
      after: { ticketNumber: created.ticketNumber, itemType: created.itemType, status: created.status },
      ip: request.ip,
    })
    return reply.status(201).send({ success: true, data: created })
  })

  // ─── GET /api/work-orders/:id ─────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('work_orders', 'read') },
    async (request, reply) => {
      const wo = await request.tenantDb.workOrder.findUnique({
        where: { id: request.params.id },
        include: {
          branch: { select: { id: true, name: true } },
          customer: { select: { id: true, fullName: true, phone: true, email: true } },
          assignedUser: { select: { id: true, fullName: true } },
          createdBy: { select: { id: true, fullName: true } },
          paymentMethod: { select: { id: true, name: true } },
          services: { include: { service: { select: { id: true, name: true, defaultPrice: true } } } },
          statusHistory: {
            include: { changedBy: { select: { id: true, fullName: true } } },
            orderBy: { changedAt: 'desc' },
          },
        },
      })
      if (!wo) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الطلب غير موجود' } })
      return reply.send({ success: true, data: wo })
    },
  )

  // ─── PATCH /api/work-orders/:id (general fields) ──────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('work_orders', 'update') },
    async (request, reply) => {
      const parsed = updateWorkOrderSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }
      const existing = await request.tenantDb.workOrder.findUnique({ where: { id: request.params.id } })
      if (!existing) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الطلب غير موجود' } })

      // Re-validate itemDetails shape against the existing itemType when caller updates the JSON.
      let validatedDetails: Record<string, unknown> | undefined
      if (parsed.data.itemDetails !== undefined) {
        try {
          validatedDetails = parseItemDetails(existing.itemType as ItemType, parsed.data.itemDetails)
        } catch (err) {
          return reply.status(400).send({
            success: false,
            error: { code: 'invalid_item_details', message: `بيانات العنصر غير صالحة: ${(err as Error).message}` },
          })
        }
      }

      const actor = request.user as JWTPayload
      const updated = await request.tenantDb.workOrder.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.customerId !== undefined ? { customerId: parsed.data.customerId } : {}),
          ...(parsed.data.assignedUserId !== undefined ? { assignedUserId: parsed.data.assignedUserId } : {}),
          ...(validatedDetails !== undefined ? { itemDetails: validatedDetails as Prisma.InputJsonValue } : {}),
          ...(parsed.data.scheduledAt !== undefined
            ? { scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null }
            : {}),
          ...(parsed.data.deposit !== undefined ? { deposit: parsed.data.deposit } : {}),
          ...(parsed.data.estimatedTotal !== undefined ? { estimatedTotal: parsed.data.estimatedTotal } : {}),
          ...(parsed.data.finalTotal !== undefined ? { finalTotal: parsed.data.finalTotal } : {}),
          ...(parsed.data.diagnosisNotes !== undefined ? { diagnosisNotes: parsed.data.diagnosisNotes } : {}),
          ...(parsed.data.workNotes !== undefined ? { workNotes: parsed.data.workNotes } : {}),
          ...(parsed.data.customerNotes !== undefined ? { customerNotes: parsed.data.customerNotes } : {}),
        },
      })
      await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'work_order', entityId: updated.id, action: 'update', ip: request.ip })
      return reply.send({ success: true, data: updated })
    },
  )

  // ─── PATCH /api/work-orders/:id/status ────────────────────────────────────
  // Enforces the state machine in workOrder.schema.ts. Each transition writes
  // a row to work_order_status_history for audit + customer-facing timeline.
  app.patch<{ Params: { id: string } }>(
    '/:id/status',
    { preHandler: requirePermission('work_orders', 'update') },
    async (request, reply) => {
      const parsed = transitionStatusSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }
      const existing = await request.tenantDb.workOrder.findUnique({ where: { id: request.params.id } })
      if (!existing) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الطلب غير موجود' } })

      const allowed = ALLOWED_TRANSITIONS[existing.status as WorkOrderStatus] ?? []
      if (!allowed.includes(parsed.data.status)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'invalid_transition',
            message: `لا يمكن الانتقال من «${existing.status}» إلى «${parsed.data.status}»`,
            allowed,
          },
        })
      }

      const actor = request.user as JWTPayload
      const updated = await request.tenantDb.$transaction(async (tx) => {
        const wo = await tx.workOrder.update({
          where: { id: existing.id },
          data: {
            status: parsed.data.status,
            ...(parsed.data.status === 'delivered' ? { closedAt: new Date() } : {}),
            ...(parsed.data.status === 'cancelled' ? { closedAt: new Date() } : {}),
          },
        })
        await tx.workOrderStatusHistory.create({
          data: {
            workOrderId: wo.id,
            oldStatus: existing.status,
            newStatus: parsed.data.status,
            changedById: actor.userId,
            note: parsed.data.note ?? null,
          },
        })
        return wo
      })

      await auditLog({
        db: request.tenantDb,
        actorId: actor.userId,
        entity: 'work_order',
        entityId: updated.id,
        action: 'transition',
        before: { status: existing.status },
        after: { status: updated.status, note: parsed.data.note },
        ip: request.ip,
      })
      return reply.send({ success: true, data: updated })
    },
  )

  // ─── POST /api/work-orders/:id/services ───────────────────────────────────
  // Add a service line to an existing work order. Recomputes estimatedTotal.
  app.post<{ Params: { id: string } }>(
    '/:id/services',
    { preHandler: requirePermission('work_orders', 'update') },
    async (request, reply) => {
      const parsed = addServiceSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }
      const wo = await request.tenantDb.workOrder.findUnique({
        where: { id: request.params.id },
        include: { services: true },
      })
      if (!wo) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الطلب غير موجود' } })

      const service = await request.tenantDb.service.findUnique({ where: { id: parsed.data.serviceId } })
      if (!service) return reply.status(404).send({ success: false, error: { code: 'service_not_found', message: 'الخدمة غير موجودة' } })

      const unitPrice = parsed.data.unitPrice ?? Number(service.defaultPrice)
      const actor = request.user as JWTPayload

      await request.tenantDb.$transaction(async (tx) => {
        await tx.workOrderService.create({
          data: {
            workOrderId: wo.id,
            serviceId: service.id,
            quantity: parsed.data.quantity,
            unitPrice,
            notes: parsed.data.notes ?? null,
          },
        })
        // Recompute estimatedTotal from the new line set.
        const lines = [...wo.services, { quantity: parsed.data.quantity, unitPrice }]
        const newEstimate = recomputeFinalTotal(lines)
        await tx.workOrder.update({ where: { id: wo.id }, data: { estimatedTotal: newEstimate } })
      })

      await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'work_order', entityId: wo.id, action: 'add_service', after: { serviceId: service.id, unitPrice }, ip: request.ip })
      return reply.status(201).send({ success: true })
    },
  )

  app.delete<{ Params: { id: string; lineId: string } }>(
    '/:id/services/:lineId',
    { preHandler: requirePermission('work_orders', 'update') },
    async (request, reply) => {
      const wo = await request.tenantDb.workOrder.findUnique({
        where: { id: request.params.id },
        include: { services: true },
      })
      if (!wo) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الطلب غير موجود' } })
      const line = wo.services.find((l) => l.id === request.params.lineId)
      if (!line) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'البند غير موجود' } })

      await request.tenantDb.$transaction(async (tx) => {
        await tx.workOrderService.delete({ where: { id: line.id } })
        const remaining = wo.services.filter((l) => l.id !== line.id)
        const newEstimate = recomputeFinalTotal(remaining)
        await tx.workOrder.update({ where: { id: wo.id }, data: { estimatedTotal: newEstimate } })
      })

      return reply.send({ success: true })
    },
  )

  // ─── POST /api/work-orders/:id/payment ────────────────────────────────────
  // Record payment against the work order. Doesn't change status — the cashier
  // then transitions to 'delivered' explicitly. Allows partial payments.
  app.post<{ Params: { id: string } }>(
    '/:id/payment',
    { preHandler: requirePermission('work_orders', 'update') },
    async (request, reply) => {
      const parsed = recordPaymentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }
      const wo = await request.tenantDb.workOrder.findUnique({ where: { id: request.params.id } })
      if (!wo) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الطلب غير موجود' } })

      const pm = await request.tenantDb.paymentMethod.findUnique({ where: { id: parsed.data.paymentMethodId } })
      if (!pm) return reply.status(404).send({ success: false, error: { code: 'payment_method_not_found', message: 'وسيلة الدفع غير موجودة' } })

      const actor = request.user as JWTPayload
      const newPaid = new Prisma.Decimal(wo.paidAmount).add(parsed.data.amount)
      const updated = await request.tenantDb.workOrder.update({
        where: { id: wo.id },
        data: {
          paymentMethodId: pm.id,
          paidAmount: newPaid,
          paidAt: new Date(),
          // finalTotal locks in on first payment if not already set — matches the
          // typical flow where the cashier confirms the amount at checkout.
          ...(wo.finalTotal == null ? { finalTotal: newPaid } : {}),
        },
      })

      await auditLog({
        db: request.tenantDb,
        actorId: actor.userId,
        entity: 'work_order',
        entityId: wo.id,
        action: 'payment',
        after: { paymentMethodId: pm.id, amount: parsed.data.amount, paidAmount: updated.paidAmount.toString() },
        ip: request.ip,
      })
      return reply.send({ success: true, data: updated })
    },
  )
}
