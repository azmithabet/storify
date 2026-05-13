import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit2, Wallet } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Input, Table, Money, SkeletonTable, Button, Drawer, Pagination, Modal } from '@/components/ui'
import { api } from '@/api/client'

interface Customer {
  id: string
  fullName: string
  phone?: string
  email?: string
  nationalId?: string
  address?: string
  creditBalance: number
  _count?: { invoices: number }
}

interface Meta { total: number; page: number; limit: number; pages: number }

const LIMIT = 20

const schema = z.object({
  fullName: z.string().min(1, 'الاسم مطلوب'),
  phone: z.string().optional(),
  nationalId: z.string().optional(),
  email: z.string().email('بريد غير صالح').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const creditSchema = z.object({
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  type: z.enum(['add', 'deduct']),
  note: z.string().optional(),
})
type CreditFormData = z.infer<typeof creditSchema>

function CreditModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CreditFormData>({
    resolver: zodResolver(creditSchema),
    defaultValues: { type: 'add' },
  })
  const creditType = watch('type')

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: CreditFormData) => {
      await api.post(`/customers/${customer.id}/credit`, data)
    },
    onSuccess: () => {
      toast.success('تم تعديل الرصيد')
      qc.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    },
    onError: (e: unknown) => {
      const code = (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code
      toast.error(code === 'insufficient_credit' ? 'الرصيد غير كافٍ' : 'فشل تعديل الرصيد')
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutate(d))} className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-gray-400 mb-1">الرصيد الحالي</p>
        <Money value={customer.creditBalance} size="lg" />
      </div>
      <div>
        <p className="text-sm text-gray-400 mb-2">نوع التعديل</p>
        <div className="flex gap-2">
          <label className={`flex-1 cursor-pointer py-2 rounded text-sm border text-center transition-all ${creditType === 'add' ? 'border-success-500 text-success-400 bg-success-500/10' : 'border-gray-700 text-gray-400'}`}>
            <input type="radio" value="add" {...register('type')} className="hidden" />
            إضافة رصيد
          </label>
          <label className={`flex-1 cursor-pointer py-2 rounded text-sm border text-center transition-all ${creditType === 'deduct' ? 'border-danger-500 text-danger-400 bg-danger-500/10' : 'border-gray-700 text-gray-400'}`}>
            <input type="radio" value="deduct" {...register('type')} className="hidden" />
            خصم رصيد
          </label>
        </div>
      </div>
      <Input label="المبلغ" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
      <div>
        <label className="text-sm text-gray-400 block mb-1">ملاحظة (اختياري)</label>
        <textarea {...register('note')} rows={2}
          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500 resize-none" />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isPending} className="flex-1">حفظ</Button>
      </div>
    </form>
  )
}

export default function Customers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null)

  const { data, isLoading } = useQuery<{ data: Customer[]; meta: Meta }>({
    queryKey: ['customers', search, page],
    queryFn: async () => (await api.get<{ data: Customer[]; meta: Meta }>('/customers', { params: { search, limit: LIMIT, page } })).data,
  })

  const customers = data?.data ?? []
  const meta = data?.meta

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const openNew = () => { setEditing(null); reset({}); setDrawerOpen(true) }
  const openEdit = (c: Customer) => {
    setEditing(c)
    reset({ fullName: c.fullName, phone: c.phone ?? '', nationalId: c.nationalId ?? '', address: c.address ?? '' })
    setDrawerOpen(true)
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      const body = { ...data, email: data.email || undefined }
      if (editing) await api.patch(`/customers/${editing.id}`, body)
      else await api.post('/customers', body)
    },
    onSuccess: () => {
      toast.success(editing ? 'تم تحديث العميل' : 'تم إضافة العميل')
      qc.invalidateQueries({ queryKey: ['customers'] })
      setDrawerOpen(false)
    },
    onError: () => toast.error('حدث خطأ، حاول مرة أخرى'),
  })

  return (
    <AppShell title="العملاء">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-xs">
            <Input placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} startIcon={<Search className="w-4 h-4" />} />
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4" />عميل جديد</Button>
        </div>

        {isLoading ? <SkeletonTable rows={8} cols={5} /> : (
          <>
            <Table
              columns={[
                { key: 'fullName', header: 'الاسم', render: (c) => <span className="font-medium text-gray-100">{c.fullName}</span> },
                { key: 'phone', header: 'الهاتف', className: 'font-mono text-gray-500' },
                { key: 'email', header: 'البريد الإلكتروني', className: 'text-gray-500 text-sm' },
                { key: 'invoices', header: 'الفواتير', render: (c) => <span className="text-center font-mono">{c._count?.invoices ?? 0}</span> },
                { key: 'creditBalance', header: 'الرصيد', render: (c) => c.creditBalance > 0 ? <Money value={c.creditBalance} /> : <span className="text-gray-500">—</span> },
                { key: 'actions', header: '', render: (c) => (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setCreditCustomer(c) }}>
                      <Wallet className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(c) }}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </div>
                )},
              ]}
              data={customers} keyExtractor={(c) => c.id} emptyMessage="لا يوجد عملاء"
            />
            {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPage={setPage} />}
          </>
        )}
      </div>

      <Modal open={!!creditCustomer} onClose={() => setCreditCustomer(null)} title={`تعديل رصيد: ${creditCustomer?.fullName ?? ''}`}>
        {creditCustomer && <CreditModal customer={creditCustomer} onClose={() => setCreditCustomer(null)} />}
      </Modal>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل بيانات العميل' : 'عميل جديد'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
            <Button loading={isPending} onClick={handleSubmit((d) => save(d))}>حفظ</Button>
          </>
        }
      >
        <form className="flex flex-col gap-5">
          <Input label="الاسم الكامل" error={errors.fullName?.message} {...register('fullName')} />
          <Input label="رقم الهاتف" type="tel" {...register('phone')} />
          <Input label="الرقم القومي" {...register('nationalId')} />
          <Input label="البريد الإلكتروني" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="العنوان" {...register('address')} />
          <div>
            <label className="text-sm text-gray-400 block mb-1">ملاحظات</label>
            <textarea {...register('notes')} rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500 resize-none" />
          </div>
        </form>
      </Drawer>
    </AppShell>
  )
}
