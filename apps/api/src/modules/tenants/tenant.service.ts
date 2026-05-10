import { masterDb } from '../../config/database'
import { runTenantMigrations } from '@storify/database'
import type { RegisterTenantInput } from './tenant.schema'

// Placeholder — will be fully implemented in Step 05 (all 34 tenant tables)
async function seedTenantDefaults(
  _schemaName: string,
  _ownerName: string,
  _ownerEmail: string,
  _ownerPassword: string,
): Promise<void> {
  // Step 05 fills this in with roles, branch, users, payment methods, etc.
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

    // 5. Run tenant migrations (empty in Step 03 — schema_version stays 0)
    await runTenantMigrations(schemaName, tenant.id)

    // 6. Seed tenant defaults (no-op in Step 03)
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
