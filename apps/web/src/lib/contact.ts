/**
 * Centralized contact/sales channels.
 * Change the constant in one place — used by the Enterprise CTA, the
 * final-CTA section, and the future support page.
 */

// Egyptian Business WhatsApp number in international format (no '+', no spaces).
// User's local format 01111454969 → international 20 1111454969.
export const SALES_WHATSAPP = '201111454969'

/**
 * Build a wa.me URL with a pre-filled message.
 * WhatsApp encodes message via URL params; emoji + Arabic both fine.
 */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${SALES_WHATSAPP}`
  if (!message) return base
  return `${base}?text=${encodeURIComponent(message)}`
}

// Pre-canned messages so the conversation starts in the right context
export const SALES_MESSAGES = {
  enterprise:
    'مرحبًا، أنا مهتم بباقة Enterprise لمتجر/سلسلة متاجر. ممكن نتكلم عن التفاصيل والأسعار؟',
  general: 'مرحبًا، عندي سؤال عن Storify.',
  demo: 'مرحبًا، حابب أشوف عرض تجريبي لـ Storify.',
} as const
