import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import { auditLog } from '../../shared/utils/audit'
import { getUploadUrl } from '../../config/r2'
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  variantInputSchema,
  variantUpdateSchema,
  uploadUrlSchema,
} from './product.schema'
import {
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  addVariant,
  updateVariant,
  findByBarcode,
} from './product.service'

export async function productRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('onRequest', authenticate)

  // ─── GET /api/products/barcode/:code ────────────────────────────────────────
  // Must be registered BEFORE /:id to avoid route conflict
  app.get<{ Params: { code: string } }>(
    '/barcode/:code',
    { preHandler: requirePermission('products', 'read') },
    async (request, reply) => {
      const variant = await findByBarcode(request.tenantDb, request.params.code)
      return reply.send({ success: true, data: variant })
    },
  )

  // ─── GET /api/products/upload-url ────────────────────────────────────────────
  app.get(
    '/upload-url',
    { preHandler: requirePermission('products', 'create') },
    async (request, reply) => {
      const parsed = uploadUrlSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      try {
        const ext = parsed.data.contentType.split('/')[1]
        const key = `products/${randomUUID()}.${ext}`
        const result = await getUploadUrl(key, parsed.data.contentType)
        return reply.send({ success: true, data: result })
      } catch {
        return reply.status(503).send({
          success: false,
          error: { code: 'storage_unavailable', message: 'R2 storage not configured' },
        })
      }
    },
  )

  // ─── GET /api/products ───────────────────────────────────────────────────────
  app.get(
    '/',
    { preHandler: requirePermission('products', 'read') },
    async (request, reply) => {
      const parsed = listProductsSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const result = await listProducts(request.tenantDb, parsed.data)
      return reply.send({ success: true, data: result.items, meta: result.meta })
    },
  )

  // ─── POST /api/products ──────────────────────────────────────────────────────
  app.post(
    '/',
    { preHandler: requirePermission('products', 'create') },
    async (request, reply) => {
      const parsed = createProductSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const actor = request.user as JWTPayload
      const branches = await request.tenantDb.branch.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      const branchIds = branches.map((b) => b.id)

      const product = await createProduct(request.tenantDb, parsed.data, branchIds)

      await auditLog({
        db: request.tenantDb,
        actorId: actor.userId,
        entity: 'product',
        entityId: product.id,
        action: 'create',
        after: { name: product.name },
        ip: request.ip,
      })

      return reply.status(201).send({ success: true, data: product })
    },
  )

  // ─── GET /api/products/:id ───────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('products', 'read') },
    async (request, reply) => {
      try {
        const product = await getProduct(request.tenantDb, request.params.id)
        return reply.send({ success: true, data: product })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المنتج غير موجود' } })
        }
        throw err
      }
    },
  )

  // ─── PATCH /api/products/:id ─────────────────────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('products', 'update') },
    async (request, reply) => {
      const parsed = updateProductSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const actor = request.user as JWTPayload

      try {
        const before = await getProduct(request.tenantDb, request.params.id)
        const product = await updateProduct(request.tenantDb, request.params.id, parsed.data)

        await auditLog({
          db: request.tenantDb,
          actorId: actor.userId,
          entity: 'product',
          entityId: product.id,
          action: 'update',
          before: { name: before.name, isActive: before.isActive },
          after: { name: product.name, isActive: product.isActive },
          ip: request.ip,
        })

        return reply.send({ success: true, data: product })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المنتج غير موجود' } })
        }
        throw err
      }
    },
  )

  // ─── DELETE /api/products/:id ────────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('products', 'delete') },
    async (request, reply) => {
      const actor = request.user as JWTPayload

      try {
        await deleteProduct(request.tenantDb, request.params.id)

        await auditLog({
          db: request.tenantDb,
          actorId: actor.userId,
          entity: 'product',
          entityId: request.params.id,
          action: 'deactivate',
          ip: request.ip,
        })

        return reply.send({ success: true })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المنتج غير موجود' } })
        }
        throw err
      }
    },
  )

  // ─── POST /api/products/:id/variants ─────────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/variants',
    { preHandler: requirePermission('products', 'update') },
    async (request, reply) => {
      const parsed = variantInputSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const actor = request.user as JWTPayload
      const branches = await request.tenantDb.branch.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      const branchIds = branches.map((b) => b.id)

      try {
        const variant = await addVariant(
          request.tenantDb,
          request.params.id,
          parsed.data,
          branchIds,
        )

        await auditLog({
          db: request.tenantDb,
          actorId: actor.userId,
          entity: 'product_variant',
          entityId: variant.id,
          action: 'create',
          after: { sku: variant.sku, productId: variant.productId },
          ip: request.ip,
        })

        return reply.status(201).send({ success: true, data: variant })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المنتج غير موجود' } })
        }
        if (error.message === 'product_is_single_variant') {
          return reply.status(400).send({ success: false, error: { code: 'product_is_single_variant', message: 'هذا المنتج ليس متعدد الأشكال' } })
        }
        if (error.message === 'sku_already_exists') {
          return reply.status(409).send({ success: false, error: { code: 'sku_already_exists', message: 'رمز المنتج مستخدم بالفعل' } })
        }
        throw err
      }
    },
  )

  // ─── PATCH /api/products/:id/variants/:variantId ──────────────────────────────
  app.patch<{ Params: { id: string; variantId: string } }>(
    '/:id/variants/:variantId',
    { preHandler: requirePermission('products', 'update') },
    async (request, reply) => {
      const parsed = variantUpdateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'validation_error', message: parsed.error.errors[0].message },
        })
      }

      const actor = request.user as JWTPayload

      try {
        const variant = await updateVariant(
          request.tenantDb,
          request.params.id,
          request.params.variantId,
          parsed.data,
        )

        await auditLog({
          db: request.tenantDb,
          actorId: actor.userId,
          entity: 'product_variant',
          entityId: variant.id,
          action: 'update',
          after: { sellPrice: variant.sellPrice.toString(), isActive: variant.isActive },
          ip: request.ip,
        })

        return reply.send({ success: true, data: variant })
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number }
        if (error.message === 'not_found') {
          return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المتغير غير موجود' } })
        }
        if (error.message === 'sku_already_exists') {
          return reply.status(409).send({ success: false, error: { code: 'sku_already_exists', message: 'رمز المنتج مستخدم بالفعل' } })
        }
        throw err
      }
    },
  )

  // ─── GET /api/products/categories ────────────────────────────────────────────
  app.get('/categories', { preHandler: requirePermission('products', 'read') }, async (request, reply) => {
    const categories = await request.tenantDb.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' },
    })
    return reply.send({ success: true, data: categories })
  })

  // ─── POST /api/products/categories ───────────────────────────────────────────
  app.post('/categories', { preHandler: requirePermission('products', 'create') }, async (request, reply) => {
    const { z } = await import('zod')
    const schema = z.object({ name: z.string().min(1), parentId: z.string().uuid().optional() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    const category = await request.tenantDb.category.create({ data: { name: parsed.data.name, parentId: parsed.data.parentId ?? null } })
    return reply.status(201).send({ success: true, data: category })
  })

  // ─── GET /api/products/tax-rates ─────────────────────────────────────────────
  app.get('/tax-rates', { preHandler: requirePermission('products', 'read') }, async (request, reply) => {
    const taxRates = await request.tenantDb.taxRate.findMany({
      where: { isActive: true },
      select: { id: true, name: true, rate: true, isDefault: true },
      orderBy: { rate: 'asc' },
    })
    return reply.send({ success: true, data: taxRates })
  })
}
