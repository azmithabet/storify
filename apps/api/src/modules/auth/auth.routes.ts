import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { config } from '../../config/env'
import {
  loginUser,
  getRefreshTokenData,
  rotateRefreshToken,
  invalidateRefreshToken,
  requestPasswordReset,
  resetPassword,
  checkForgotPasswordRateLimit,
} from './auth.service'
import { authenticate, requirePermission } from '../../shared/middleware/auth.middleware'
import type { JWTPayload } from '../../shared/middleware/auth.middleware'

const REFRESH_COOKIE = 'refreshToken'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const forgotSchema = z.object({ email: z.string().email() })

const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
})

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export async function authRoutes(app: FastifyInstance) {
  // ─── POST /api/auth/login ─────────────────────────────────────────────────
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: 60_000 } },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }

    try {
      const { email, password } = parsed.data
      const result = await loginUser(
        request.tenantDb,
        request.tenant.id,
        request.tenant.schemaName,
        email,
        password,
      )

      const accessToken = await reply.jwtSign(result.payload)

      reply.setCookie(REFRESH_COOKIE, result.refreshToken, cookieOpts(COOKIE_MAX_AGE))

      return reply.status(200).send({
        success: true,
        data: { accessToken, user: result.user },
      })
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number }
      if (error.message === 'invalid_credentials') {
        return reply.status(401).send({
          success: false,
          error: { code: 'invalid_credentials', message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        })
      }
      app.log.error(err)
      return reply.status(500).send({ success: false, error: { code: 'internal_error', message: 'خطأ داخلي' } })
    }
  })

  // ─── POST /api/auth/refresh ───────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE]
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: { code: 'no_refresh_token', message: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' },
      })
    }

    const data = await getRefreshTokenData(token)
    if (!data) {
      reply.clearCookie(REFRESH_COOKIE, { path: '/' })
      return reply.status(401).send({
        success: false,
        error: { code: 'invalid_refresh_token', message: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' },
      })
    }

    // Look up fresh user data to build the payload
    const user = await request.tenantDb.user.findUnique({
      where: { id: data.userId },
      include: { role: true },
    })

    if (!user || !user.isActive) {
      await invalidateRefreshToken(token)
      reply.clearCookie(REFRESH_COOKIE, { path: '/' })
      return reply.status(401).send({
        success: false,
        error: { code: 'user_inactive', message: 'الحساب غير مفعّل' },
      })
    }

    const payload: JWTPayload = {
      userId: user.id,
      tenantId: data.tenantId,
      schemaName: data.schemaName,
      roleSlug: user.role.slug,
      branchId: user.branchId ?? '',
      permissions: (user.role.permissions as Record<string, string[]>) ?? {},
    }

    const accessToken = await reply.jwtSign(payload)
    const newRefreshToken = await rotateRefreshToken(token, data)

    reply.setCookie(REFRESH_COOKIE, newRefreshToken, cookieOpts(COOKIE_MAX_AGE))

    return reply.status(200).send({ success: true, data: { accessToken } })
  })

  // ─── POST /api/auth/logout ────────────────────────────────────────────────
  app.post('/logout', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE]
    if (token) await invalidateRefreshToken(token)
    reply.clearCookie(REFRESH_COOKIE, { path: '/' })
    return reply.status(200).send({ success: true })
  })

  // ─── POST /api/auth/forgot-password ──────────────────────────────────────
  app.post('/forgot-password', async (request, reply) => {
    const parsed = forgotSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(200).send({ success: true }) // never reveal anything
    }

    const { email } = parsed.data
    const allowed = await checkForgotPasswordRateLimit(email)
    if (!allowed) {
      return reply.status(429).send({
        success: false,
        error: { code: 'rate_limited', message: 'تم تجاوز الحد المسموح. حاول بعد ساعة.' },
      })
    }

    const ip = request.ip
    const subdomain = request.tenant.subdomain

    // Fire and forget — always return 200
    requestPasswordReset(request.tenantDb, subdomain, email, ip).catch((err) =>
      app.log.error({ err }, 'forgot-password: requestPasswordReset failed'),
    )

    return reply.status(200).send({ success: true })
  })

  // ─── POST /api/auth/reset-password ───────────────────────────────────────
  app.post('/reset-password', async (request, reply) => {
    const parsed = resetSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: parsed.error.errors[0].message },
      })
    }

    try {
      await resetPassword(request.tenantDb, parsed.data.token, parsed.data.newPassword)
      return reply.status(200).send({ success: true })
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number }
      if (error.message === 'invalid_or_expired_token') {
        return reply.status(400).send({
          success: false,
          error: { code: 'invalid_or_expired_token', message: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية' },
        })
      }
      app.log.error(err)
      return reply.status(500).send({ success: false, error: { code: 'internal_error', message: 'خطأ داخلي' } })
    }
  })

  // ─── GET /api/auth/users — list all tenant users ─────────────────────────
  app.get('/users', { preHandler: [authenticate, requirePermission('users', 'read')] }, async (request, reply) => {
    const users = await request.tenantDb.user.findMany({
      include: { role: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLogin: u.lastLogin,
        branchId: u.branchId,
      })),
    })
  })

  // ─── POST /api/auth/users — create a new tenant user ─────────────────────
  const createUserSchema = z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    roleId: z.string().uuid(),
    branchId: z.string().uuid().optional(),
  })

  app.post('/users', { preHandler: [authenticate, requirePermission('users', 'create')] }, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const { fullName, email, password, roleId, branchId } = parsed.data
    const existing = await request.tenantDb.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({ success: false, error: { code: 'conflict', message: 'البريد الإلكتروني مستخدم بالفعل' } })
    }
    const { hashPassword } = await import('../../shared/utils/password')
    const passwordHash = await hashPassword(password)
    const user = await request.tenantDb.user.create({
      data: { fullName, email, passwordHash, roleId, branchId: branchId ?? null },
      include: { role: { select: { id: true, name: true, slug: true } } },
    })
    return reply.status(201).send({
      success: true,
      data: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, isActive: user.isActive },
    })
  })

  // ─── GET /api/auth/roles — list available roles ───────────────────────────
  app.get('/roles', { preHandler: [authenticate] }, async (request, reply) => {
    const roles = await request.tenantDb.role.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    })
    return reply.send({ success: true, data: roles })
  })

  // ─── PATCH /api/auth/me/password — change own password ───────────────────
  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  })

  app.patch('/me/password', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as import('../../shared/middleware/auth.middleware').JWTPayload
    const parsed = changePasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }

    const { verifyPassword, hashPassword } = await import('../../shared/utils/password')
    const dbUser = await request.tenantDb.user.findUnique({ where: { id: user.userId } })
    if (!dbUser) {
      return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'المستخدم غير موجود' } })
    }

    const valid = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash)
    if (!valid) {
      return reply.status(401).send({ success: false, error: { code: 'wrong_password', message: 'كلمة المرور الحالية غير صحيحة' } })
    }

    const passwordHash = await hashPassword(parsed.data.newPassword)
    await request.tenantDb.user.update({ where: { id: user.userId }, data: { passwordHash } })

    return reply.send({ success: true })
  })

  // ─── GET /api/auth/audit-logs — paginated audit log viewer ───────────────
  const auditQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    entity: z.string().optional(),
    action: z.string().optional(),
    actorId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  })

  app.get('/audit-logs', { preHandler: [authenticate, requirePermission('users', 'read')] }, async (request, reply) => {
    const parsed = auditQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'validation_error', message: parsed.error.errors[0].message } })
    }
    const { page, limit, entity, action, actorId, from, to } = parsed.data

    const where = {
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
        },
      } : {}),
    }

    const [logs, total] = await Promise.all([
      request.tenantDb.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      request.tenantDb.auditLog.count({ where }),
    ])

    return reply.send({
      success: true,
      data: logs,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  })
}
