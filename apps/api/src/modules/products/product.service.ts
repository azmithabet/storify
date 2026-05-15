import type { TenantPrismaClient } from '@storify/database'
import type { CreateProductInput, UpdateProductInput, VariantInput, VariantUpdateInput } from './product.schema'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notFound() {
  const err = new Error('not_found') as Error & { statusCode: number }
  err.statusCode = 404
  return err
}

function conflict(msg: string) {
  const err = new Error(msg) as Error & { statusCode: number }
  err.statusCode = 409
  return err
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listProducts(
  db: TenantPrismaClient,
  opts: { page: number; limit: number; search?: string; categoryId?: string; isActive?: string },
) {
  const where = {
    ...(opts.search ? { name: { contains: opts.search, mode: 'insensitive' as const } } : {}),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.isActive !== undefined ? { isActive: opts.isActive === 'true' } : {}),
  }

  const [total, items] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        taxRate: { select: { id: true, name: true, rate: true } },
        variants: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
  ])

  return {
    items,
    meta: { total, page: opts.page, limit: opts.limit, pages: Math.ceil(total / opts.limit) },
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createProduct(
  db: TenantPrismaClient,
  input: CreateProductInput,
  branchIds: string[],
) {
  const product = await db.product.create({
    data: {
      name: input.name,
      categoryId: input.categoryId ?? null,
      taxRateId: input.taxRateId ?? null,
      description: input.description ?? null,
      unit: input.unit,
      imageUrl: input.imageUrl ?? null,
      hasVariants: input.hasVariants,
      variants: {
        create: input.variants.map((v) => ({
          sku: v.sku ?? null,
          barcode: v.barcode ?? null,
          attributes: v.attributes,
          costPrice: v.costPrice,
          sellPrice: v.sellPrice,
          imageUrl: v.imageUrl ?? null,
          // Auto-create stock record for each branch
          stock: {
            create: branchIds.map((branchId) => ({ branchId, quantity: 0, minQuantity: 0 })),
          },
        })),
      },
    },
    include: {
      category: { select: { id: true, name: true } },
      taxRate: { select: { id: true, name: true, rate: true } },
      variants: { include: { stock: true } },
    },
  })

  return product
}

// ─── Get one ──────────────────────────────────────────────────────────────────

export async function getProduct(db: TenantPrismaClient, productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { id: true, name: true } },
      taxRate: { select: { id: true, name: true, rate: true } },
      variants: {
        include: { stock: { include: { branch: { select: { id: true, name: true } } } } },
      },
    },
  })
  if (!product) throw notFound()
  return product
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateProduct(
  db: TenantPrismaClient,
  productId: string,
  input: UpdateProductInput,
) {
  const existing = await db.product.findUnique({ where: { id: productId } })
  if (!existing) throw notFound()

  return db.product.update({
    where: { id: productId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.taxRateId !== undefined ? { taxRateId: input.taxRateId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      taxRate: { select: { id: true, name: true, rate: true } },
      variants: true,
    },
  })
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteProduct(db: TenantPrismaClient, productId: string) {
  const existing = await db.product.findUnique({ where: { id: productId } })
  if (!existing) throw notFound()

  return db.product.update({
    where: { id: productId },
    data: { isActive: false },
  })
}

// ─── Variants ─────────────────────────────────────────────────────────────────

export async function addVariant(
  db: TenantPrismaClient,
  productId: string,
  input: VariantInput,
  branchIds: string[],
) {
  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) throw notFound()
  if (!product.hasVariants) {
    throw conflict('product_is_single_variant')
  }

  if (input.sku) {
    const exists = await db.productVariant.findFirst({
      where: { productId, sku: input.sku },
    })
    if (exists) throw conflict('sku_already_exists')
  }

  return db.productVariant.create({
    data: {
      productId,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      attributes: input.attributes,
      costPrice: input.costPrice,
      sellPrice: input.sellPrice,
      imageUrl: input.imageUrl ?? null,
      stock: {
        create: branchIds.map((branchId) => ({ branchId, quantity: 0, minQuantity: 0 })),
      },
    },
    include: { stock: true },
  })
}

export async function updateVariant(
  db: TenantPrismaClient,
  productId: string,
  variantId: string,
  input: VariantUpdateInput,
) {
  const variant = await db.productVariant.findFirst({
    where: { id: variantId, productId },
  })
  if (!variant) throw notFound()

  if (input.sku && input.sku !== variant.sku) {
    const conflict2 = await db.productVariant.findFirst({
      where: { productId, sku: input.sku, id: { not: variantId } },
    })
    if (conflict2) throw conflict('sku_already_exists')
  }

  return db.productVariant.update({
    where: { id: variantId },
    data: {
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
      ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
      ...(input.sellPrice !== undefined ? { sellPrice: input.sellPrice } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })
}

// ─── Barcode lookup ───────────────────────────────────────────────────────────

/**
 * Cross-page typeahead — POS, Installments, PurchaseOrders, Stock all hit this.
 * Searches variant SKU + product name; returns active variants only with the
 * fields the typeahead UIs render (product name, sku, sellPrice, per-branch stock).
 */
export async function searchVariants(
  db: TenantPrismaClient,
  q: string,
  limit: number,
) {
  const term = q.trim()
  if (!term) return []
  return db.productVariant.findMany({
    where: {
      isActive: true,
      product: { isActive: true },
      OR: [
        { sku: { contains: term, mode: 'insensitive' } },
        { barcode: { contains: term, mode: 'insensitive' } },
        { product: { name: { contains: term, mode: 'insensitive' } } },
      ],
    },
    include: {
      product: { select: { id: true, name: true } },
      stock: { select: { branchId: true, quantity: true } },
    },
    take: Math.min(Math.max(limit, 1), 25),
    orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }],
  })
}

export async function findByBarcode(db: TenantPrismaClient, barcode: string) {
  const variant = await db.productVariant.findFirst({
    where: { barcode, isActive: true },
    include: {
      product: {
        include: {
          category: { select: { id: true, name: true } },
          taxRate: { select: { id: true, name: true, rate: true } },
        },
      },
      stock: { include: { branch: { select: { id: true, name: true } } } },
    },
  })
  if (!variant || !variant.product.isActive) throw notFound()
  return variant
}
