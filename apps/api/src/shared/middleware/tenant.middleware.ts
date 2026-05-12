import { FastifyRequest, FastifyReply } from 'fastify'
import { masterDb, getTenantDb } from '../../config/database'
import { redis } from '../../config/redis'

const SYSTEM_HOSTS = new Set(['admin', 'www', 'api', 'localhost', '127.0.0.1'])
const CACHE_TTL_SECONDS = 300 // 5 minutes

export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const hostname = request.hostname
  let subdomain = hostname.split('.')[0]

  // In dev the frontend runs on localhost — fall back to the X-Tenant-Subdomain header
  if (SYSTEM_HOSTS.has(subdomain) || !subdomain) {
    const header = request.headers['x-tenant-subdomain']
    subdomain = Array.isArray(header) ? header[0] : (header ?? '')
  }

  if (!subdomain || SYSTEM_HOSTS.has(subdomain)) return

  const cacheKey = `tenant:${subdomain}`

  // Check Redis cache first
  const cached = await redis.get(cacheKey)
  let tenant = cached ? JSON.parse(cached) : null

  if (!tenant) {
    tenant = await masterDb.tenant.findUnique({
      where: { subdomain },
      include: { plan: true },
    })

    if (tenant) {
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(tenant))
    }
  }

  if (!tenant || tenant.status !== 'ACTIVE') {
    return reply.status(404).send({
      success: false,
      error: { code: 'tenant_not_found', message: 'المتجر غير موجود' },
    })
  }

  request.tenant = tenant
  request.tenantDb = getTenantDb(tenant.schemaName)
}
