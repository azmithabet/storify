import { config } from '../../config/env'

interface SendPasswordResetOptions {
  to: string
  subdomain: string
  rawToken: string
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
