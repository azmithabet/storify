import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import { auditLog } from '../../shared/utils/audit'
import { createExpenseSchema, updateExpenseSchema, listExpensesSchema } from './expense.schema'

export async function expenseRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // ─── GET /api/expenses/categories ────────────────────────────────────────────
  app.get('/categories', { preHandler: requirePermission('expenses', 'read') }, async (request, reply) => {
    const categories = await request.tenantDb.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    })
    return reply.send({ success: true, data: categories })
  })

  // ─── POST /api/expenses/categories ───────────────────────────────────────────
  app.post('/categories', { preHandler: requirePermission('expenses', 'create') }, async (request, reply) => {
    const { z } = await import('zod')
    const schema = z.object({ name: z.string().min(1), description: z.string().optional() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    const category = await request.tenantDb.expenseCategory.create({ data: { name: parsed.data.name, description: parsed.data.description } })
    return reply.status(201).send({ success: true, data: category })
  })

  // ─── PATCH /api/expenses/categories/:id ──────────────────────────────────────
  app.patch<{ Params: { id: string } }>('/categories/:id', { preHandler: requirePermission('expenses', 'update') }, async (request, reply) => {
    const { z } = await import('zod')
    const schema = z.object({ name: z.string().min(1).optional(), isActive: z.boolean().optional() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    const category = await request.tenantDb.expenseCategory.update({ where: { id: request.params.id }, data: parsed.data })
    return reply.send({ success: true, data: category })
  })

  // ─── GET /api/expenses ────────────────────────────────────────────────────────
  app.get('/', { preHandler: requirePermission('expenses', 'read') }, async (request, reply) => {
    const parsed = listExpensesSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const { page, limit, branchId, categoryId, status, from, to } = parsed.data
    const where = {
      ...(branchId ? { branchId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
      ...(from || to ? { expenseDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    }

    const [total, items] = await Promise.all([
      request.tenantDb.expense.count({ where }),
      request.tenantDb.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true } },
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { expenseDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return reply.send({ success: true, data: items, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
  })

  // ─── POST /api/expenses ───────────────────────────────────────────────────────
  app.post('/', { preHandler: requirePermission('expenses', 'create') }, async (request, reply) => {
    const parsed = createExpenseSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const actor = request.user as JWTPayload
    const expense = await request.tenantDb.expense.create({
      data: {
        branchId: parsed.data.branchId,
        categoryId: parsed.data.categoryId,
        createdById: actor.userId,
        description: parsed.data.description,
        amount: parsed.data.amount,
        paymentMethod: parsed.data.paymentMethod ?? null,
        receiptUrl: parsed.data.receiptUrl ?? null,
        expenseDate: new Date(parsed.data.expenseDate),
        status: 'pending',
      },
    })

    await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'expense', entityId: expense.id, action: 'create', after: { amount: parsed.data.amount }, ip: request.ip })
    return reply.status(201).send({ success: true, data: expense })
  })

  // ─── GET /api/expenses/:id ────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('expenses', 'read') },
    async (request, reply) => {
      const expense = await request.tenantDb.expense.findUnique({
        where: { id: request.params.id },
        include: {
          category: true,
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
        },
      })
      if (!expense) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المصروف غير موجود' } })
      return reply.send({ success: true, data: expense })
    },
  )

  // ─── PATCH /api/expenses/:id ──────────────────────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('expenses', 'update') },
    async (request, reply) => {
      const parsed = updateExpenseSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }

      const expense = await request.tenantDb.expense.findUnique({ where: { id: request.params.id } })
      if (!expense) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المصروف غير موجود' } })
      if (expense.status !== 'pending') return reply.status(400).send({ success: false, error: { code: 'not_editable', message: 'لا يمكن تعديل مصروف تم اعتماده أو رفضه' } })

      const actor = request.user as JWTPayload
      const updated = await request.tenantDb.expense.update({
        where: { id: request.params.id },
        data: {
          ...parsed.data,
          ...(parsed.data.expenseDate ? { expenseDate: new Date(parsed.data.expenseDate) } : {}),
        },
      })
      await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'expense', entityId: expense.id, action: 'update', ip: request.ip })
      return reply.send({ success: true, data: updated })
    },
  )

  // ─── PATCH /api/expenses/:id/approve ─────────────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id/approve',
    { preHandler: requirePermission('expenses', 'approve') },
    async (request, reply) => {
      const expense = await request.tenantDb.expense.findUnique({ where: { id: request.params.id } })
      if (!expense) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المصروف غير موجود' } })
      if (expense.status !== 'pending') return reply.status(400).send({ success: false, error: { code: 'invalid_status', message: 'المصروف ليس في انتظار الاعتماد' } })

      const actor = request.user as JWTPayload
      const updated = await request.tenantDb.expense.update({
        where: { id: request.params.id },
        data: { status: 'approved', approvedById: actor.userId },
      })
      await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'expense', entityId: expense.id, action: 'approve', after: { status: 'approved' }, ip: request.ip })
      return reply.send({ success: true, data: updated })
    },
  )

  // ─── PATCH /api/expenses/:id/reject ──────────────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id/reject',
    { preHandler: requirePermission('expenses', 'delete') },
    async (request, reply) => {
      const expense = await request.tenantDb.expense.findUnique({ where: { id: request.params.id } })
      if (!expense) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المصروف غير موجود' } })
      if (expense.status !== 'pending') return reply.status(400).send({ success: false, error: { code: 'invalid_status', message: 'المصروف ليس في انتظار الاعتماد' } })

      const actor = request.user as JWTPayload
      const updated = await request.tenantDb.expense.update({
        where: { id: request.params.id },
        data: { status: 'rejected', approvedById: actor.userId },
      })
      await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'expense', entityId: expense.id, action: 'reject', after: { status: 'rejected' }, ip: request.ip })
      return reply.send({ success: true, data: updated })
    },
  )
}
