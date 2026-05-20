import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import { requireFeature } from '../../shared/middleware/feature.middleware'
import { auditLog } from '../../shared/utils/audit'
import { createExpenseSchema, updateExpenseSchema, listExpensesSchema } from './expense.schema'

export async function expenseRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  // Plan-gate the entire module. Mirrors the frontend FeatureGate on /expenses/*.
  app.addHook('preHandler', requireFeature('expenses'))

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
    const schema = z.object({ name: z.string().min(1) })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    const category = await request.tenantDb.expenseCategory.create({ data: { name: parsed.data.name } })
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

  // ─── Budgets ──────────────────────────────────────────────────────────────
  // GET /api/expenses/budgets — returns every budget joined with its category
  // plus actual spending for the current period (only approved expenses count).
  app.get('/budgets', { preHandler: requirePermission('expenses', 'read') }, async (request) => {
    const budgets = await request.tenantDb.expenseBudget.findMany({
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: { createdAt: 'asc' },
    })

    // Compute spending windows in JS instead of N queries.
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const categoryIds = budgets.map((b) => b.categoryId)
    type SpentRow = { category_id: string; period: string; total: string }
    const spent = categoryIds.length === 0
      ? [] as SpentRow[]
      : await request.tenantDb.$queryRawUnsafe<SpentRow[]>(
          `SELECT category_id, 'monthly' AS period, COALESCE(SUM(amount), 0)::TEXT AS total
           FROM expenses
           WHERE status = 'approved' AND category_id = ANY($1::uuid[]) AND expense_date >= $2
           GROUP BY category_id
           UNION ALL
           SELECT category_id, 'yearly' AS period, COALESCE(SUM(amount), 0)::TEXT AS total
           FROM expenses
           WHERE status = 'approved' AND category_id = ANY($1::uuid[]) AND expense_date >= $3
           GROUP BY category_id`,
          categoryIds,
          monthStart,
          yearStart,
        )

    const spentMap = new Map<string, string>()
    for (const row of spent) spentMap.set(`${row.category_id}-${row.period}`, row.total)

    const data = budgets.map((b) => ({
      ...b,
      amount: b.amount.toString(),
      spent: spentMap.get(`${b.categoryId}-${b.period}`) ?? '0',
    }))

    return { success: true, data }
  })

  // POST /api/expenses/budgets — upsert by (categoryId, period). Sending an
  // existing pair overwrites the amount; this keeps the API surface small.
  const upsertBudgetSchema = z.object({
    categoryId: z.string().uuid(),
    period: z.enum(['monthly', 'yearly']).default('monthly'),
    amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  })

  app.post('/budgets', { preHandler: requirePermission('expenses', 'update') }, async (request, reply) => {
    const parsed = upsertBudgetSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }

    const cat = await request.tenantDb.expenseCategory.findUnique({ where: { id: parsed.data.categoryId } })
    if (!cat) {
      return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الفئة غير موجودة' } })
    }

    const actor = request.user as JWTPayload
    const existing = await request.tenantDb.expenseBudget.findUnique({
      where: { categoryId_period: { categoryId: parsed.data.categoryId, period: parsed.data.period } },
    })

    const budget = await request.tenantDb.expenseBudget.upsert({
      where: { categoryId_period: { categoryId: parsed.data.categoryId, period: parsed.data.period } },
      create: { categoryId: parsed.data.categoryId, period: parsed.data.period, amount: parsed.data.amount },
      update: { amount: parsed.data.amount },
    })

    await auditLog({
      db: request.tenantDb,
      actorId: actor.userId,
      entity: 'expense_budget',
      entityId: budget.id,
      action: existing ? 'update' : 'create',
      before: existing ? { amount: existing.amount.toString() } : undefined,
      after: { amount: budget.amount.toString(), categoryName: cat.name, period: budget.period },
      ip: request.ip,
    })

    return reply.send({ success: true, data: budget })
  })

  // DELETE /api/expenses/budgets/:id
  app.delete<{ Params: { id: string } }>(
    '/budgets/:id',
    { preHandler: requirePermission('expenses', 'update') },
    async (request, reply) => {
      const existing = await request.tenantDb.expenseBudget.findUnique({
        where: { id: request.params.id },
        include: { category: { select: { name: true } } },
      })
      if (!existing) {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الميزانية غير موجودة' } })
      }
      const actor = request.user as JWTPayload
      await request.tenantDb.expenseBudget.delete({ where: { id: request.params.id } })
      await auditLog({
        db: request.tenantDb,
        actorId: actor.userId,
        entity: 'expense_budget',
        entityId: existing.id,
        action: 'delete',
        before: { amount: existing.amount.toString(), categoryName: existing.category.name },
        ip: request.ip,
      })
      return reply.status(204).send()
    },
  )

  // ─── Templates ────────────────────────────────────────────────────────────
  // GET /api/expenses/templates — active templates only
  app.get('/templates', { preHandler: requirePermission('expenses', 'read') }, async (request) => {
    const templates = await request.tenantDb.expenseTemplate.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true, color: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: templates }
  })

  const templateSchema = z.object({
    name: z.string().trim().min(1, 'الاسم مطلوب').max(200),
    description: z.string().trim().min(1, 'الوصف مطلوب'),
    amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
    categoryId: z.string().uuid('اختر فئة'),
    branchId: z.string().uuid().optional().nullable(),
    paymentMethod: z.string().max(50).optional().nullable(),
  })

  app.post('/templates', { preHandler: requirePermission('expenses', 'create') }, async (request, reply) => {
    const parsed = templateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }
    const actor = request.user as JWTPayload
    const tmpl = await request.tenantDb.expenseTemplate.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        amount: parsed.data.amount,
        categoryId: parsed.data.categoryId,
        branchId: parsed.data.branchId ?? null,
        paymentMethod: parsed.data.paymentMethod ?? null,
      },
    })
    await auditLog({
      db: request.tenantDb,
      actorId: actor.userId,
      entity: 'expense_template',
      entityId: tmpl.id,
      action: 'create',
      after: { name: tmpl.name, amount: tmpl.amount.toString() },
      ip: request.ip,
    })
    return reply.status(201).send({ success: true, data: tmpl })
  })

  app.patch<{ Params: { id: string } }>(
    '/templates/:id',
    { preHandler: requirePermission('expenses', 'update') },
    async (request, reply) => {
      const parsed = templateSchema.partial().safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }
      const existing = await request.tenantDb.expenseTemplate.findUnique({ where: { id: request.params.id } })
      if (!existing) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'القالب غير موجود' } })

      const actor = request.user as JWTPayload
      const updated = await request.tenantDb.expenseTemplate.update({
        where: { id: request.params.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
          ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
          ...(parsed.data.branchId !== undefined ? { branchId: parsed.data.branchId } : {}),
          ...(parsed.data.paymentMethod !== undefined ? { paymentMethod: parsed.data.paymentMethod } : {}),
        },
      })
      await auditLog({
        db: request.tenantDb,
        actorId: actor.userId,
        entity: 'expense_template',
        entityId: updated.id,
        action: 'update',
        before: { name: existing.name, amount: existing.amount.toString() },
        after: { name: updated.name, amount: updated.amount.toString() },
        ip: request.ip,
      })
      return reply.send({ success: true, data: updated })
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/templates/:id',
    { preHandler: requirePermission('expenses', 'update') },
    async (request, reply) => {
      const existing = await request.tenantDb.expenseTemplate.findUnique({ where: { id: request.params.id } })
      if (!existing) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'القالب غير موجود' } })

      const actor = request.user as JWTPayload
      await request.tenantDb.expenseTemplate.delete({ where: { id: request.params.id } })
      await auditLog({
        db: request.tenantDb,
        actorId: actor.userId,
        entity: 'expense_template',
        entityId: existing.id,
        action: 'delete',
        before: { name: existing.name },
        ip: request.ip,
      })
      return reply.status(204).send()
    },
  )

  // POST /api/expenses/templates/:id/instantiate — creates a new pending
  // expense from the template snapshot using today's date. Updates
  // lastUsedAt so the UI can sort by most recently used.
  app.post<{ Params: { id: string } }>(
    '/templates/:id/instantiate',
    { preHandler: requirePermission('expenses', 'create') },
    async (request, reply) => {
      const tmpl = await request.tenantDb.expenseTemplate.findUnique({ where: { id: request.params.id } })
      if (!tmpl || !tmpl.isActive) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'القالب غير موجود' } })

      const actor = request.user as JWTPayload
      // Branch: prefer the template's branch, fall back to the actor's branch
      // (matches the manual-create flow defaults in the UI).
      let branchId = tmpl.branchId
      if (!branchId) {
        const me = await request.tenantDb.user.findUnique({ where: { id: actor.userId }, select: { branchId: true } })
        branchId = me?.branchId ?? null
      }
      if (!branchId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'no_branch', message: 'القالب لا يحدّد فرعاً والمستخدم غير مرتبط بفرع' },
        })
      }

      const expense = await request.tenantDb.expense.create({
        data: {
          description: tmpl.description,
          amount: tmpl.amount,
          categoryId: tmpl.categoryId,
          branchId,
          paymentMethod: tmpl.paymentMethod,
          expenseDate: new Date(),
          status: 'pending',
          createdById: actor.userId,
        },
      })
      await request.tenantDb.expenseTemplate.update({
        where: { id: tmpl.id },
        data: { lastUsedAt: new Date() },
      })
      await auditLog({
        db: request.tenantDb,
        actorId: actor.userId,
        entity: 'expense',
        entityId: expense.id,
        action: 'create',
        after: { fromTemplate: tmpl.id, amount: expense.amount.toString() },
        ip: request.ip,
      })
      return reply.status(201).send({ success: true, data: expense })
    },
  )
}
