import { config } from '@/config/env'

interface PaymobAuthResponse {
  token: string
  profile: { id: number }
}

interface PaymobOrderResponse {
  id: number
  created_at: string
  amount_cents: number
  merchant_order_id?: string
}

interface PaymobPaymentKeyResponse {
  token: string
}

export interface PaymobCheckoutResult {
  orderId: number
  iframeUrl: string
  paymentKey: string
}

async function paymobFetch<T>(path: string, body?: unknown): Promise<T> {
  const url = `${config.PAYMOB_BASE_URL}${path}`
  const res = await fetch(url, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Paymob API ${path} failed: ${res.status} ${text}`)
  }
  return (await res.json()) as T
}

export class PaymobClient {
  private async authToken(): Promise<string> {
    const data = await paymobFetch<PaymobAuthResponse>('/auth/tokens', {
      api_key: config.PAYMOB_API_KEY,
    })
    return data.token
  }

  async createOrder(params: {
    amountCents: number
    currency?: string
    merchantOrderId: string
  }): Promise<PaymobOrderResponse> {
    const token = await this.authToken()
    return paymobFetch<PaymobOrderResponse>('/ecommerce/orders', {
      auth_token: token,
      delivery_needed: false,
      amount_cents: params.amountCents,
      currency: params.currency ?? 'EGP',
      merchant_order_id: params.merchantOrderId,
    })
  }

  async getPaymentKey(params: {
    amountCents: number
    orderId: number
    billingData: PaymobBillingData
    integrationId?: string
    expiration?: number
    currency?: string
    cardToken?: string
    /** Where Paymob redirects the customer's browser after the iframe. */
    redirectUrl?: string
    /** Server-to-server webhook URL Paymob POSTs to after the transaction. */
    notificationUrl?: string
  }): Promise<string> {
    const token = await this.authToken()
    const data = await paymobFetch<PaymobPaymentKeyResponse>('/acceptance/payment_keys', {
      auth_token: token,
      amount_cents: params.amountCents,
      expiration: params.expiration ?? 3600,
      order_id: params.orderId,
      billing_data: params.billingData,
      currency: params.currency ?? 'EGP',
      integration_id: params.integrationId ?? config.PAYMOB_INTEGRATION_ID_CARD,
      token: params.cardToken,
      // Per-transaction overrides — Paymob's legacy /acceptance/payment_keys
      // accepts both. Setting them here means we don't depend on a merchant
      // remembering to fill in the same URLs in the dashboard for every
      // integration. Paymob still appends ?hmac=<sig> automatically to the
      // notification URL using the integration's HMAC secret.
      redirect_url: params.redirectUrl,
      notification_url: params.notificationUrl,
    })
    return data.token
  }

  async startCheckoutSession(params: {
    amountCents: number
    tenantId: string
    billingData: PaymobBillingData
    redirectUrl?: string
    notificationUrl?: string
  }): Promise<PaymobCheckoutResult> {
    const order = await this.createOrder({
      amountCents: params.amountCents,
      merchantOrderId: `sub_${params.tenantId}_${Date.now()}`,
    })
    const paymentKey = await this.getPaymentKey({
      amountCents: params.amountCents,
      orderId: order.id,
      billingData: params.billingData,
      redirectUrl: params.redirectUrl,
      notificationUrl: params.notificationUrl,
    })
    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${config.PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`
    return { orderId: order.id, iframeUrl, paymentKey }
  }

  async chargeWithToken(params: {
    amountCents: number
    orderId: number
    cardToken: string
    billingData: PaymobBillingData
    merchantOrderId?: string
  }): Promise<PaymobRecurringChargeResponse> {
    const paymentKey = await this.getPaymentKey({
      amountCents: params.amountCents,
      orderId: params.orderId,
      billingData: params.billingData,
      cardToken: params.cardToken,
    })
    return paymobFetch<PaymobRecurringChargeResponse>('/acceptance/payments/pay', {
      source: { identifier: params.cardToken, subtype: 'TOKEN' },
      payment_token: paymentKey,
    })
  }
}

export interface PaymobBillingData {
  first_name: string
  last_name: string
  email: string
  phone_number: string
  apartment?: string
  floor?: string
  street?: string
  building?: string
  shipping_method?: string
  postal_code?: string
  city?: string
  country?: string
  state?: string
}

export interface PaymobRecurringChargeResponse {
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
  token: string
  amount_cents: number
  currency: string
  order: { id: number; merchant_order_id?: string }
  merchant_order_id?: string
}
