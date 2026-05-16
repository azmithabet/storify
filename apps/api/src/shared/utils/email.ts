import { config } from '../../config/env'

interface SendPasswordResetOptions {
  to: string
  subdomain: string
  rawToken: string
}

export async function sendEmail({ to, template, data }: {
  to: string; template: string; data: Record<string, string>
}) {
  if (!config.RESEND_API_KEY) {
    console.log(`[DEV] Email template=${template} to=${to}`, data)
    return
  }
  const { Resend } = await import('resend')
  const resend = new Resend(config.RESEND_API_KEY)
  await resend.emails.send({
    from: config.EMAIL_FROM ?? 'noreply@storify.app',
    to,
    subject: `Storify — ${template}`,
    html: `<pre>${JSON.stringify(data, null, 2)}</pre>`,
  })
}

interface InvoiceReceiptItem {
  productName: string
  quantity: number
  unitPrice: number | string
  totalPrice: number | string
}
interface InvoiceReceiptData {
  invoiceNumber: string
  createdAt: string | Date
  customerName?: string | null
  paymentMethodName?: string | null
  subtotal: number | string
  discountAmount: number | string
  taxTotal: number | string
  feeAmount: number | string
  totalAmount: number | string
  items: InvoiceReceiptItem[]
}

const fmtMoney = (n: number | string) =>
  Number(n).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function buildReceiptHtml(invoice: InvoiceReceiptData): string {
  const rows = invoice.items.map((item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${item.productName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:left">${fmtMoney(item.unitPrice)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:left">${fmtMoney(item.totalPrice)}</td>
    </tr>
  `).join('')
  const discount = Number(invoice.discountAmount)
  const tax = Number(invoice.taxTotal)
  const fee = Number(invoice.feeAmount)
  return `
    <div dir="rtl" style="font-family:Arial,'Segoe UI',sans-serif;max-width:640px;margin:auto;color:#111;background:#fff;padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="font-size:22px;font-weight:700;margin:0 0 4px">فاتورة ضريبية</h1>
          <p style="color:#6b7280;font-size:12px;margin:0">Storify POS</p>
        </div>
        <div style="text-align:left">
          <p style="font-size:18px;font-weight:700;font-family:monospace;margin:0">${invoice.invoiceNumber}</p>
          <p style="font-size:12px;color:#6b7280;margin:0">${new Date(invoice.createdAt).toLocaleString('ar-EG')}</p>
        </div>
      </div>
      <div style="margin:24px 0;padding:16px;background:#f9fafb;border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
        <div><span style="font-size:11px;color:#6b7280;display:block;margin-bottom:2px">العميل</span><span style="font-weight:600">${invoice.customerName ?? 'نقدي'}</span></div>
        <div><span style="font-size:11px;color:#6b7280;display:block;margin-bottom:2px">طريقة الدفع</span><span style="font-weight:600">${invoice.paymentMethodName ?? '—'}</span></div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
        <thead>
          <tr>
            <th style="background:#f3f4f6;padding:10px 12px;text-align:right;font-size:12px;color:#374151">الصنف</th>
            <th style="background:#f3f4f6;padding:10px 12px;text-align:center;font-size:12px;color:#374151">الكمية</th>
            <th style="background:#f3f4f6;padding:10px 12px;text-align:left;font-size:12px;color:#374151">السعر</th>
            <th style="background:#f3f4f6;padding:10px 12px;text-align:left;font-size:12px;color:#374151">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:20px;display:flex;flex-direction:column;align-items:flex-start;gap:6px">
        <div style="display:flex;justify-content:space-between;width:280px;font-size:13px;color:#374151"><span>المجموع الفرعي</span><span>${fmtMoney(invoice.subtotal)}</span></div>
        ${discount > 0 ? `<div style="display:flex;justify-content:space-between;width:280px;font-size:13px;color:#dc2626"><span>الخصم</span><span>- ${fmtMoney(discount)}</span></div>` : ''}
        ${tax > 0 ? `<div style="display:flex;justify-content:space-between;width:280px;font-size:13px"><span>الضريبة</span><span>${fmtMoney(tax)}</span></div>` : ''}
        ${fee > 0 ? `<div style="display:flex;justify-content:space-between;width:280px;font-size:13px"><span>رسوم الدفع</span><span>${fmtMoney(fee)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;width:280px;font-size:16px;font-weight:700;border-top:2px solid #111;padding-top:8px;margin-top:4px"><span>الإجمالي</span><span>${fmtMoney(invoice.totalAmount)} ج</span></div>
      </div>
      <p style="margin-top:32px;text-align:center;font-size:11px;color:#9ca3af">شكراً لتعاملكم معنا — Storify</p>
    </div>
  `
}

/**
 * Email an invoice receipt to the customer (or any address). Falls back to a
 * console log in dev when RESEND_API_KEY isn't set, so the same call path is
 * safe in CI and local dev.
 */
export async function sendInvoiceReceiptEmail({ to, invoice }: { to: string; invoice: InvoiceReceiptData }) {
  const subject = `فاتورة ${invoice.invoiceNumber} — Storify`

  if (!config.RESEND_API_KEY) {
    console.log(`[DEV] Invoice receipt for ${invoice.invoiceNumber} → ${to}`)
    return
  }

  const { Resend } = await import('resend')
  const resend = new Resend(config.RESEND_API_KEY)
  await resend.emails.send({
    from: config.EMAIL_FROM ?? 'noreply@storify.app',
    to,
    subject,
    html: buildReceiptHtml(invoice),
  })
}

interface InstallmentReminderData {
  to: string
  customerName: string
  installmentNumber: number
  amount: number | string
  dueDate: string
  isOverdue: boolean
  /** Optional store name for the email greeting. */
  storeName?: string
}

/**
 * Email an installment payment reminder. Same dev-mode fallback as
 * sendInvoiceReceiptEmail — logs in dev when Resend isn't configured.
 */
export async function sendInstallmentReminderEmail(data: InstallmentReminderData) {
  const subject = data.isOverdue
    ? `قسط متأخر — Storify`
    : `تذكير بقسط مستحق — Storify`

  if (!config.RESEND_API_KEY) {
    console.log(`[DEV] Installment reminder #${data.installmentNumber} → ${data.to}`, data)
    return
  }

  const tone = data.isOverdue
    ? { bg: '#fef2f2', border: '#fecaca', accent: '#dc2626', label: 'متأخر' }
    : { bg: '#eef2ff', border: '#c7d2fe', accent: '#4f46e5', label: 'مستحق' }

  const html = `
    <div dir="rtl" style="font-family:Arial,'Segoe UI',sans-serif;max-width:540px;margin:auto;color:#111;background:#fff;padding:24px">
      <h2 style="font-size:18px;margin:0 0 16px">${data.isOverdue ? 'قسط متأخر' : 'تذكير ودّي'}</h2>
      <p style="margin:0 0 12px;font-size:14px;color:#374151">عزيزنا ${data.customerName},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
        ${data.isOverdue
          ? `نود تذكيركم بأن القسط رقم <strong>${data.installmentNumber}</strong> أصبح متأخراً. يرجى التواصل معنا لإتمام السداد في أقرب وقت.`
          : `نود تذكيركم بأن القسط رقم <strong>${data.installmentNumber}</strong> مستحق قريباً.`}
      </p>
      <div style="background:${tone.bg};border:1px solid ${tone.border};border-radius:8px;padding:16px;margin:20px 0">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#6b7280;font-size:12px">المبلغ</span>
          <strong style="font-family:monospace;color:#111;font-size:16px">${Number(data.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج</strong>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:#6b7280;font-size:12px">تاريخ الاستحقاق</span>
          <strong style="font-family:monospace;color:${tone.accent};font-size:14px">${data.dueDate}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <span style="color:#6b7280;font-size:12px">الحالة</span>
          <strong style="color:${tone.accent};font-size:13px">${tone.label}</strong>
        </div>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">شكراً لتعاملكم معنا — ${data.storeName ?? 'Storify'}</p>
    </div>
  `

  const { Resend } = await import('resend')
  const resend = new Resend(config.RESEND_API_KEY)
  await resend.emails.send({
    from: config.EMAIL_FROM ?? 'noreply@storify.app',
    to: data.to,
    subject,
    html,
  })
}

export async function sendPasswordResetEmail({ to, subdomain, rawToken }: SendPasswordResetOptions) {
  const resetUrl = `http://${subdomain}.localhost:5173/reset?token=${rawToken}`

  if (!config.RESEND_API_KEY) {
    // Dev mode: log the reset link so the Done-when verify step can see it
    console.log(`[DEV] Password reset link for ${to}: ${resetUrl}`)
    return
  }

  const { Resend } = await import('resend')
  const resend = new Resend(config.RESEND_API_KEY)

  await resend.emails.send({
    from: config.EMAIL_FROM ?? 'noreply@storify.app',
    to,
    subject: 'إعادة تعيين كلمة المرور — Storify',
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>إعادة تعيين كلمة المرور</h2>
        <p>اضغط على الرابط التالي لإعادة تعيين كلمة المرور. الرابط صالح لمدة ساعة واحدة.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">إعادة تعيين كلمة المرور</a>
        <p style="margin-top:16px;color:#666;font-size:12px">إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد.</p>
      </div>
    `,
  })
}
