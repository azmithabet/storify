import fs from 'fs/promises'
import path from 'path'
import { PrismaClient } from './generated/client'
import { masterDb } from './prisma'

const MIGRATIONS_DIR = path.join(__dirname, '../migrations/tenant')

interface Migration {
  version: number
  name: string
  sql: string
}

async function loadMigrations(): Promise<Migration[]> {
  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  return Promise.all(
    files.map(async (f) => ({
      version: parseInt(f.split('_')[0], 10),
      name: f,
      sql: await fs.readFile(path.join(MIGRATIONS_DIR, f), 'utf8'),
    })),
  )
}

function createTenantClient(schemaName: string): PrismaClient {
  const base = new URL(process.env.DATABASE_MASTER_URL!)
  base.searchParams.set('schema', schemaName)
  return new PrismaClient({ datasources: { db: { url: base.toString() } } })
}

export async function runTenantMigrations(schemaName: string, tenantId: string): Promise<void> {
  const tenant = await masterDb.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new Error(`tenant_not_found:${tenantId}`)

  const migrations = await loadMigrations()
  const pending = migrations.filter((m) => m.version > tenant.schemaVersion)

  for (const m of pending) {
    const sql = m.sql.trim()
    if (!sql) {
      // Empty placeholder — skip execution but don't bump schema_version
      console.log(`⏭  tenant=${schemaName} migration=${m.name} skipped (empty)`)
      continue
    }

    // Split into individual statements — $executeRawUnsafe rejects multi-statement strings
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const db = createTenantClient(schemaName)
    try {
      for (const stmt of statements) {
        await db.$executeRawUnsafe(stmt)
      }
      await masterDb.tenant.update({
        where: { id: tenantId },
        data: { schemaVersion: m.version },
      })
      console.log(`✅ tenant=${schemaName} migration=${m.name} applied`)
    } finally {
      await db.$disconnect()
    }
  }
}

export async function migrateAllTenants(): Promise<{
  ok: number
  failed: number
  errors: Array<{ tenantId: string; err: string }>
}> {
  const tenants = await masterDb.tenant.findMany({
    where: { status: { in: ['ACTIVE', 'SUSPENDED'] } },
  })

  const results = { ok: 0, failed: 0, errors: [] as Array<{ tenantId: string; err: string }> }

  for (const t of tenants) {
    try {
      await runTenantMigrations(t.schemaName, t.id)
      results.ok++
    } catch (err) {
      results.failed++
      results.errors.push({ tenantId: t.id, err: String(err) })
      console.error(`❌ tenant=${t.schemaName} migration failed:`, err)
    }
  }

  return results
}
