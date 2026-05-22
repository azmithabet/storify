import { FastifyRequest, FastifyReply } from 'fastify'
import { masterDb, getTenantDb } from '../../config/database'
import { redis } from '../../config/redis'
import { config } from '../../config/env'

const SYSTEM_HOSTS = new Set(['admin', 'www', 'api', 'localhost', '127.0.0.1'])
const CACHE_TTL_SECONDS = 300 // 5 minutes
const SUB_CACHE_TTL_SECONDS = 30 // short TTL so status changes propagate quickly

// Auth + billing routes work regardless of subscription status
const SUBSCRIPTION_EXEMPT_PREFIXES = ['/api/auth/', '/api/billing/']

export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // strip port if present (e.g. "localhost:3000" → "localhost")
  const hostname = request.hostname.split(':')[0]
  const baseDomain = config.APP_BASE_DOMAIN

  // Resolve subdomain relative to the platform base domain when configured.
  // Without this, a request to the bare platform host (e.g. "hesbaapp.com") was
  // treated as if "hesbaapp" were a tenant subdomain — causing 404s on /api/auth/*
  // and every other tenant-scoped route from the marketing/login page.
  let subdomain: string
  if (baseDomain && hostname === baseDomain) {
    // Bare platform domain — no tenant prefix; rely on X-Tenant-Subdomain header.
    subdomain = ''
  } else if (baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    // <subdomain>.<baseDomain> — strip the suffix and take the first remaining label.
    const prefix = hostname.slice(0, -(baseDomain.length + 1))
    subdomain = prefix.split('.')[0]
  } else {
    // Dev (localhost), IPs, Railway internal host, or APP_BASE_DOMAIN not configured —
    // fall back to the original first-label heuristic.
    subdomain = hostname.split('.')[0]
  }

  // In dev (and on the bare platform domain) the frontend sends the tenant via header.
  if (SYSTEM_HOSTS.has(subdomain) || !subdomain) {
    const header = request.headers['x-tenant-subdomain']
    subdomain = Array.isArray(header) ? header[0] : (header ?? '')
  }

  // Tenant-scoped routes require a tenant context. Falling through silently
  // would leave `request.tenant` / `request.tenantDb` undefined and the
  // downstream handler would crash on first access (the global error handler
  // would then mask it as a generic 500). Return an explicit 400 instead so
  // callers get a useful error and so this can't be misread as a "feature".
  if (!subdomain || SYSTEM_HOSTS.has(subdomain)) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'tenant_required',
        message: 'يلزم تحديد المتجر (subdomain) للوصول إلى هذا المسار',
      },
    })
  }

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

  // ─── Subscription enforcement ─────────────────────────────────────────────
  const isExempt = SUBSCRIPTION_EXEMPT_PREFIXES.some((p) => request.url.startsWith(p))
  if (!isExempt) {
    const subCacheKey = `sub:status:${tenant.id}`
    let subStatus = await redis.get(subCacheKey)

    if (!subStatus) {
      const sub = await masterDb.subscription.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      })
      subStatus = sub?.status ?? 'NONE'
      await redis.setex(subCacheKey, SUB_CACHE_TTL_SECONDS, subStatus)
    }

    if (subStatus === 'SUSPENDED' || subStatus === 'CANCELLED') {
      return reply.status(402).send({
        success: false,
        error: {
          code: 'subscription_inactive',
          message: 'الاشتراك معلق أو ملغى. يرجى تجديد الاشتراك للمتابعة.',
          subscriptionStatus: subStatus,
        },
      })
    }
  }
}
