import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card, Button, Modal, Input, Badge, Skeleton, Alert } from '@/components/ui'
import { adminApi } from '@/api/admin-client'
import { formatMoney, formatNumber } from '@/lib/format'
import { getApiErrorMessage } from '@/lib/api-error'

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  maxProducts: number
  maxOrders: number
  maxUsers: number
  maxStorage: number
  maxInstallmentPlansMonthly: number
  priceMonthly: string
  priceYearly: string
  isActive: boolean
  sortOrder: number
  _count: { tenants: number; subscriptions: number }
}

const planSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9_-]+$/),
  description: z.string().optional(),
  priceMonthly: z.coerce.number().min(0),
  priceYearly: z.coerce.number().min(0),
  maxProducts: z.coerce.number().int().min(0),
  maxOrders: z.coerce.number().int().min(0),
  maxUsers: z.coerce.number().int().min(0),
  maxStorage: z.coerce.number().int().min(0),
  maxInstallmentPlansMonthly: z.coerce.number().int().min(0),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

type PlanForm = z.infer<typeof planSchema>

export default function AdminPlans() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Plan | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const res = await adminApi.get<{ success: true; data: Plan[] }>('/plans')
      return res.data.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.delete(`/plans/${id}`)
    },
    onSuccess: () => {
      toast.success('تم حذف الباقة')
      setConfirmDelete(null)
      qc.invalidateQueries({ queryKey: ['admin', 'plans'] })
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <AdminShell title="الباقات">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-400">إدارة باقات الاشتراك المتاحة للمتاجر</p>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" />
          باقة جديدة
        </Button>
      </div>

      {error ? (
        <Alert variant="danger">{getApiErrorMessage(error, 'تعذر التحميل')}</Alert>
      ) : isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">{p.name}</h3>
                  <p className="text-xs text-gray-500" dir="ltr">{p.slug}</p>
                </div>
                <Badge variant={p.isActive ? 'success' : 'gray'}>{p.isActive ? 'مفعّلة' : 'معطّلة'}</Badge>
              </div>

              <p className="font-mono text-2xl text-brand-300 mb-1" dir="ltr">
                {formatMoney(Number(p.priceMonthly))} <span className="text-xs text-gray-500">EGP/شهر</span>
              </p>
              <p className="text-xs text-gray-500 mb-4" dir="ltr">
                {formatMoney(Number(p.priceYearly))} EGP/سنة
              </p>

              <dl className="text-xs space-y-1 text-gray-400 flex-1">
                <div className="flex justify-between"><dt>منتجات</dt><dd>{formatNumber(p.maxProducts)}</dd></div>
                <div className="flex justify-between"><dt>طلبات</dt><dd>{formatNumber(p.maxOrders)}</dd></div>
                <div className="flex justify-between"><dt>مستخدمون</dt><dd>{formatNumber(p.maxUsers)}</dd></div>
                <div className="flex justify-between"><dt>تخزين (MB)</dt><dd>{formatNumber(p.maxStorage)}</dd></div>
                <div className="flex justify-between"><dt>عقود قسط/شهر</dt><dd>{formatNumber(p.maxInstallmentPlansMonthly)}</dd></div>
              </dl>

              <div className="border-t border-gray-700 mt-3 pt-3 flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {p._count.tenants} متجر • {p._count.subscriptions} اشتراك
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)} aria-label="تعديل">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(p)} aria-label="حذف">
                    <Trash2 className="w-4 h-4 text-danger-400" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PlanFormModal
          plan={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'plans'] })
            setEditing(null)
            setCreating(false)
          }}
        />
      )}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="حذف الباقة"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>إلغاء</Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            >
              حذف نهائي
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-300">
          سيتم حذف باقة <strong>{confirmDelete?.name}</strong>. لا يمكن التراجع.
        </p>
        {confirmDelete && (confirmDelete._count.tenants > 0 || confirmDelete._count.subscriptions > 0) && (
          <Alert variant="warning" className="mt-3">
            هذه الباقة عليها {confirmDelete._count.tenants} متجر و{confirmDelete._count.subscriptions} اشتراك — الحذف سيفشل، عطّلها بدلاً من ذلك.
          </Alert>
        )}
      </Modal>
    </AdminShell>
  )
}

function PlanFormModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!plan
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? {
          name: plan.name,
          slug: plan.slug,
          description: plan.description ?? '',
          priceMonthly: Number(plan.priceMonthly),
          priceYearly: Number(plan.priceYearly),
          maxProducts: plan.maxProducts,
          maxOrders: plan.maxOrders,
          maxUsers: plan.maxUsers,
          maxStorage: plan.maxStorage,
          maxInstallmentPlansMonthly: plan.maxInstallmentPlansMonthly,
          sortOrder: plan.sortOrder,
          isActive: plan.isActive,
        }
      : {
          isActive: true,
          sortOrder: 0,
          maxProducts: 100,
          maxOrders: 500,
          maxUsers: 3,
          maxStorage: 1024,
          maxInstallmentPlansMonthly: 0,
        },
  })

  const mutation = useMutation({
    mutationFn: async (form: PlanForm) => {
      if (isEdit) {
        const { slug: _slug, ...rest } = form
        await adminApi.patch(`/plans/${plan.id}`, rest)
      } else {
        await adminApi.post('/plans', form)
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'تم الحفظ' : 'تم الإنشاء')
      onSaved()
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEdit ? 'تعديل الباقة' : 'باقة جديدة'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSubmit((d) => mutation.mutate(d))} loading={mutation.isPending}>
            {isEdit ? 'حفظ' : 'إنشاء'}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="الاسم" error={errors.name?.message} {...register('name')} />
        <Input label="Slug" placeholder="starter" disabled={isEdit} error={errors.slug?.message} {...register('slug')} />
        <Input label="السعر الشهري (EGP)" type="number" step="0.01" error={errors.priceMonthly?.message} {...register('priceMonthly')} />
        <Input label="السعر السنوي (EGP)" type="number" step="0.01" error={errors.priceYearly?.message} {...register('priceYearly')} />
        <Input label="حد المنتجات" type="number" error={errors.maxProducts?.message} {...register('maxProducts')} />
        <Input label="حد الطلبات" type="number" error={errors.maxOrders?.message} {...register('maxOrders')} />
        <Input label="حد المستخدمين" type="number" error={errors.maxUsers?.message} {...register('maxUsers')} />
        <Input label="حد التخزين (MB)" type="number" error={errors.maxStorage?.message} {...register('maxStorage')} />
        <Input label="عقود قسط/شهر" type="number" error={errors.maxInstallmentPlansMonthly?.message} {...register('maxInstallmentPlansMonthly')} />
        <Input label="ترتيب العرض" type="number" {...register('sortOrder')} />
        <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-brand-500" {...register('isActive')} />
          مفعّلة (يمكن للمتاجر الاشتراك بها)
        </label>
      </form>
    </Modal>
  )
}
