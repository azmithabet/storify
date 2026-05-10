import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { config } from './config/env'
import { masterDb } from './config/database'
import { redis } from './config/redis'
import jwtPlugin from './shared/plugins/jwt.plugin'
import cookiePlugin from './shared/plugins/cookie.plugin'
import { tenantMiddleware } from './shared/middleware/tenant.middleware'
import { tenantRoutes } from './modules/tenants/tenant.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { productRoutes } from './modules/products/product.routes'
import { stockRoutes } from './modules/stock/stock.routes'

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

app.get('/plans', async (_req, reply) => {
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
})

const start = async () => {
  try {
    await app.listen({ port: config.API_PORT, host: config.API_HOST })
    console.log(`Server running on port ${config.API_PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
