import Fastify from 'fastify'
import { config } from './config/env'
import { masterDb } from './config/database'
import { tenantRoutes } from './modules/tenants/tenant.routes'

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

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
