import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'
import { verifyPaymobWebhook, type PaymobWebhookPayload } from '../paymob.webhook'

const HMAC_SECRET = 'test-paymob-hmac-secret'

// Helper: build a minimal but realistic Paymob webhook payload.
function makePayload(overrides: Partial<PaymobWebhookPayload['obj']> = {}): PaymobWebhookPayload {
  return {
    id: 1,
    type: 'TRANSACTION',
    obj: {
      id: 12345,
      pending: false,
      success: true,
      is_auth: false,
      is_capture: false,
      is_standalone_payment: true,
      is_voided: false,
      is_refunded: false,
      is_3d_secure: true,
      integration_id: 999,
      has_parent_transaction: false,
      error_occured: false,
      created_at: '2026-05-22T10:00:00Z',
      currency: 'EGP',
      amount_cents: 10000,
      order: { id: 67890, merchant_order_id: 'sub_tenant1_1716372000000' },
      owner: 42,
      source_data: { pan: '1234', type: 'card', sub_type: 'MasterCard' },
      ...overrides,
    },
  }
}

// Mirror the exact field order used inside verifyPaymobWebhook so the test
// composes the canonical concatenation the same way Paymob does.
function signPayload(payload: PaymobWebhookPayload, secret: string): string {
  const obj = payload.obj
  const concat = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
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
  ].map(String).join('')
  return crypto.createHmac('sha512', secret).update(concat).digest('hex')
}

describe('verifyPaymobWebhook', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.PAYMOB_HMAC_SECRET = HMAC_SECRET
  })

  it('accepts a payload signed with the correct secret', () => {
    const payload = makePayload()
    const hmac = signPayload(payload, HMAC_SECRET)
    expect(verifyPaymobWebhook(payload, hmac)).toBe(true)
  })

  it('rejects a payload signed with the wrong secret', () => {
    const payload = makePayload()
    const hmac = signPayload(payload, 'wrong-secret')
    expect(verifyPaymobWebhook(payload, hmac)).toBe(false)
  })

  it('rejects when amount_cents is tampered with', () => {
    const payload = makePayload()
    const hmac = signPayload(payload, HMAC_SECRET)
    payload.obj.amount_cents = 999999 // attacker tries to upsize the charge
    expect(verifyPaymobWebhook(payload, hmac)).toBe(false)
  })

  it('rejects when success is flipped to true', () => {
    const failedPayload = makePayload({ success: false })
    const hmac = signPayload(failedPayload, HMAC_SECRET)
    failedPayload.obj.success = true // attacker tries to upgrade failure → success
    expect(verifyPaymobWebhook(failedPayload, hmac)).toBe(false)
  })

  it('rejects when the received HMAC is empty', () => {
    const payload = makePayload()
    expect(verifyPaymobWebhook(payload, '')).toBe(false)
  })

  it('rejects when HMAC length does not match (guards constant-time compare)', () => {
    const payload = makePayload()
    // A short string would otherwise blow up timingSafeEqual; verifier should
    // catch length mismatch before reaching it.
    expect(verifyPaymobWebhook(payload, 'short')).toBe(false)
  })
})
