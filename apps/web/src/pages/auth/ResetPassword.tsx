import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button, Input, Alert } from '@/components/ui'
import { api } from '@/api/client'

const schema = z
  .object({
    password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const subdomain = params.get('subdomain') ?? ''

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: FormData) => {
      await api.post(
        '/auth/reset-password',
        { token, newPassword: data.password },
        { headers: { 'X-Tenant-Subdomain': subdomain } },
      )
    },
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح')
      navigate('/login')
    },
  })

  if (!token) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center p-4">
        <Alert variant="danger">رابط إعادة التعيين غير صالح أو منتهي الصلاحية.</Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-brand-400 mb-2">Storify</h1>
          <p className="text-gray-400 text-sm">تعيين كلمة مرور جديدة</p>
        </div>

        <div className="bg-gray-800 rounded-r-xl border border-gray-700 p-8 shadow-xl">
          {error && (
            <Alert variant="danger" className="mb-6">
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'الرابط منتهي الصلاحية أو غير صالح'}
            </Alert>
          )}
          <form onSubmit={handleSubmit((d) => mutate(d))} className="flex flex-col gap-5">
            <Input
              label="كلمة المرور الجديدة"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="تأكيد كلمة المرور"
              type="password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" loading={isPending} size="lg" className="w-full">
              حفظ كلمة المرور
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">
              العودة لتسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
