import type { FastifyRequest, FastifyReply } from 'fastify'
import { masterDb } from '../../config/database'

export interface PlatformJWTPayload {
  scope: 'platform'
  adminId: string
  email: string
  role: 'OWNER' | 'ADMIN'
}

declare module 'fastify' {
  interface FastifyRequest {
    platformAdmin?: {
      id: string
      email: string
      fullName: string
      role: 'OWNER' | 'ADMIN'
    }
  }
}

export async function authenticatePlatformAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'unauthorized', message: 'يجب تسجيل الدخول كمسؤول منصة' },
    })
  }

  const payload = request.user as Partial<PlatformJWTPayload>
  if (payload?.scope !== 'platform' || !payload.adminId) {
    return reply.status(403).send({
      success: false,
      error: { code: 'wrong_token_scope', message: 'رمز غير صالح لهذا القسم' },
    })
  }

  const admin = await masterDb.platformAdmin.findUnique({ where: { id: payload.adminId } })
  if (!admin || !admin.isActive) {
    return reply.status(401).send({
      success: false,
      error: { code: 'admin_inactive', message: 'الحساب غير مفعّل' },
    })
  }

  request.platformAdmin = {
    id: admin.id,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
  }
}

export function requireOwner() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.platformAdmin?.role !== 'OWNER') {
      return reply.status(403).send({
        success: false,
        error: { code: 'owner_only', message: 'هذا الإجراء متاح للمالك فقط' },
      })
    }
  }
}
