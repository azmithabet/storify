import { createHash, randomBytes } from 'crypto'
import type { TenantPrismaClient } from '@storify/database'
import { redis } from '../../config/redis'
import { verifyPassword } from '../../shared/utils/password'
import { sendPasswordResetEmail } from '../../shared/utils/email'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 // 7 days in seconds

// ─── Login ───────────────────────────────────────────────────────────────────

export interface LoginResult {
  payload: JWTPayload
  refreshToken: string
  user: { id: string; email: string; fullName: string; roleSlug: string }
}

export async function loginUser(
  db: TenantPrismaClient,
  tenantId: string,
  schemaName: string,
  email: string,
  password: string,
): Promise<LoginResult> {
  const user = await db.user.findUnique({
    where: { email },
    include: { role: true },
  })

  const invalid = () => {
    const err = new Error('invalid_credentials') as Error & { statusCode: number }
    err.statusCode = 401
    return err
  }

  if (!user || !user.isActive) throw invalid()

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw invalid()

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const payload: JWTPayload = {
    userId: user.id,
    tenantId,
    schemaName,
    roleSlug: user.role.slug,
    branchId: user.branchId ?? '',
    permissions: (user.role.permissions as Record<string, string[]>) ?? {},
  }

  // Opaque refresh token stored in Redis (true invalidation on logout)
  const refreshToken = randomBytes(32).toString('hex')
  await redis.set(
    `refresh:${refreshToken}`,
    JSON.stringify({ userId: user.id, tenantId, schemaName }),
    'EX',
    REFRESH_TOKEN_TTL,
  )

  return {
    payload,
    refreshToken,
    user: { id: user.id, email: user.email, fullName: user.fullName, roleSlug: user.role.slug },
  }
}

// ─── Refresh ─────────────────────────────────────────────────────────────────

export interface RefreshTokenData {
  userId: string
  tenantId: string
  schemaName: string
}

export async function getRefreshTokenData(refreshToken: string): Promise<RefreshTokenData | null> {
  const raw = await redis.get(`refresh:${refreshToken}`)
  if (!raw) return null
  return JSON.parse(raw) as RefreshTokenData
}

export async function rotateRefreshToken(
  oldToken: string,
  data: RefreshTokenData,
): Promise<string> {
  await redis.del(`refresh:${oldToken}`)
  const newToken = randomBytes(32).toString('hex')
  await redis.set(
    `refresh:${newToken}`,
    JSON.stringify(data),
    'EX',
    REFRESH_TOKEN_TTL,
  )
  return newToken
}

export async function invalidateRefreshToken(refreshToken: string): Promise<void> {
  await redis.del(`refresh:${refreshToken}`)
}

// ─── Forgot / Reset password ─────────────────────────────────────────────────

export async function requestPasswordReset(
  db: TenantPrismaClient,
  subdomain: string,
  email: string,
  ip: string,
): Promise<void> {
  const user = await db.user.findUnique({ where: { email } })
  // Always return without error — never reveal whether the email exists
  if (!user || !user.isActive) return

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      ip,
    },
  })

  await sendPasswordResetEmail({ to: user.email, subdomain, rawToken })
}

export async function resetPassword(
  db: TenantPrismaClient,
  rawToken: string,
  newPassword: string,
): Promise<void> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    const err = new Error('invalid_or_expired_token') as Error & { statusCode: number }
    err.statusCode = 400
    throw err
  }

  const { hashPassword } = await import('../../shared/utils/password')
  const passwordHash = await hashPassword(newPassword)

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])
}

// ─── Rate limit: forgot-password (5/hour/email, Redis-backed) ────────────────

export async function checkForgotPasswordRateLimit(email: string): Promise<boolean> {
  const key = `rate:forgot:${email.toLowerCase()}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, 3600)
  return count <= 5
}
