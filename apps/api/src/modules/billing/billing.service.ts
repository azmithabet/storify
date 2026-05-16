import { masterDb } from '@/config/database'
import { PaymobClient, type PaymobBillingData } from './paymob.client'
import { sendEmail } from '@/shared/utils/email'
import Decimal from 'decimal.js'

const paymob = new PaymobClient()

export async function startTrial(tenantId: string, planId: string) {
  const plan = await masterDb.plan.findUniqueOrThrow({ where: { id: planId } })
  const trialEndAt = new Date(Date.now() + 14 * 24 * 3600 * 1000)

  await masterDb.subscription.create({
    data: {
      tenantId,
      planId,
      billingCycle: 'MONTHLY',
      status: 'TRIALING',
      trialEndsAt: trialEndAt,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndAt,
      priceAtSubscription: plan.priceMonthly,
      provider: 'paymob',
    },
  })
}

export async function startCheckout(
  tenantId: string,
  billing: PaymobBillingData,
): Promise<{ iframeUrl: string }> {
  const sub = await masterDb.subscription.findFirstOrThrow({
    where: { tenantId },
    include: { plan: true },
  })
  const amountCents = new Decimal(sub.priceAtSubscription.toString())
    .times(100)
    .toDecimalPlaces(0)
    .toNumber()

  const result = await paymob.startCheckoutSession({
    amountCents,
    tenantId,
    billingData: billing,
  })
  return { iframeUrl: result.iframeUrl }
}

export async function handleWebhookSuccess(params: {
  orderId: number
  transactionId: number
  amountCents: number
  cardToken?: string
  providerCustomerId?: string
  merchantOrderId: string
}) {
  const { orderId, transactionId, amountCents, cardToken, merchantOrderId } = params

  // Extract tenantId from merchant_order_id format: sub_<tenantId>_<timestamp>
  const tenantId = merchantOrderId.split('_')[1]
  if (!tenantId) return

  // Idempotency: skip if transaction already recorded
  const existing = await masterDb.paymentAttempt.findFirst({
    where: { providerTransactionId: String(transactionId) },
  })
  if (existing) return

  const sub = await masterDb.subscription.findFirst({ where: { tenantId } })
  if (!sub) return

  const periodStart = new Date()
  const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000)

  await masterDb.$transaction([
    masterDb.paymentAttempt.create({
      data: {
        subscriptionId: sub.id,
        providerTransactionId: String(transactionId),
        amount: new Decimal(amountCents).dividedBy(100),
        currency: 'EGP',
        status: 'SUCCESS',
        attemptType: 'initial',
        provider: 'paymob',
        providerResponse: { orderId, transactionId },
      },
    }),
    masterDb.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        failedAttempts: 0,
        lastFailureReason: null,
        lastPaymentAt: periodStart,
        nextBillingAt: periodEnd,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        providerCardToken: cardToken,
      },
    }),
  ])

  const tenant = await masterDb.tenant.findUnique({ where: { id: tenantId } })
  if (tenant) {
    await sendEmail({
      to: tenant.ownerEmail,
      template: 'payment_succeeded',
      data: { tenantName: tenant.name, amount: `${amountCents / 100} EGP`, period: periodEnd.toLocaleDateString('ar-EG') },
    }).catch(() => {})
  }
}

export async function handleWebhookFailure(params: {
  transactionId: number
  amountCents: number
  errorMessage?: string
  merchantOrderId: string
}) {
  const { transactionId, amountCents, errorMessage, merchantOrderId } = params
  const tenantId = merchantOrderId.split('_')[1]
  if (!tenantId) return

  const existing = await masterDb.paymentAttempt.findFirst({
    where: { providerTransactionId: String(transactionId) },
  })
  if (existing) return

  const sub = await masterDb.subscription.findFirst({ where: { tenantId } })
  if (!sub) return

  const newFailedAttempts = (sub.failedAttempts ?? 0) + 1
  let newStatus = sub.status

  if (newFailedAttempts >= 14) {
    newStatus = 'CANCELLED'
  } else if (newFailedAttempts >= 7) {
    newStatus = 'SUSPENDED'
  } else if (newFailedAttempts >= 3) {
    newStatus = 'PAST_DUE'
  }

  await masterDb.$transaction([
    masterDb.paymentAttempt.create({
      data: {
        subscriptionId: sub.id,
        providerTransactionId: String(transactionId),
        amount: new Decimal(amountCents).dividedBy(100),
        currency: 'EGP',
        status: 'FAILED',
        attemptType: 'initial',
        provider: 'paymob',
        providerResponse: { errorMessage },
      },
    }),
    masterDb.subscription.update({
      where: { id: sub.id },
      data: {
        failedAttempts: newFailedAttempts,
        lastFailureReason: errorMessage ?? 'payment_failed',
        status: newStatus,
        ...(newStatus === 'SUSPENDED' ? { suspendedAt: new Date() } : {}),
        ...(newStatus === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
      },
    }),
  ])

  const emailTemplate =
    newStatus === 'CANCELLED'
      ? 'subscription_cancelled'
      : newStatus === 'SUSPENDED'
        ? 'subscription_suspended'
        : 'payment_failed'

  const tenant = await masterDb.tenant.findUnique({ where: { id: tenantId } })
  if (tenant) {
    await sendEmail({ to: tenant.ownerEmail, template: emailTemplate, data: { tenantName: tenant.name } }).catch(() => {})
  }
}

// NOTE: schema has no `cancelAtPeriodEnd` flag, so cancellation is immediate.
// If "cancel at period end" semantics are needed, add a Boolean column +
// migration and gate the actual CANCELLED status flip behind a cron.
export async function cancelSubscription(tenantId: string) {
  await masterDb.subscription.updateMany({
    where: { tenantId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  })
}
