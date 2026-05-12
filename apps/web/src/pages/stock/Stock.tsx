import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Settings2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Badge, SkeletonTable, Button, Modal, Input } from '@/components/ui'
import { api } from '@/api/client'

interface StockEntry {
  id: string
  variantSku: string
  productName: string
  branchName: string
  branchId: string
  variantId: string
  quantity: number
  minQuantity: number
}


const schema = z.object({
  quantity: z.coerce.number().int().refine((n) => n !== 0, { message: 'يجب أن لا يكون صفراً' }),
  reason: z.string().min(1, 'السبب مطلوب'),
  note: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function Stock() {
  const qc = useQueryClient()
  const [adjustTarget, setAdjustTarget] = useState<StockEntry | null>(null)

  const { data = [], isLoading } = useQuery<StockEntry[]>({
    queryKey: ['stock'],
    queryFn: async () => (await api.get<{ data: StockEntry[] }>('/stock', { params: { limit: 100 } })).data.data,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate: adjust, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      if (!adjustTarget) return
      await api.post('/stock/adjust', {
        variantId: adjustTarget.variantId,
        branchId: adjustTarget.branchId,
        quantity: data.quantity,
        reason: data.reason,
        note: data.note,
      })
    },
    onSuccess: () => {
      toast.success('تم تعديل المخزون')
      qc.invalidateQueries({ queryKey: ['stock'] })
      setAdjustTarget(null)
      reset()
    },
    onError: () => toast.error('حدث خطأ في تعديل المخزون'),
  })

  return (
    <AppShell title="المخزون">
      <div className="flex flex-col gap-6">
        {isLoading ? <SkeletonTable rows={10} cols={5} /> : (
          <Table
            columns={[
              { key: 'productName', header: 'المنتج', render: (s) => <span className="font-medium text-gray-100">{s.productName}</span> },
              { key: 'variantSku', header: 'SKU', className: 'font-mono text-gray-500' },
              { key: 'branchName', header: 'الفرع', className: 'text-gray-400' },
              { key: 'quantity', header: 'الكمية', render: (s) => (
                <span className={s.quantity === 0 ? 'text-danger-600 font-bold' : s.quantity <= s.minQuantity ? 'text-warning-600 font-semibold' : 'text-success-600'}>
                  {s.quantity}
                </span>
              )},
              { key: 'alert', header: 'التنبيه', render: (s) =>
                s.quantity === 0
                  ? <Badge variant="danger" dot>نفذ</Badge>
                  : s.quantity <= s.minQuantity
                  ? <Badge variant="warning" dot>منخفض</Badge>
                  : null
              },
              { key: 'actions', header: '', render: (s) => (
                <Button variant="ghost" size="sm" onClick={() => { setAdjustTarget(s); reset() }}>
                  <Settings2 className="w-3 h-3" />تعديل
                </Button>
              )},
            ]}
            data={data} keyExtractor={(s) => s.id} emptyMessage="لا توجد بيانات مخزون"
          />
        )}
      </div>

      <Modal
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        title={`تعديل مخزون: ${adjustTarget?.productName ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustTarget(null)}>إلغاء</Button>
            <Button loading={isPending} onClick={handleSubmit((d) => adjust(d))}>تطبيق</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="bg-gray-750 rounded-md p-3 text-sm border border-gray-700 flex justify-between">
            <span className="text-gray-400">الكمية الحالية</span>
            <span className="text-gray-100 font-mono font-semibold">{adjustTarget?.quantity}</span>
          </div>

          <Input
            label="التعديل (+ إضافة / - خصم)"
            type="number"
            placeholder="مثال: +10 أو -5"
            error={errors.quantity?.message}
            {...register('quantity')}
          />

          <div>
            <label className="text-sm text-gray-400 block mb-1">سبب التعديل</label>
            <select {...register('reason')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="">اختر السبب</option>
              <option value="purchase">استلام مشتريات</option>
              <option value="damage">تلف أو فقدان</option>
              <option value="return">مرتجع من عميل</option>
              <option value="correction">تصحيح جرد</option>
              <option value="other">أخرى</option>
            </select>
            {errors.reason && <p className="text-danger-500 text-xs mt-1">{errors.reason.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">ملاحظة (اختياري)</label>
            <textarea {...register('note')} rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500 resize-none" />
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
