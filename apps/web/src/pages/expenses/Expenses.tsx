import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Money, Badge, SkeletonTable, Button, Drawer, Modal, Input, Pagination } from '@/components/ui'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'

interface Expense {
  id: string
  description: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  expenseDate: string
  createdAt: string
  category?: { id: string; name: string }
}

interface Category { id: string; name: string }
interface Branch { id: string; name: string; isMain: boolean }
interface Meta { total: number; page: number; limit: number; pages: number }

const LIMIT = 20

const schema = z.object({
  description: z.string().min(1, 'الوصف مطلوب'),
  amount: z.coerce.number().positive('يجب أن يكون أكبر من صفر'),
  categoryId: z.string().uuid('اختر فئة'),
  branchId: z.string().uuid('اختر الفرع'),
  expenseDate: z.string().min(1, 'التاريخ مطلوب'),
  paymentMethod: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const statusMap = {
  pending: { label: 'انتظار', variant: 'warning' as const },
  approved: { label: 'موافق', variant: 'success' as const },
  rejected: { label: 'مرفوض', variant: 'danger' as const },
}

export default function Expenses() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ expense: Expense; type: 'approve' | 'reject' } | null>(null)

  const { data: expenseData, isLoading } = useQuery<{ data: Expense[]; meta: Meta }>({
    queryKey: ['expenses', page],
    queryFn: async () => (await api.get<{ data: Expense[]; meta: Meta }>('/expenses', { params: { limit: LIMIT, page } })).data,
  })

  const data = expenseData?.data ?? []
  const meta = expenseData?.meta

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['expense-categories'],
    queryFn: async () => (await api.get<{ data: Category[] }>('/expenses/categories')).data.data,
  })

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await api.get<{ data: Branch[] }>('/branches')).data.data,
  })

  const defaultBranch = branches.find((b) => b.isMain) ?? branches[0]

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { expenseDate: new Date().toISOString().slice(0, 10) },
  })

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: async (data: FormData) => api.post('/expenses', data),
    onSuccess: () => {
      toast.success('تم إضافة المصروف')
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setDrawerOpen(false)
      reset()
    },
    onError: () => toast.error('حدث خطأ، حاول مرة أخرى'),
  })

  const { mutate: reviewExpense, isPending: isReviewing } = useMutation({
    mutationFn: async ({ expense, type }: { expense: Expense; type: 'approve' | 'reject' }) =>
      api.patch(`/expenses/${expense.id}/${type}`),
    onSuccess: (_, { type }) => {
      toast.success(type === 'approve' ? 'تم الاعتماد' : 'تم الرفض')
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setConfirmAction(null)
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const canApprove = user?.roleSlug === 'super_admin' || user?.permissions?.expenses?.includes('approve')

  return (
    <AppShell title="المصروفات">
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Button onClick={() => { reset({ expenseDate: new Date().toISOString().slice(0, 10), branchId: defaultBranch?.id }); setDrawerOpen(true) }}>
            <Plus className="w-4 h-4" />مصروف جديد
          </Button>
        </div>

        {isLoading ? <SkeletonTable rows={8} cols={5} /> : (
          <>
          <Table
            columns={[
              { key: 'description', header: 'الوصف', render: (e) => <span className="font-medium text-gray-100">{e.description}</span> },
              { key: 'category', header: 'الفئة', render: (e) => <span className="text-gray-400">{e.category?.name ?? '—'}</span> },
              { key: 'amount', header: 'المبلغ', render: (e) => <Money value={e.amount} /> },
              { key: 'expenseDate', header: 'التاريخ', render: (e) => <span className="text-gray-500 text-xs font-mono">{e.expenseDate}</span> },
              { key: 'status', header: 'الحالة', render: (e) => {
                const s = statusMap[e.status]
                return <Badge variant={s.variant} dot>{s.label}</Badge>
              }},
              { key: 'actions', header: '', render: (e) => e.status === 'pending' && canApprove ? (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-success-500" onClick={() => setConfirmAction({ expense: e, type: 'approve' })}>
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger-500" onClick={() => setConfirmAction({ expense: e, type: 'reject' })}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : null },
            ]}
            data={data} keyExtractor={(e) => e.id} emptyMessage="لا توجد مصروفات"
          />
            {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPage={setPage} />}
          </>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="مصروف جديد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
            <Button loading={isCreating} onClick={handleSubmit((d) => create(d))}>حفظ</Button>
          </>
        }
      >
        <form className="flex flex-col gap-5">
          <div>
            <label className="text-sm text-gray-400 block mb-1">الفرع</label>
            <select {...register('branchId')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="">اختر الفرع</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {errors.branchId && <p className="text-danger-500 text-xs mt-1">{errors.branchId.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">الفئة</label>
            <select {...register('categoryId')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="">اختر الفئة</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <p className="text-danger-500 text-xs mt-1">{errors.categoryId.message}</p>}
          </div>

          <Input label="الوصف" error={errors.description?.message} {...register('description')} />
          <Input label="المبلغ (ج)" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
          <Input label="تاريخ المصروف" type="date" error={errors.expenseDate?.message} {...register('expenseDate')} />
          <Input label="طريقة الدفع (اختياري)" placeholder="نقدي، تحويل، ..." {...register('paymentMethod')} />
        </form>
      </Drawer>

      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'approve' ? 'اعتماد المصروف' : 'رفض المصروف'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>إلغاء</Button>
            <Button
              variant={confirmAction?.type === 'approve' ? 'primary' : 'danger'}
              loading={isReviewing}
              onClick={() => confirmAction && reviewExpense(confirmAction)}
            >
              {confirmAction?.type === 'approve' ? 'اعتماد' : 'رفض'}
            </Button>
          </>
        }
      >
        <p className="text-gray-300">
          {confirmAction?.type === 'approve' ? 'هل تريد اعتماد مصروف' : 'هل تريد رفض مصروف'}
          {' '}<strong className="text-gray-100">{confirmAction?.expense.description}</strong>
          {' '}بقيمة <strong className="text-gray-100">{confirmAction?.expense.amount} ج</strong>؟
        </p>
      </Modal>
    </AppShell>
  )
}
