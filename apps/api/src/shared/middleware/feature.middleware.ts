import { FastifyRequest, FastifyReply } from 'fastify'

export function requireFeature(feature: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const features = request.tenant?.plan?.features as Record<string, unknown> | undefined

    if (!features || !features[feature]) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'feature_not_available',
          message: 'هذه الميزة غير متاحة في باقتك الحالية',
        },
      })
    }
  }
}
