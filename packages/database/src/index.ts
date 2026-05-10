export { masterDb } from './prisma'
export { PrismaClient } from './generated/client'
export type { Plan, Tenant, Subscription, PaymentAttempt } from './generated/client'
export { runTenantMigrations, migrateAllTenants } from './migrate-tenants'
