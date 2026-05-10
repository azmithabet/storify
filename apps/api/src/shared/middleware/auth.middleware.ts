import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JWTPayload {
  userId: string
  tenantId: string
  schemaName: string
  roleSlug: string
  branchId: string
  permissions: Record<string, string[]>
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'unauthorized', message: 'يجب تسجيل الدخول أولاً' },
    })
  }
}

export function requirePermission(resource: string, action: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JWTPayload

    if (user.roleSlug === 'super_admin') return

    if (!user.permissions[resource]?.includes(action)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'forbidden',
          message: 'ليس لديك صلاحية للقيام بهذا الإجراء',
          required: `${resource}:${action}`,
        },
      })
    }
  }
}
