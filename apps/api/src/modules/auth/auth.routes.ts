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
}
