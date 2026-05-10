import type { TenantPrismaClient } from '@storify/database'
import type { AdjustStockInput, CreateTransferInput } from './stock.schema'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notFound() {
  const err = new Error('not_found') as Error & { statusCode: number }
  err.statusCode = 404
  return err
}

function badRequest(msg: string) {
  const err = new Error(msg) as Error & { statusCode: number }
  err.statusCode = 400
  return err
}

// ─── Low-stock alert check ────────────────────────────────────────────────────

export async function checkLowStock(
  db: TenantPrismaClient,
  variantId: string,
  branchId: string,
): Promise<boolean> {
  const stock = await db.stock.findUnique({
    where: { uq_stock_variant_branch: { variantId, branchId } },
  })
  return !!(stock && stock.quantity <= stock.minQuantity)
}

// ─── List stock ───────────────────────────────────────────────────────────────

export async function listStock(
  db: TenantPrismaClient,
  opts: { branchId?: string; variantId?: string; lowStock?: string; page: number; limit: number },
) {
  const where = {
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.variantId ? { variantId: opts.variantId } : {}),
    // low stock: quantity <= minQuantity (Prisma doesn't support column comparison in where directly;
    // use a raw workaround via filtering after fetch for simplicity at this stage)
  }

  const [total, items] = await Promise.all([
    db.stock.count({ where }),
    db.stock.findMany({
      where,
      include: {
        variant: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
  ])

  const filtered =
    opts.lowStock === 'true'
      ? items.filter((s) => s.quantity <= s.minQuantity)
      : items

  return {
    items: filtered,
    meta: { total, page: opts.page, limit: opts.limit, pages: Math.ceil(total / opts.limit) },
  }
}

// ─── Manual stock adjustment ──────────────────────────────────────────────────

export async function adjustStock(
  db: TenantPrismaClient,
  input: AdjustStockInput,
  actorId: string,
) {
  const stock = await db.stock.findUnique({
    where: { uq_stock_variant_branch: { variantId: input.variantId, branchId: input.branchId } },
  })
  if (!stock) throw notFound()

  const newQty = stock.quantity + input.quantity
  if (newQty < 0) throw badRequest('insufficient_stock')

  await db.$transaction([
    db.stock.update({
      where: { uq_stock_variant_branch: { variantId: input.variantId, branchId: input.branchId } },
      data: { quantity: newQty, updatedAt: new Date() },
    }),
    db.stockMovement.create({
      data: {
        variantId: input.variantId,
        branchId: input.branchId,
        userId: actorId,
        type: 'adjustment',
        quantity: input.quantity,
        note: input.note ?? input.reason,
        reference: null,
      },
    }),
  ])

  const isLow = await checkLowStock(db, input.variantId, input.branchId)
  return { quantity: newQty, isLowStock: isLow }
}

// ─── Set min quantity ─────────────────────────────────────────────────────────

export async function setMinQuantity(
  db: TenantPrismaClient,
  variantId: string,
  branchId: string,
  minQuantity: number,
) {
  const stock = await db.stock.findUnique({
    where: { uq_stock_variant_branch: { variantId, branchId } },
  })
  if (!stock) throw notFound()

  return db.stock.update({
    where: { uq_stock_variant_branch: { variantId, branchId } },
    data: { minQuantity, updatedAt: new Date() },
  })
}

// ─── Stock movements ──────────────────────────────────────────────────────────

export async function listMovements(
  db: TenantPrismaClient,
  opts: { variantId?: string; branchId?: string; type?: string; page: number; limit: number },
) {
  const where = {
    ...(opts.variantId ? { variantId: opts.variantId } : {}),
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.type ? { type: opts.type } : {}),
  }

  const [total, items] = await Promise.all([
    db.stockMovement.count({ where }),
    db.stockMovement.findMany({
      where,
      include: {
        variant: {
          include: { product: { select: { id: true, name: true } } },
        },
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true } },
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

// ─── Stock transfers ──────────────────────────────────────────────────────────

export async function createTransfer(
  db: TenantPrismaClient,
  input: CreateTransferInput,
  actorId: string,
) {
  if (input.fromBranchId === input.toBranchId) {
    throw badRequest('same_branch_transfer')
  }

  const transfer = await db.stockTransfer.create({
    data: {
      fromBranchId: input.fromBranchId,
      toBranchId: input.toBranchId,
      createdById: actorId,
      status: 'pending',
      notes: input.notes ?? null,
      items: {
        create: input.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      },
    },
    include: { items: true },
  })

  return transfer
}

export async function approveTransfer(
  db: TenantPrismaClient,
  transferId: string,
  actorId: string,
  action: 'approve' | 'reject',
) {
  const transfer = await db.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: true },
  })
  if (!transfer) throw notFound()
  if (transfer.status !== 'pending') throw badRequest('transfer_not_pending')

  if (action === 'reject') {
    return db.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'rejected', approvedById: actorId },
      include: { items: true },
    })
  }

  // Approve: validate stock availability, then atomically deduct + credit
  for (const item of transfer.items) {
    const stock = await db.stock.findUnique({
      where: {
        uq_stock_variant_branch: { variantId: item.variantId, branchId: transfer.fromBranchId },
      },
    })
    if (!stock || stock.quantity < item.quantity) {
      throw badRequest(`insufficient_stock:${item.variantId}`)
    }
  }

  await db.$transaction(async (tx) => {
    for (const item of transfer.items) {
      // Deduct from source
      await tx.stock.update({
        where: {
          uq_stock_variant_branch: { variantId: item.variantId, branchId: transfer.fromBranchId },
        },
        data: { quantity: { decrement: item.quantity }, updatedAt: new Date() },
      })
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          branchId: transfer.fromBranchId,
          userId: actorId,
          type: 'transfer',
          quantity: -item.quantity,
          reference: transferId,
        },
      })

      // Credit to destination — upsert in case stock row doesn't exist yet for that branch
      await tx.stock.upsert({
        where: {
          uq_stock_variant_branch: { variantId: item.variantId, branchId: transfer.toBranchId },
        },
        create: {
          variantId: item.variantId,
          branchId: transfer.toBranchId,
          quantity: item.quantity,
          minQuantity: 0,
          updatedAt: new Date(),
        },
        update: { quantity: { increment: item.quantity }, updatedAt: new Date() },
      })
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          branchId: transfer.toBranchId,
          userId: actorId,
          type: 'transfer',
          quantity: item.quantity,
          reference: transferId,
        },
      })
    }

    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'completed', approvedById: actorId },
    })
  })

  return db.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: true },
  })
}

export async function getTransfer(db: TenantPrismaClient, transferId: string) {
  const transfer = await db.stockTransfer.findUnique({
    where: { id: transferId },
    include: {
      items: {
        include: {
          variant: { include: { product: { select: { id: true, name: true } } } },
        },
      },
      fromBranch: { select: { id: true, name: true } },
      toBranch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, fullName: true } },
      approvedBy: { select: { id: true, fullName: true } },
    },
  })
  if (!transfer) throw notFound()
  return transfer
}

export async function listTransfers(
  db: TenantPrismaClient,
  opts: { status?: string; page: number; limit: number },
) {
  const where = opts.status ? { status: opts.status } : {}

  const [total, items] = await Promise.all([
    db.stockTransfer.count({ where }),
    db.stockTransfer.findMany({
      where,
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { items: true } },
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
