import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import {
  dateRangeSchema,
  salesReportSchema,
  stockReportSchema,
  installmentsReportSchema,
  returnsReportSchema,
} from './report.schema'
import {
  getDashboard,
  getSalesReport,
  getStockReport,
  getInstallmentsReport,
  getFeesReport,
  getProfitLoss,
  getReturnsReport,
  getDayClose,
} from './report.service'
import { buildSalesExcel, buildStockExcel, buildProfitLossExcel } from './excel'

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // ─── Dashboard ───────────────────────────────────────────────────────────────
  app.get('/dashboard', { preHandler: requirePermission('reports', 'read') }, async (request, reply) => {
    const actor = request.user as JWTPayload
    const branchId = (request.query as Record<string, string>).branchId

    // Non-super_admin: restrict to own branch
    const effectiveBranchId =
      actor.roleSlug === 'super_admin' ? branchId : (actor.branchId || branchId)

    const data = await getDashboard(request.tenantDb, actor.tenantId, effectiveBranchId)
    return reply.send({ success: true, data })
  })

  // ─── Sales report ─────────────────────────────────────────────────────────────
  app.get('/sales', { preHandler: requirePermission('reports', 'read') }, async (request, reply) => {
    const parsed = salesReportSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const data = await getSalesReport(request.tenantDb, parsed.data)

    if (parsed.data.format === 'excel') {
      const buf = await buildSalesExcel(data)
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', 'attachment; filename="sales-report.xlsx"')
        .send(buf)
    }

    return reply.send({ success: true, data })
  })

  // ─── Stock report ─────────────────────────────────────────────────────────────
  app.get('/stock', { preHandler: requirePermission('reports', 'read') }, async (request, reply) => {
    const parsed = stockReportSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const data = await getStockReport(request.tenantDb, {
      branchId: parsed.data.branchId,
      lowStockOnly: parsed.data.lowStockOnly === 'true',
    })

    if (parsed.data.format === 'excel') {
      const buf = await buildStockExcel(data.items as Array<Record<string, unknown>>)
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', 'attachment; filename="stock-report.xlsx"')
        .send(buf)
    }

    return reply.send({ success: true, data })
  })

  // ─── Installments report ─────────────────────────────────────────────────────
  app.get('/installments', { preHandler: requirePermission('installments', 'read') }, async (request, reply) => {
    const parsed = installmentsReportSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const data = await getInstallmentsReport(request.tenantDb, {
      branchId: parsed.data.branchId,
      status: parsed.data.status,
    })
    return reply.send({ success: true, data })
  })

  // ─── Fees report ─────────────────────────────────────────────────────────────
  app.get('/fees', { preHandler: requirePermission('reports', 'read') }, async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const data = await getFeesReport(request.tenantDb, parsed.data)
    return reply.send({ success: true, data })
  })

  // ─── Top products ─────────────────────────────────────────────────────────────
  app.get('/top-products', { preHandler: requirePermission('reports', 'read') }, async (request, reply) => {
    const { z } = await import('zod')
    const schema = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      branchId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    const parsed = schema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })

    const { from, to, branchId, limit } = parsed.data
    const dateFilter = from || to ? {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    } : {}

    const rows = await request.tenantDb.invoiceItem.groupBy({
      by: ['variantId'],
      where: {
        // Only product items (service items have variantId = null)
        variantId: { not: null },
        invoice: { status: 'completed', ...(branchId ? { branchId } : {}), ...dateFilter },
      },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: limit,
    })

    // variantId is non-null here because of the filter above
    const variantIds = rows.map((r) => r.variantId as string)
    const variants = await request.tenantDb.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, sku: true, product: { select: { name: true } } },
    })
    const vMap = new Map(variants.map((v) => [v.id, v]))

    const data = rows.map((r) => {
      const vid = r.variantId as string
      const v = vMap.get(vid)
      return {
        variantSku: v?.sku ?? vid.slice(0, 8),
        productName: v?.product.name ?? '—',
        totalQty: Number(r._sum?.quantity ?? 0),
        totalRevenue: Number(r._sum?.subtotal ?? 0),
      }
    })

    return reply.send({ success: true, data })
  })

  // ─── Profit & Loss ────────────────────────────────────────────────────────────
  app.get('/profit-loss', { preHandler: requirePermission('reports', 'read') }, async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const data = await getProfitLoss(request.tenantDb, parsed.data)

    if (parsed.data.format === 'excel') {
      const buf = await buildProfitLossExcel(data as Record<string, number | string>)
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', 'attachment; filename="profit-loss.xlsx"')
        .send(buf)
    }

    return reply.send({ success: true, data })
  })

  // ─── Returns analytics ───────────────────────────────────────────────────────
  // Read permission is on invoices (returns are an invoice-adjacent concern in
  // this app's RBAC), not 'reports' — keeps the gate consistent with the
  // /returns list page.
  app.get('/returns', { preHandler: requirePermission('invoices', 'read') }, async (request, reply) => {
    const parsed = returnsReportSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const data = await getReturnsReport(request.tenantDb, parsed.data)
    return reply.send({ success: true, data })
  })

  // ─── Day close ───────────────────────────────────────────────────────────────
  app.get('/day-close', { preHandler: requirePermission('reports', 'read') }, async (request, reply) => {
    const q = request.query as Record<string, string>
    const date = q.date ?? new Date().toISOString().slice(0, 10)
    const branchId = q.branchId || undefined
    const data = await getDayClose(request.tenantDb, date, branchId)
    return reply.send({ success: true, data })
  })
}
