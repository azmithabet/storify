import crypto from 'crypto'
import { config } from '@/config/env'

/**
 * Verifies Paymob webhook HMAC-SHA512.
 * Paymob concatenates specific transaction fields in a specific order.
 * Any mismatch → reject (potential tampering).
 */
export function verifyPaymobWebhook(
  payload: PaymobWebhookPayload,
  receivedHmac: string,
): boolean {
  // Fail closed: never accept a webhook when the HMAC secret isn't configured —
  // signing against an empty key would let anyone forge requests.
  const secret = config.PAYMOB_HMAC_SECRET
  if (!secret) return false
  if (!receivedHmac) return false

  const obj = payload.obj
  const concatenated = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    payload.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order?.id,
    obj.owner,
    obj.pending,
    obj.source_data?.pan,
    obj.source_data?.sub_type,
    obj.source_data?.type,
    obj.success,
  ]
    .map(String)
    .join('')

  const hmac = crypto
    .createHmac('sha512', secret)
    .update(concatenated)
    .digest('hex')

  // Constant-time comparison to avoid timing oracles.
  const a = Buffer.from(hmac, 'hex')
  const b = Buffer.from(receivedHmac, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export interface PaymobWebhookPayload {
  id: number
  type: string
  obj: {
    id: number
    pending: boolean
    success: boolean
    is_auth: boolean
    is_capture: boolean
    is_standalone_payment: boolean
    is_voided: boolean
    is_refunded: boolean
    is_3d_secure: boolean
    integration_id: number
    profile_id?: number
    has_parent_transaction: boolean
    error_occured: boolean
    created_at: string
    currency: string
    amount_cents: number
    token?: string
    order: { id: number; merchant_order_id: string }
    owner: number
    source_data: { pan: string; type: string; sub_type: string }
  }
}
