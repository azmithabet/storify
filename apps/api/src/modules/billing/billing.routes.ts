import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requirePermission } from '@/shared/middleware/auth.middleware'
import { verifyPaymobWebhook, type PaymobWebhookPayload } from './paymob.webhook'
import {
  startCheckout,
  cancelSubscription,
  handleWebhookSuccess,
  handleWebhookFailure,
} from './billing.service'
import { masterDb } from '@/config/database'

const checkoutSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string(),
})

export async function billingRoutes(app: FastifyInstance) {
  app.post(
    '/billing/checkout',
    { preHandler: [authenticate, requirePermission('billing', 'create')] },
    async (request, reply) => {
      const body = checkoutSchema.parse(request.body)
      const tenantId = request.tenant!.id

      const result = await startCheckout(tenantId, {
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email,
        phone_number: body.phone,
        country: 'EG',
        city: 'Cairo',
        state: 'Cairo',
        street: 'N/A',
        building: 'N/A',
        floor: 'N/A',
        apartment: 'N/A',
      })

      return reply.send(result)
    },
  )

  // Paymob webhook — no auth, verified via HMAC
  app.post('/billing/paymob/webhook', async (request, reply) => {
    const hmac = (request.query as Record<string, string>).hmac
    if (!hmac) return reply.code(400).send({ message: 'missing_hmac' })

    const payload = request.body as PaymobWebhookPayload
    const isValid = verifyPaymobWebhook(payload, hmac)
    if (!isValid) {
      console.warn('[Paymob] HMAC verification failed')
      return reply.code(401).send({ message: 'invalid_hmac' })
    }

    const obj = payload.obj
    const merchantOrderId = obj.order?.merchant_order_id ?? ''

    if (obj.success && !obj.is_refunded && !obj.is_voided) {
      await handleWebhookSuccess({
        orderId: obj.order?.id,
        transactionId: obj.id,
        amountCents: obj.amount_cents,
        cardToken: obj.token,
        merchantOrderId,
      })
    } else if (obj.error_occured || (!obj.success && !obj.pending)) {
      await handleWebhookFailure({
        transactionId: obj.id,
        amountCents: obj.amount_cents,
        errorMessage: 'Payment declined by gateway',
        merchantOrderId,
      })
    }

    return reply.code(200).send({ received: true })
  })

  app.get(
    '/billing/portal',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const tenantId = request.tenant!.id
      const sub = await masterDb.subscription.findFirst({
        where: { tenantId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      })
      if (!sub) return reply.code(404).send({ message: 'no_subscription' })

      const attempts = await masterDb.paymentAttempt.findMany({
        where: { subscriptionId: sub.id },
        orderBy: { attemptedAt: 'desc' },
        take: 10,
      })

      return reply.send({ subscription: sub, history: attempts })
    },
  )

  app.post(
    '/billing/cancel',
    { preHandler: [authenticate] },
    async (request, reply) => {
      await cancelSubscription(request.tenant!.id)
      return reply.send({ message: 'cancelled_at_period_end' })
    },
  )
}
