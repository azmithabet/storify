import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import { Button, Input, Alert } from '@/components/ui'
import { api } from '@/api/client'
import { getApiErrorMessage } from '@/lib/api-error'
import { useAuthStore, type AuthUser } from '@/stores/auth.store'

const schema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  subdomain: z.string().min(1, 'مطلوب'),
})

type FormData = z.infer<typeof schema>

export default function Login() {
  const [showPwd, setShowPwd] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useAuthStore()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/pos'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post<{ success: boolean; data: { accessToken: string; user: AuthUser } }>(
        '/auth/login',
        { email: data.email, password: data.password },
        { headers: { 'X-Tenant-Subdomain': data.subdomain } },
      )
      return { ...res.data.data, subdomain: data.subdomain }
    },
    onSuccess: ({ accessToken, user, subdomain }) => {
      setAuth(user, accessToken, subdomain)
      toast.success('تم تسجيل الدخول بنجاح')
      navigate(from, { replace: true })
    },
  })

  return (
    <div className="min-h-dvh bg-app flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-brand-400 mb-2">Storify</h1>
          <p className="text-gray-400 text-sm">تسجيل الدخول إلى متجرك</p>
        </div>

        <div className="bg-gray-800 rounded-r-xl border border-gray-700 p-8 shadow-xl">
          {error && (
            <Alert variant="danger" className="mb-6">
              {getApiErrorMessage(error, 'خطأ في تسجيل الدخول')}
            </Alert>
          )}

          <form onSubmit={handleSubmit((d) => mutate(d))} className="flex flex-col gap-5">
            <Input
              label="اسم المتجر (Subdomain)"
              placeholder="my-store"
              autoComplete="organization"
              error={errors.subdomain?.message}
              {...register('subdomain')}
            />
            <Input
              label="البريد الإلكتروني"
              type="email"
              placeholder="owner@store.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="كلمة المرور"
              type={showPwd ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              endIcon={
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                  aria-label={showPwd ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              {...register('password')}
            />

            <div className="flex items-center justify-between">
              <Link
                to="/forgot-password"
                className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            <Button type="submit" loading={isPending} size="lg" className="w-full">
              تسجيل الدخول
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ليس لديك متجر؟{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 transition-colors">
              أنشئ متجرك الآن
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
