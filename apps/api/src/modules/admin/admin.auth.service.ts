import { randomBytes } from 'crypto'
import { masterDb } from '../../config/database'
import { redis } from '../../config/redis'
import { hashPassword, verifyPassword } from '../../shared/utils/password'
import type { PlatformJWTPayload } from '../../shared/middleware/platform-admin.middleware'

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60

export interface AdminLoginResult {
  payload: PlatformJWTPayload
  refreshToken: string
  admin: {
    id: string
    email: string
    fullName: string
    role: 'OWNER' | 'ADMIN'
  }
}

export async function loginPlatformAdmin(email: string, password: string): Promise<AdminLoginResult> {
  const admin = await masterDb.platformAdmin.findUnique({ where: { email } })

  const invalid = () => {
    const err = new Error('invalid_credentials') as Error & { statusCode: number }
    err.statusCode = 401
    return err
  }

  if (!admin || !admin.isActive) throw invalid()

  const valid = await verifyPassword(password, admin.passwordHash)
  if (!valid) throw invalid()

  await masterDb.platformAdmin.update({
    where: { id: admin.id },
    data: { lastLogin: new Date() },
  })

  const payload: PlatformJWTPayload = {
    scope: 'platform',
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
  }

  const refreshToken = randomBytes(32).toString('hex')
  await redis.set(
    `platform_refresh:${refreshToken}`,
    JSON.stringify({ adminId: admin.id }),
    'EX',
    REFRESH_TTL_SECONDS,
  )

  return {
    payload,
    refreshToken,
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
    },
  }
}

export async function getPlatformRefreshTokenData(token: string): Promise<{ adminId: string } | null> {
  const raw = await redis.get(`platform_refresh:${token}`)
  return raw ? (JSON.parse(raw) as { adminId: string }) : null
}

export async function rotatePlatformRefreshToken(oldToken: string, data: { adminId: string }): Promise<string> {
  await redis.del(`platform_refresh:${oldToken}`)
  const newToken = randomBytes(32).toString('hex')
  await redis.set(`platform_refresh:${newToken}`, JSON.stringify(data), 'EX', REFRESH_TTL_SECONDS)
  return newToken
}

export async function invalidatePlatformRefreshToken(token: string): Promise<void> {
  await redis.del(`platform_refresh:${token}`)
}

// ─── Owner seeding from env vars ─────────────────────────────────────────────
// Idempotent. Called from `start()` on every boot:
//  - First run: create OWNER row with bcrypt-hashed OWNER_PASSWORD.
//  - Subsequent runs: no-op unless OWNER_PASSWORD changed (then update hash).
// Silently skips if OWNER_EMAIL or OWNER_PASSWORD are unset (dev convenience).
export async function seedOwnerFromEnv(): Promise<void> {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase()
  const password = process.env.OWNER_PASSWORD
  const fullName = process.env.OWNER_NAME?.trim() || 'Platform Owner'

  if (!email || !password) return

  const existing = await masterDb.platformAdmin.findUnique({ where: { email } })

  if (!existing) {
    const passwordHash = await hashPassword(password)
    await masterDb.platformAdmin.create({
      data: { email, passwordHash, fullName, role: 'OWNER', isActive: true },
    })
    console.log(`[seed] Platform owner created: ${email}`)
    return
  }

  // If env password no longer matches the stored hash, rotate it. Lets you
  // recover access by just changing OWNER_PASSWORD and redeploying.
  const matches = await verifyPassword(password, existing.passwordHash)
  if (!matches) {
    const passwordHash = await hashPassword(password)
    await masterDb.platformAdmin.update({
      where: { id: existing.id },
      data: { passwordHash, role: 'OWNER', isActive: true, fullName },
    })
    console.log(`[seed] Platform owner password rotated: ${email}`)
  }
}
