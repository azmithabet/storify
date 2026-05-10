import { masterDb } from '../../config/database'
import { getTenantDb } from '../../config/database'
import { runTenantMigrations } from '@storify/database'
import { hashPassword } from '../../shared/utils/password'
import type { RegisterTenantInput } from './tenant.schema'

const SUPER_ADMIN_PERMISSIONS: Record<string, string[]> = {
  invoices: ['create', 'read', 'update', 'delete', 'refund'],
  products: ['create', 'read', 'update', 'delete'],
  stock: ['read', 'adjust', 'transfer'],
  customers: ['create', 'read', 'update', 'delete'],
  installments: ['create', 'read', 'update', 'approve', 'reject'],
  suppliers: ['create', 'read', 'update', 'delete'],
  purchase_orders: ['create', 'read', 'update', 'approve', 'receive'],
  expenses: ['create', 'read', 'update', 'approve', 'delete'],
  reports: ['read', 'export'],
  users: ['create', 'read', 'update', 'delete'],
  settings: ['read', 'update'],
  billing: ['read', 'update'],
}

async function seedTenantDefaults(
  schemaName: string,
  ownerName: string,
  ownerEmail: string,
  ownerPassword: string,
): Promise<void> {
  const db = getTenantDb(schemaName)

  // 1. Create super_admin role
  const role = await db.role.create({
    data: {
      slug: 'super_admin',
      name: 'Super Admin',
      permissions: SUPER_ADMIN_PERMISSIONS,
    },
  })

  // 2. Create main branch
  const branch = await db.branch.create({
    data: { name: 'الفرع الرئيسي', isMain: true, isActive: true },
  })

  // 3. Create super_admin user with bcrypt-hashed password
  const passwordHash = await hashPassword(ownerPassword)
  await db.user.create({
    data: {
      email: ownerEmail,
      passwordHash,
      fullName: ownerName,
      roleId: role.id,
      branchId: branch.id,
      isActive: true,
    },
  })
}

export async function provisionTenant(data: RegisterTenantInput) {
  const schemaName = `tenant_${data.subdomain.replace(/-/g, '_')}`

  // 1. Check subdomain availability
  const existing = await masterDb.tenant.findUnique({ where: { subdomain: data.subdomain } })
  if (existing) {
    const err = new Error('subdomain_taken') as Error & { statusCode: number }
    err.statusCode = 409
    throw err
  }

  // 2. Resolve plan
  const plan = await masterDb.plan.findUnique({ where: { slug: data.planSlug } })
  if (!plan) {
    const err = new Error('plan_not_found') as Error & { statusCode: number }
    err.statusCode = 400
    throw err
  }

  // 3. Create tenant row (status: PROVISIONING)
  const tenant = await masterDb.tenant.create({
    data: {
      name: data.name,
      subdomain: data.subdomain,
      schemaName,
      schemaVersion: 0,
      email: data.ownerEmail,
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail,
      planId: plan.id,
      status: 'PROVISIONING',
    },
  })

  try {
    // 4. Create PostgreSQL schema
    await masterDb.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

    // 5. Run tenant migrations (001_init.sql creates auth tables, schema_version → 1)
    await runTenantMigrations(schemaName, tenant.id)

    // 6. Seed roles, main branch, and super_admin user
    await seedTenantDefaults(schemaName, data.ownerName, data.ownerEmail, data.ownerPassword)

    // 7. Activate tenant
    await masterDb.tenant.update({
      where: { id: tenant.id },
      data: { status: 'ACTIVE' },
    })
  } catch (err) {
    // Roll back master row on provisioning failure
    await masterDb.tenant.delete({ where: { id: tenant.id } }).catch(() => {})
    await masterDb.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => {})
    throw err
  }

  return {
    id: tenant.id,
    subdomain: tenant.subdomain,
    schemaName: tenant.schemaName,
  }
}
