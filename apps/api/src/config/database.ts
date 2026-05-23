import { PrismaClient, TenantPrismaClient } from '@hesba/database'
import { LRUCache } from 'lru-cache'
import { config } from './env'

// Master DB — single instance for the API server lifetime
export const masterDb = new PrismaClient({
  datasources: { db: { url: config.DATABASE_MASTER_URL } },
  log: config.NODE_ENV === 'development' ? ['error'] : ['error'],
})

// Tenant clients — LRU-evicted pool.
// Each TenantPrismaClient holds ~10 connections; unbounded Map would exhaust PG's max_connections.
const tenantClients = new LRUCache<string, TenantPrismaClient>({
  max: 50,
  ttl: 1000 * 60 * 30, // 30 min idle TTL
  updateAgeOnGet: true,
  dispose: (client) => {
    client.$disconnect().catch(() => {})
  },
})

export function getTenantDb(schemaName: string): TenantPrismaClient {
  const cached = tenantClients.get(schemaName)
  if (cached) return cached

  const base = new URL(config.DATABASE_MASTER_URL)
  base.searchParams.set('schema', schemaName)
  const client = new TenantPrismaClient({ datasources: { db: { url: base.toString() } } })
  tenantClients.set(schemaName, client)
  return client
}
