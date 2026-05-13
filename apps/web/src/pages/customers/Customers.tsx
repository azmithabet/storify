import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Input, Table, Money, SkeletonTable, Button, Drawer, Pagination } from '@/components/ui'
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

export default function Customers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

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
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(c) }}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )},
              ]}
              data={customers} keyExtractor={(c) => c.id} emptyMessage="لا يوجد عملاء"
            />
            {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPage={setPage} />}
          </>
        )}
      </div>

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
