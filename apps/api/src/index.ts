import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { config } from './config/env'
import { masterDb } from './config/database'
import { redis } from './config/redis'
import jwtPlugin from './shared/plugins/jwt.plugin'
import cookiePlugin from './shared/plugins/cookie.plugin'
import sentryPlugin from './shared/plugins/sentry.plugin'
import { tenantMiddleware } from './shared/middleware/tenant.middleware'
import { tenantRoutes } from './modules/tenants/tenant.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { productRoutes } from './modules/products/product.routes'
import { stockRoutes } from './modules/stock/stock.routes'
import { paymentMethodRoutes } from './modules/payment-methods/pm.routes'
import { customerRoutes } from './modules/customers/customer.routes'
import { invoiceRoutes } from './modules/invoices/invoice.routes'
import { installmentRoutes } from './modules/installments/installment.routes'
import { supplierRoutes } from './modules/suppliers/supplier.routes'
import { purchaseOrderRoutes } from './modules/purchase-orders/po.routes'
import { expenseRoutes } from './modules/expenses/expense.routes'
import { reportRoutes } from './modules/reports/report.routes'
import { couponRoutes } from './modules/coupons/coupon.routes'
import { etaRoutes } from './modules/eta/eta.routes'
import { billingRoutes } from './modules/billing/billing.routes'
import { authenticate } from './shared/middleware/auth.middleware'
import { startEtaWorker } from './jobs/eta-submission.job'
import { startDunningWorker, scheduleDunning } from './jobs/dunning.job'
import { startReminderWorker, scheduleReminders } from './jobs/installment-reminders.job'
import { startTrialExpiryWorker, scheduleTrialExpiry } from './jobs/trial-expiry.job'

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

// ─── Global plugins ───────────────────────────────────────────────────────────
app.register(cors, {
  origin: config.FRONTEND_URL,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Subdomain'],
})
app.register(sentryPlugin)
app.register(jwtPlugin)
app.register(cookiePlugin)
app.register(rateLimit, {
  global: false, // opt-in per-route via config.rateLimit
  redis,
})

// ─── Public routes (no tenant required) ──────────────────────────────────────
app.get('/health', async () => {
  return { status: 'ok', env: config.NODE_ENV, timestamp: new Date().toISOString() }
})

// also expose under /api/plans so the Vite proxy (/api → :3000) works
app.get('/plans', async (_req, reply) => {
  const plans = await masterDb.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  return reply.send({ data: plans })
})
app.get('/api/plans', async (_req, reply) => {
  const plans = await masterDb.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  return reply.send({ data: plans })
})

app.register(tenantRoutes, { prefix: '/api/tenants' })

// ─── Tenant-scoped routes (tenant middleware required) ────────────────────────
app.register(async function tenantScoped(sub) {
  sub.addHook('onRequest', tenantMiddleware)
  sub.register(authRoutes, { prefix: '/api/auth' })
  sub.register(productRoutes, { prefix: '/api/products' })
  sub.register(stockRoutes, { prefix: '/api/stock' })
  sub.register(paymentMethodRoutes, { prefix: '/api/payment-methods' })
  sub.register(customerRoutes, { prefix: '/api/customers' })
  sub.register(invoiceRoutes, { prefix: '/api/invoices' })
  sub.register(installmentRoutes, { prefix: '/api/installments' })
  sub.register(supplierRoutes, { prefix: '/api/suppliers' })
  sub.register(purchaseOrderRoutes, { prefix: '/api/purchase-orders' })
  sub.register(expenseRoutes, { prefix: '/api/expenses' })
  sub.register(reportRoutes, { prefix: '/api/reports' })
  sub.register(couponRoutes, { prefix: '/api/coupons' })
  sub.register(etaRoutes, { prefix: '/api' })
  sub.register(billingRoutes, { prefix: '/api' })

  // ─── Tenant Settings ──────────────────────────────────────────────────────
  sub.get('/api/settings', { preHandler: [authenticate] }, async (request, reply) => {
    const s = await request.tenantDb.tenantSetting.findFirst()
    return reply.send({ success: true, data: s })
  })

  sub.patch('/api/settings', { preHandler: [authenticate] }, async (request, reply) => {
    const { z } = await import('zod')
    const schema = z.object({
      vatEnabled: z.boolean().optional(),
      vatRate: z.coerce.number().min(0).max(100).optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      currencyDefault: z.string().optional(),
      loyaltyEnabled: z.boolean().optional(),
      loyaltyPointsPerUnit: z.coerce.number().int().min(1).optional(),
      loyaltyPointValue: z.coerce.number().min(0).optional(),
      printTemplate: z.string().optional(),
      dailySalesTarget: z.coerce.number().min(0).optional(),
    })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    const existing = await request.tenantDb.tenantSetting.findFirst()
    if (!existing) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'الإعدادات غير موجودة' } })
    const updated = await request.tenantDb.tenantSetting.update({ where: { id: existing.id }, data: parsed.data })
    return reply.send({ success: true, data: updated })
  })

  // ─── Currencies ───────────────────────────────────────────────────────────
  sub.get('/api/currencies', { preHandler: [authenticate] }, async (request, reply) => {
    const currencies = await request.tenantDb.currency.findMany({
      orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
    })
    return reply.send({ success: true, data: currencies })
  })

  // ─── Branches CRUD ────────────────────────────────────────────────────────
  sub.get('/api/branches', { preHandler: [authenticate] }, async (request, reply) => {
    const branches = await request.tenantDb.branch.findMany({
      select: { id: true, name: true, isMain: true, isActive: true, address: true, phone: true },
      orderBy: { isMain: 'desc' },
    })
    return reply.send({ success: true, data: branches })
  })

  sub.post('/api/branches', { preHandler: [authenticate] }, async (request, reply) => {
    const { z } = await import('zod')
    const schema = z.object({ name: z.string().min(1), address: z.string().optional(), phone: z.string().optional() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    const branch = await request.tenantDb.branch.create({
      data: { name: parsed.data.name, address: parsed.data.address, phone: parsed.data.phone },
    })
    return reply.status(201).send({ success: true, data: branch })
  })

  sub.patch<{ Params: { id: string } }>('/api/branches/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { z } = await import('zod')
    const schema = z.object({ name: z.string().min(1).optional(), address: z.string().optional(), phone: z.string().optional(), isActive: z.boolean().optional() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    const branch = await request.tenantDb.branch.update({
      where: { id: request.params.id },
      data: parsed.data,
    })
    return reply.send({ success: true, data: branch })
  })
})

const start = async () => {
  try {
    await app.listen({ port: config.API_PORT, host: config.API_HOST })
    console.log(`Server running on port ${config.API_PORT}`)

    // Start background workers
    startEtaWorker()
    startDunningWorker()
    await scheduleDunning()
    startReminderWorker()
    await scheduleReminders()
    startTrialExpiryWorker()
    await scheduleTrialExpiry()
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
