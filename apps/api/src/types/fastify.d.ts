import type { TenantPrismaClient, Tenant, Plan } from '@storify/database'
import type { JWTPayload } from '../shared/middleware/auth.middleware'

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Tenant & { plan: Plan }
    tenantDb: TenantPrismaClient
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
    user: JWTPayload
  }
}
