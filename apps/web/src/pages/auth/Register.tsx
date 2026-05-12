import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button, Input, Alert } from '@/components/ui'
import { api } from '@/api/client'

interface Plan {
  id: string
  name: string
  slug: string
  priceMonthly: number
}

const schema = z.object({
  name: z.string().min(2, 'اسم المتجر مطلوب'),
  subdomain: z
    .string()
    .min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل')
    .regex(/^[a-z0-9-]+$/, 'يسمح فقط بالأحرف الإنجليزية الصغيرة والأرقام والشرطة'),
  planSlug: z.string().min(1, 'اختر الباقة'),
  ownerName: z.string().min(2, 'الاسم مطلوب'),
  ownerEmail: z.string().email('بريد إلكتروني غير صالح'),
  ownerPassword: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
})

type FormData = z.infer<typeof schema>

export default function Register() {
  const navigate = useNavigate()
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await api.get<{ data: Plan[] }>('/plans')
      return res.data.data
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: FormData) => {
      await api.post('/tenants/register', {
        name: data.name,
        subdomain: data.subdomain,
        planSlug: data.planSlug,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        ownerPassword: data.ownerPassword,
      })
    },
    onSuccess: () => {
      toast.success('تم إنشاء المتجر بنجاح!')
      navigate('/login')
    },
  })

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-brand-400 mb-2">Storify</h1>
          <p className="text-gray-400 text-sm">أنشئ متجرك الآن — مجاناً لأول 14 يوم</p>
        </div>

        <div className="bg-gray-800 rounded-r-xl border border-gray-700 p-8 shadow-xl">
          {error && (
            <Alert variant="danger" className="mb-6">
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'حدث خطأ، حاول مرة أخرى'}
            </Alert>
          )}

          <form onSubmit={handleSubmit((d) => mutate(d))} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="اسم المتجر"
                placeholder="متجري الإلكتروني"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Subdomain"
                placeholder="my-store"
                hint="my-store.storify.com"
                error={errors.subdomain?.message}
                {...register('subdomain')}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">الباقة</label>
              <select
                {...register('planSlug')}
                className="w-full rounded-r-md border-[1.5px] border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
              >
                <option value="">اختر الباقة</option>
                {plans?.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.name} — {p.priceMonthly} ج.م / شهر
                  </option>
                ))}
              </select>
              {errors.planSlug && (
                <p className="text-xs text-danger-500 mt-1">{errors.planSlug.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="اسمك"
                placeholder="محمد أحمد"
                error={errors.ownerName?.message}
                {...register('ownerName')}
              />
              <Input
                label="البريد الإلكتروني"
                type="email"
                placeholder="owner@store.com"
                error={errors.ownerEmail?.message}
                {...register('ownerEmail')}
              />
            </div>

            <Input
              label="كلمة المرور"
              type="password"
              placeholder="••••••••"
              error={errors.ownerPassword?.message}
              {...register('ownerPassword')}
            />

            <Button type="submit" loading={isPending} size="lg" className="w-full">
              إنشاء المتجر
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            لديك متجر؟{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
