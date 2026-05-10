import { PrismaClient } from './generated/client'

const globalForPrisma = globalThis as unknown as { masterDb: PrismaClient }

export const masterDb =
  globalForPrisma.masterDb ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.masterDb = masterDb
}
