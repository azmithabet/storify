import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import { requireFeature } from '../../shared/middleware/feature.middleware'
import { auditLog } from '../../shared/utils/audit'
import {
  createServiceCategorySchema,
  updateServiceCategorySchema,
  createServiceSchema,
  updateServiceSchema,
  listServicesSchema,
} from './service.schema'

export async function serviceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  // Plan-gate the entire module. Mirrors the frontend FeatureGate on /services/*.
  app.addHook('preHandler', requireFeature('services'))

  // ═══ Service Categories ════════════════════════════════════════════════════
  app.get('/categories', { preHandler: requirePermission('services', 'read') }, async (request) => {
    const categories = await request.tenantDb.serviceCategory.findMany({
      orderBy: { name: 'asc' },
    })
    return { success: true, data: categories }
  })

  app.post('/categories', { preHandler: requirePermission('services', 'create') }, async (request, reply) => {
    const parsed = createServiceCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const actor = request.user as JWTPayload
    const category = await request.tenantDb.serviceCategory.create({ data: { name: parsed.data.name } })
    await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'service_category', entityId: category.id, action: 'create', after: { name: category.name }, ip: request.ip })
    return reply.status(201).send({ success: true, data: category })
  })

  app.patch<{ Params: { id: string } }>(
    '/categories/:id',
    { preHandler: requirePermission('services', 'update') },
    async (request, reply) => {
      const parsed = updateServiceCategorySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }
      try {
        const category = await request.tenantDb.serviceCategory.update({
          where: { id: request.params.id },
          data: parsed.data,
        })
        return reply.send({ success: true, data: category })
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الفئة غير موجودة' } })
      }
    },
  )

  // ═══ Services (catalog) ════════════════════════════════════════════════════
  app.get('/', { preHandler: requirePermission('services', 'read') }, async (request, reply) => {
    const parsed = listServicesSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const { page, limit, search, categoryId, isActive } = parsed.data
    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
    }

    const [total, items] = await Promise.all([
      request.tenantDb.service.count({ where }),
      request.tenantDb.service.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return reply.send({ success: true, data: items, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
  })

  app.post('/', { preHandler: requirePermission('services', 'create') }, async (request, reply) => {
    const parsed = createServiceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const actor = request.user as JWTPayload
    const service = await request.tenantDb.service.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        categoryId: parsed.data.categoryId ?? null,
        defaultPrice: parsed.data.defaultPrice,
        estimatedDurationMinutes: parsed.data.estimatedDurationMinutes ?? null,
        isActive: parsed.data.isActive,
      },
    })
    await auditLog({
      db: request.tenantDb,
      actorId: actor.userId,
      entity: 'service',
      entityId: service.id,
      action: 'create',
      after: { name: service.name, defaultPrice: service.defaultPrice.toString() },
      ip: request.ip,
    })
    return reply.status(201).send({ success: true, data: service })
  })

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('services', 'read') },
    async (request, reply) => {
      const service = await request.tenantDb.service.findUnique({
        where: { id: request.params.id },
        include: { category: { select: { id: true, name: true } } },
      })
      if (!service) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الخدمة غير موجودة' } })
      return reply.send({ success: true, data: service })
    },
  )

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('services', 'update') },
    async (request, reply) => {
      const parsed = updateServiceSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
      }
      try {
        const actor = request.user as JWTPayload
        const service = await request.tenantDb.service.update({
          where: { id: request.params.id },
          data: {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
            ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
            ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
            ...(parsed.data.defaultPrice !== undefined ? { defaultPrice: parsed.data.defaultPrice } : {}),
            ...(parsed.data.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: parsed.data.estimatedDurationMinutes } : {}),
            ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
          },
        })
        await auditLog({ db: request.tenantDb, actorId: actor.userId, entity: 'service', entityId: service.id, action: 'update', ip: request.ip })
        return reply.send({ success: true, data: service })
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الخدمة غير موجودة' } })
      }
    },
  )

  // Soft delete — preserves history on work orders that referenced this service.
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('services', 'delete') },
    async (request, reply) => {
      try {
        await request.tenantDb.service.update({ where: { id: request.params.id }, data: { isActive: false } })
        return reply.send({ success: true })
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الخدمة غير موجودة' } })
      }
    },
  )
}
