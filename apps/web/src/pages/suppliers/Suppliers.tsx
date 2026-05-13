import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Money, SkeletonTable, Badge, Button, Drawer, Modal, Input, Pagination } from '@/components/ui'
import { api } from '@/api/client'

interface Supplier { id: string; name: string; phone?: string; email?: string; balance: number; totalOrders: number; isActive: boolean }
interface Meta { total: number; page: number; limit: number; pages: number }

const LIMIT = 20

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  phone: z.string().optional(),
  email: z.string().email('بريد غير صالح').optional().or(z.literal('')),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
  bankAccount: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function Suppliers() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)

  const { data, isLoading } = useQuery<{ data: Supplier[]; meta: Meta }>({
    queryKey: ['suppliers', page],
    queryFn: async () => (await api.get<{ data: Supplier[]; meta: Meta }>('/suppliers', { params: { limit: LIMIT, page } })).data,
  })

  const suppliers = data?.data ?? []
  const meta = data?.meta

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const openNew = () => { setEditing(null); reset({}); setDrawerOpen(true) }
  const openEdit = (s: Supplier) => {
    setEditing(s)
    reset({ name: s.name, phone: s.phone ?? '', email: s.email ?? '' })
    setDrawerOpen(true)
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      const body = { ...data, email: data.email || undefined }
      if (editing) await api.patch(`/suppliers/${editing.id}`, body)
      else await api.post('/suppliers', body)
    },
    onSuccess: () => {
      toast.success(editing ? 'تم تحديث المورد' : 'تم إضافة المورد')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setDrawerOpen(false)
    },
    onError: () => toast.error('حدث خطأ، حاول مرة أخرى'),
  })

  const { mutate: deleteSup, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      toast.success('تم حذف المورد')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setDeleteTarget(null)
    },
    onError: () => toast.error('لا يمكن حذف مورد لديه طلبات'),
  })

  return (
    <AppShell title="الموردون">
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Button onClick={openNew}><Plus className="w-4 h-4" />مورد جديد</Button>
        </div>

        {isLoading ? <SkeletonTable rows={8} cols={5} /> : (
          <>
            <Table
              columns={[
                { key: 'name', header: 'المورد', render: (s) => <span className="font-medium text-gray-100">{s.name}</span> },
                { key: 'phone', header: 'الهاتف', className: 'font-mono text-gray-500' },
                { key: 'email', header: 'البريد', className: 'text-gray-500 text-sm' },
                { key: 'totalOrders', header: 'الطلبات', className: 'text-center font-mono' },
                { key: 'balance', header: 'الرصيد المستحق', render: (s) => s.balance > 0 ? <Money value={s.balance} /> : <Badge variant="success" dot>مسدد</Badge> },
                { key: 'actions', header: '', render: (s) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(s) }}><Edit2 className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s) }} className="text-danger-500"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                )},
              ]}
              data={suppliers} keyExtractor={(s) => s.id} emptyMessage="لا يوجد موردون"
            />
            {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPage={setPage} />}
          </>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل بيانات المورد' : 'مورد جديد'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
            <Button loading={isPending} onClick={handleSubmit((d) => save(d))}>حفظ</Button>
          </>
        }
      >
        <form className="flex flex-col gap-5">
          <Input label="اسم المورد" error={errors.name?.message} {...register('name')} />
          <Input label="رقم الهاتف" type="tel" {...register('phone')} />
          <Input label="البريد الإلكتروني" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="العنوان" {...register('address')} />
          <Input label="الرقم الضريبي" {...register('taxNumber')} />
          <Input label="الحساب البنكي (IBAN)" {...register('bankAccount')} />
          <div>
            <label className="text-sm text-gray-400 block mb-1">ملاحظات</label>
            <textarea {...register('notes')} rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500 resize-none" />
          </div>
        </form>
      </Drawer>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="حذف المورد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            <Button variant="danger" loading={isDeleting} onClick={() => deleteTarget && deleteSup(deleteTarget.id)}>حذف</Button>
          </>
        }
      >
        <p className="text-gray-300">هل أنت متأكد من حذف المورد <strong className="text-gray-100">{deleteTarget?.name}</strong>؟ لا يمكن التراجع عن هذا الإجراء.</p>
      </Modal>
    </AppShell>
  )
}
