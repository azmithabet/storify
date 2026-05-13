import type { TenantPrismaClient } from '@storify/database'
import { Decimal, toDecimal, roundMoney, ZERO } from '../../shared/utils/decimal'
import { calculateFee } from '../../shared/utils/fee'
import type { CreateInvoiceInput, ReturnInvoiceInput } from './invoice.schema'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badRequest(msg: string) {
  const err = new Error(msg) as Error & { statusCode: number }
  err.statusCode = 400
  return err
}

function notFound() {
  const err = new Error('not_found') as Error & { statusCode: number }
  err.statusCode = 404
  return err
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listInvoices(
  db: TenantPrismaClient,
  opts: {
    page: number
    limit: number
    customerId?: string
    branchId?: string
    status?: string
    etaStatus?: string
    search?: string
    from?: string
    to?: string
  },
) {
  const where = {
    ...(opts.customerId ? { customerId: opts.customerId } : {}),
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.etaStatus ? { etaStatus: opts.etaStatus } : {}),
    ...(opts.from || opts.to
      ? {
          createdAt: {
            ...(opts.from ? { gte: new Date(opts.from) } : {}),
            ...(opts.to ? { lte: new Date(opts.to) } : {}),
          },
        }
      : {}),
  }

  const [total, items] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        customer: { select: { id: true, fullName: true, phone: true } },
        cashier: { select: { id: true, fullName: true } },
        paymentMethod: { select: { id: true, name: true, type: true } },
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

// ─── Get one ──────────────────────────────────────────────────────────────────

export async function getInvoice(db: TenantPrismaClient, invoiceId: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      branch: { select: { id: true, name: true } },
      customer: { select: { id: true, fullName: true, phone: true, creditBalance: true } },
      cashier: { select: { id: true, fullName: true } },
      paymentMethod: true,
      currency: true,
      coupon: { select: { id: true, code: true, discountType: true, discountValue: true } },
      items: {
        include: {
          variant: {
            include: { product: { select: { id: true, name: true, unit: true } } },
          },
          taxRate: { select: { id: true, name: true, rate: true } },
        },
      },
      returns: { include: { items: true, processedBy: { select: { id: true, fullName: true } } } },
      paymentFeeExpenses: true,
    },
  })
  if (!invoice) throw notFound()
  return invoice
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createInvoice(
  db: TenantPrismaClient,
  input: CreateInvoiceInput,
  cashierId: string,
) {
  // 1. Validate payment method
  const paymentMethod = await db.paymentMethod.findUnique({
    where: { id: input.paymentMethodId },
  })
  if (!paymentMethod || !paymentMethod.isActive) throw badRequest('payment_method_not_found')

  // 2. Validate currency
  const currency = await db.currency.findUnique({ where: { id: input.currencyId } })
  if (!currency) throw badRequest('currency_not_found')

  // 3. Validate and resolve coupon
  let couponId: string | null = null
  let couponDiscount = ZERO
  let couponDiscountType = ''
  let couponDiscountValue = ZERO

  if (input.couponCode) {
    const coupon = await db.coupon.findUnique({ where: { code: input.couponCode } })
    if (!coupon || !coupon.isActive) throw badRequest('coupon_invalid')
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw badRequest('coupon_expired')
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) throw badRequest('coupon_exhausted')
    couponId = coupon.id
    couponDiscountType = coupon.discountType
    couponDiscountValue = toDecimal(coupon.discountValue)
  }

  // 4. Resolve variants + tax rates for all items (pre-transaction lookup)
  const variantIds = input.items.map((i) => i.variantId)
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: {
      product: { include: { taxRate: true } },
    },
  })

  const variantMap = new Map(variants.map((v) => [v.id, v]))
  for (const item of input.items) {
    if (!variantMap.has(item.variantId)) throw badRequest(`variant_not_found:${item.variantId}`)
  }

  // 5. Calculate totals
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let subtotal = ZERO
  let taxTotal = ZERO

  const computedItems: Array<{
    variantId: string
    taxRateId: string | null
    quantity: number
    unitPrice: Decimal
    discountAmount: Decimal
    taxAmount: Decimal
    subtotal: Decimal
  }> = []

  for (const item of input.items) {
    const variant = variantMap.get(item.variantId)!
    const unitPrice = toDecimal(item.unitPrice)

    // Check for active product discount
    const productDiscount = await db.productDiscount.findFirst({
      where: {
        productId: variant.productId,
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    })

    let itemDiscount = ZERO
    if (productDiscount) {
      if (productDiscount.discountType === 'percentage') {
        itemDiscount = roundMoney(
          unitPrice.times(item.quantity).times(toDecimal(productDiscount.discountValue)).dividedBy(100),
        )
      } else {
        itemDiscount = roundMoney(toDecimal(productDiscount.discountValue).times(item.quantity))
      }
    }

    const itemSubtotal = roundMoney(unitPrice.times(item.quantity).minus(itemDiscount))
    const taxRate = variant.product.taxRate
    const itemTax = taxRate
      ? roundMoney(itemSubtotal.times(toDecimal(taxRate.rate)).dividedBy(100))
      : ZERO

    subtotal = subtotal.plus(itemSubtotal)
    taxTotal = taxTotal.plus(itemTax)

    computedItems.push({
      variantId: item.variantId,
      taxRateId: variant.product.taxRateId ?? null,
      quantity: item.quantity,
      unitPrice,
      discountAmount: itemDiscount,
      taxAmount: itemTax,
      subtotal: itemSubtotal,
    })
  }

  // Coupon discount (applied to subtotal after product discounts)
  if (couponId) {
    if (couponDiscountType === 'percentage') {
      couponDiscount = roundMoney(subtotal.times(couponDiscountValue).dividedBy(100))
    } else {
      couponDiscount = roundMoney(couponDiscountValue)
    }
    // Cap coupon at subtotal
    if (couponDiscount.greaterThan(subtotal)) couponDiscount = subtotal
  }

  const preFeeTotal = subtotal.minus(couponDiscount).plus(taxTotal)
  const { feeAmount, feeAddedToTotal } = calculateFee(
    preFeeTotal,
    paymentMethod,
    input.feeBearer,
  )

  const totalAmount = roundMoney(
    feeAddedToTotal ? preFeeTotal.plus(feeAmount) : preFeeTotal,
  )

  const effectiveFeeBearer = input.feeBearer ?? paymentMethod.feeBearer

  // 6. Atomic transaction
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        branchId: input.branchId,
        customerId: input.customerId ?? null,
        cashierId,
        paymentMethodId: input.paymentMethodId,
        currencyId: input.currencyId,
        couponId,
        exchangeRate: toDecimal(currency.rateToBase),
        subtotal,
        discountAmount: couponDiscount,
        taxTotal,
        feePercentage: toDecimal(paymentMethod.feePercentage),
        feeFixed: toDecimal(paymentMethod.feeFixed),
        feeAmount,
        feeBearer: effectiveFeeBearer,
        feeAddedToTotal,
        totalAmount,
        paidAmount: totalAmount, // full payment for regular invoices
        status: 'completed',
        notes: input.notes ?? null,
      },
    })

    for (const item of computedItems) {
      // Atomic stock gate — race-safe
      const result = await tx.stock.updateMany({
        where: {
          variantId: item.variantId,
          branchId: input.branchId,
          quantity: { gte: item.quantity },
        },
        data: { quantity: { decrement: item.quantity }, updatedAt: new Date() },
      })

      if (result.count === 0) {
        throw badRequest(`insufficient_stock:${item.variantId}`)
      }

      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          variantId: item.variantId,
          taxRateId: item.taxRateId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
          subtotal: item.subtotal,
        },
      })

      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          branchId: input.branchId,
          userId: cashierId,
          type: 'out',
          quantity: -item.quantity,
          reference: invoice.id,
        },
      })
    }

    // Increment coupon usage
    if (couponId) {
      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      })
    }

    // Auto fee expense when merchant bears it
    if (effectiveFeeBearer === 'merchant' && feeAmount.greaterThan(0)) {
      await tx.paymentFeeExpense.create({
        data: {
          invoiceId: invoice.id,
          paymentMethodId: input.paymentMethodId,
          feeAmount,
          branchId: input.branchId,
        },
      })
    }

    // External financing record (stock IS updated immediately — handled above)
    if (input.externalFinancing) {
      await tx.externalFinancing.create({
        data: {
          invoiceId: invoice.id,
          companyName: input.externalFinancing.companyName,
          referenceNo: input.externalFinancing.referenceNo ?? null,
          commissionPct: input.externalFinancing.commissionPct,
        },
      })
    }

    // Mandatory audit log inside transaction
    await tx.auditLog.create({
      data: {
        actorId: cashierId,
        entity: 'invoice',
        entityId: invoice.id,
        action: 'create',
        after: {
          totalAmount: totalAmount.toString(),
          itemCount: computedItems.length,
          feeAmount: feeAmount.toString(),
          feeBearer: effectiveFeeBearer,
        },
      },
    })

    return invoice
  })
}

// ─── Return ───────────────────────────────────────────────────────────────────

export async function returnInvoice(
  db: TenantPrismaClient,
  invoiceId: string,
  input: ReturnInvoiceInput,
  actorId: string,
) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      customer: { select: { id: true, creditBalance: true } },
    },
  })
  if (!invoice) throw notFound()
  if (invoice.status === 'cancelled') throw badRequest('invoice_cancelled')

  // Validate return quantities don't exceed sold quantities
  for (const ri of input.items) {
    const invoiceItem = invoice.items.find((i) => i.variantId === ri.variantId)
    if (!invoiceItem) throw badRequest(`item_not_in_invoice:${ri.variantId}`)
    if (ri.quantity > invoiceItem.quantity) throw badRequest(`return_qty_exceeds_sold:${ri.variantId}`)
  }

  // Calculate return amount proportionally
  const returnAmount = roundMoney(
    input.items.reduce((sum, ri) => {
      const invoiceItem = invoice.items.find((i) => i.variantId === ri.variantId)!
      const itemTotal = toDecimal(invoiceItem.subtotal)
        .plus(toDecimal(invoiceItem.taxAmount))
        .minus(toDecimal(invoiceItem.discountAmount))
      const perUnit = itemTotal.dividedBy(invoiceItem.quantity)
      return sum.plus(perUnit.times(ri.quantity))
    }, ZERO),
  )

  return db.$transaction(async (tx) => {
    const returnRecord = await tx.return.create({
      data: {
        invoiceId,
        processedById: actorId,
        returnType: input.returnType,
        amount: returnAmount,
        reason: input.reason ?? null,
        items: {
          create: input.items.map((ri) => ({
            variantId: ri.variantId,
            quantity: ri.quantity,
            restock: ri.restock,
          })),
        },
      },
      include: { items: true },
    })

    // Restock + log movements
    for (const ri of input.items) {
      if (ri.restock) {
        await tx.stock.updateMany({
          where: { variantId: ri.variantId, branchId: invoice.branchId },
          data: { quantity: { increment: ri.quantity }, updatedAt: new Date() },
        })
        await tx.stockMovement.create({
          data: {
            variantId: ri.variantId,
            branchId: invoice.branchId,
            userId: actorId,
            type: 'return',
            quantity: ri.quantity,
            reference: returnRecord.id,
          },
        })
      }
    }

    // Credit: increment customer balance
    if (input.returnType === 'credit' && invoice.customerId) {
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: { creditBalance: { increment: returnAmount } },
      })
    }

    // Mandatory audit log
    await tx.auditLog.create({
      data: {
        actorId,
        entity: 'invoice',
        entityId: invoiceId,
        action: 'return',
        after: {
          returnId: returnRecord.id,
          returnType: input.returnType,
          amount: returnAmount.toString(),
        },
      },
    })

    return returnRecord
  })
}
