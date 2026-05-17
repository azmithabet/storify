import type { TenantPrismaClient, Tenant, Plan } from '@storify/database'
import type { JWTPayload } from '../shared/middleware/auth.middleware'
import type { PlatformJWTPayload } from '../shared/middleware/platform-admin.middleware'

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Tenant & { plan: Plan }
    tenantDb: TenantPrismaClient
  }
}

// Two issuers share the same signing secret/plugin: tenant users and platform
// admins. Discriminator is `scope` on the platform side; tenant payloads carry
// `tenantId`. Each consumer narrows before use (auth.middleware vs
// platform-admin.middleware).
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload | PlatformJWTPayload
    user: JWTPayload | PlatformJWTPayload
  }
}
