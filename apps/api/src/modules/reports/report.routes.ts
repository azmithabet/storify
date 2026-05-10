import type { FastifyInstance } from 'fastify'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'
import {
  dateRangeSchema,
  salesReportSchema,
  stockReportSchema,
  installmentsReportSchema,
} from './report.schema'
import {
  getDashboard,
  getSalesReport,
  getStockReport,
  getInstallmentsReport,
  getFeesReport,
  getProfitLoss,
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
}
