export { masterDb } from './prisma'
export { PrismaClient } from './generated/client'
export type { Plan, Tenant, Subscription, PaymentAttempt } from './generated/client'
export { runTenantMigrations, migrateAllTenants } from './migrate-tenants'

// Tenant schema client (Step 04+)
export { PrismaClient as TenantPrismaClient } from './generated/tenant'
export type { User, Role, Branch, PasswordResetToken } from './generated/tenant'
