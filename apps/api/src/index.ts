import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
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
import { adminRoutes } from './modules/admin/admin.routes'
import { seedOwnerFromEnv } from './modules/admin/admin.auth.service'
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

// ─── Global plugins (CORS is NOT global — see apiContext below) ──────────────
// CORS is registered inside the apiContext encapsulation so it only gates the
// API routes. Static assets served by fastifyStatic must bypass CORS, otherwise
// browsers get 500s on /assets/*.js when accessing the app from a domain that
// isn't in FRONTEND_URL / APP_BASE_DOMAIN (e.g. Railway's *.up.railway.app).
app.register(sentryPlugin)
app.register(jwtPlugin)
app.register(cookiePlugin)
// Security headers. CSP is disabled because we serve the Vite-built SPA from
// the same origin and inline styles/scripts are unavoidable without rework.
app.register(helmet, { contentSecurityPolicy: false })
app.register(rateLimit, {
  global: false, // opt-in per-route via config.rateLimit
  redis,
})

// Global error handler — never leak stack traces or internal messages in
// production. Fastify validation errors keep their message; other errors are
// normalized to `{ success: false, error: { code, message } }`.
app.setErrorHandler((error, request, reply) => {
  const status =
    typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500

  if (status >= 500) {
    request.log.error({ err: error, url: request.url }, 'unhandled_error')
  }

  // Fastify schema validation errors come back with a `validation` array.
  if ((error as { validation?: unknown[] }).validation) {
    return reply.status(400).send({
      success: false,
      error: { code: 'validation_error', message: error.message },
    })
  }

  // Rate-limit plugin reports 429 with its own message.
  if (status === 429) {
    return reply.status(429).send({
      success: false,
      error: { code: 'rate_limited', message: error.message || 'Too many requests' },
    })
  }

  if (status >= 500) {
    return reply.status(status).send({
      success: false,
      error: {
        code: 'internal_error',
        message: config.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      },
    })
  }

  return reply.status(status).send({
    success: false,
    error: { code: (error as { code?: string }).code ?? 'error', message: error.message },
  })
})

// ─── Public routes (no tenant required) ──────────────────────────────────────
app.get('/health', async () => {
  return { status: 'ok', env: config.NODE_ENV, timestamp: new Date().toISOString() }
})

// ─── API surface — CORS registered here so static assets bypass it ──────────
app.register(async function apiContext(api) {
  await api.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // server-to-server / curl
      const baseDomain = config.APP_BASE_DOMAIN
      const allowed =
        origin === config.FRONTEND_URL ||
        (baseDomain && (origin === `https://${baseDomain}` || origin.endsWith(`.${baseDomain}`))) ||
        (config.NODE_ENV === 'development' && /^https?:\/\/localhost(:\d+)?$/.test(origin))
      cb(allowed ? null : new Error('CORS: origin not allowed'), allowed ?? false)
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Subdomain'],
  })

  // also expose under /api/plans so the Vite proxy (/api → :3000) works
  api.get('/plans', async (_req, reply) => {
    const plans = await masterDb.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return reply.send({ data: plans })
  })
  api.get('/api/plans', async (_req, reply) => {
    const plans = await masterDb.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return reply.send({ data: plans })
  })

  api.register(tenantRoutes, { prefix: '/api/tenants' })

  // ─── Platform-owner admin panel (cross-tenant, no tenant scoping) ────────
  api.register(adminRoutes, { prefix: '/api/admin' })

  // ─── Tenant-scoped routes (tenant middleware required) ──────────────────────
  api.register(async function tenantScoped(sub) {
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
}) // close apiContext

// ─── Serve React frontend in production ──────────────────────────────────────
if (config.NODE_ENV === 'production') {
  // __dirname is /app/apps/api/src; go up 3 levels to workspace root then into web dist
  const webDist = join(__dirname, '../../../apps/web/dist')
  app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false })
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({ success: false, error: { code: 'not_found' } })
    }
    return reply.sendFile('index.html', webDist)
  })
}

const start = async () => {
  try {
    // Idempotent — seeds OWNER from env vars on first boot, rotates password
    // if OWNER_PASSWORD changed. No-op when env vars are unset (dev).
    await seedOwnerFromEnv()

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
