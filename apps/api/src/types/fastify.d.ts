import type { PrismaClient, Tenant, Plan } from '@storify/database'

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Tenant & { plan: Plan }
    tenantDb: PrismaClient // will be TenantPrismaClient after Step 05
  }
}
