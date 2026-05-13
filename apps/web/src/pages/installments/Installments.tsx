import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Badge, Money, SkeletonTable, Button, Modal, Drawer, Input, Pagination } from '@/components/ui'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'

interface Payment {
  id: string
  dueDate: string
  amount: number
  status: 'pending' | 'paid' | 'overdue'
  paidDate?: string
}

interface InstallmentContract {
  id: string
  contractNumber: string
  customer?: { fullName: string; phone?: string }
  totalAmount: number
  downPayment: number
  remainingAmount: number
  status: 'pending_approval' | 'active' | 'overdue' | 'completed' | 'cancelled'
  nextDueDate?: string
  installmentsCount: number
  payments?: Payment[]
}

const statusMap: Record<string, { label: string; variant: 'warning' | 'success' | 'danger' | 'gray' | 'info' }> = {
  pending_approval: { label: 'انتظار موافقة', variant: 'warning' } as const,
  active: { label: 'نشط', variant: 'success' },
  overdue: { label: 'متأخر', variant: 'danger' },
  completed: { label: 'مكتمل', variant: 'info' },
  cancelled: { label: 'ملغي', variant: 'gray' },
}

const LIMIT = 20

export default function Installments() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ contract: InstallmentContract; type: 'approve' | 'reject' } | null>(null)
  const [detailContract, setDetailContract] = useState<InstallmentContract | null>(null)

  const { data: listData, isLoading } = useQuery<{ data: InstallmentContract[]; meta: { total: number; page: number; limit: number; pages: number } }>({
    queryKey: ['installments', search, page, statusFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: LIMIT, page }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      return (await api.get<{ data: InstallmentContract[]; meta: { total: number; page: number; limit: number; pages: number } }>('/installments', { params })).data
    },
  })
  const data = listData?.data ?? []
  const meta = listData?.meta

  const { mutate: reviewContract, isPending: isReviewing } = useMutation({
    mutationFn: async ({ contract, type }: { contract: InstallmentContract; type: 'approve' | 'reject' }) =>
      api.patch(`/installments/${contract.id}/${type}`),
    onSuccess: (_, { type }) => {
      toast.success(type === 'approve' ? 'تمت الموافقة على العقد' : 'تم رفض العقد')
      qc.invalidateQueries({ queryKey: ['installments'] })
      setConfirmAction(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      toast.error(msg ?? 'حدث خطأ')
    },
  })

  const { mutate: recordPayment, isPending: isRecording } = useMutation({
    mutationFn: async ({ contractId, paymentId }: { contractId: string; paymentId: string }) =>
      api.post(`/installments/${contractId}/payments/${paymentId}/pay`, { paidDate: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => {
      toast.success('تم تسجيل الدفعة')
      qc.invalidateQueries({ queryKey: ['installments'] })
      if (detailContract) {
        api.get<{ data: InstallmentContract }>(`/installments/${detailContract.id}`)
          .then((r) => setDetailContract(r.data.data))
      }
    },
    onError: () => toast.error('حدث خطأ في تسجيل الدفعة'),
  })

  const openDetail = async (contract: InstallmentContract) => {
    const res = await api.get<{ data: InstallmentContract }>(`/installments/${contract.id}`)
    setDetailContract(res.data.data)
  }

  const canApprove = user?.roleSlug === 'super_admin' || user?.permissions?.installments?.includes('approve')

  return (
    <AppShell title="الأقساط">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 max-w-xs">
            <Input placeholder="بحث بالعميل أو رقم العقد..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} startIcon={<Search className="w-4 h-4" />} />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
            <option value="">كل الحالات</option>
            <option value="pending_approval">انتظار موافقة</option>
            <option value="active">نشط</option>
            <option value="overdue">متأخر</option>
            <option value="completed">مكتمل</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>
        {isLoading ? <SkeletonTable rows={8} cols={6} /> : (
          <>
          <Table
            columns={[
              { key: 'contractNumber', header: 'رقم العقد', render: (c) => (
                <button className="font-mono text-brand-400 hover:underline" onClick={() => openDetail(c)}>{c.contractNumber}</button>
              )},
              { key: 'customer', header: 'العميل', render: (c) => <span className="font-medium text-gray-100">{c.customer?.fullName ?? '—'}</span> },
              { key: 'totalAmount', header: 'إجمالي العقد', render: (c) => <Money value={c.totalAmount} /> },
              { key: 'remainingAmount', header: 'المتبقي', render: (c) => <Money value={c.remainingAmount} /> },
              { key: 'status', header: 'الحالة', render: (c) => {
                const s = statusMap[c.status]
                return s ? <Badge variant={s.variant} dot>{s.label}</Badge> : <span>{c.status}</span>
              }},
              { key: 'nextDueDate', header: 'الاستحقاق القادم', render: (c) => c.nextDueDate
                ? <span className="text-gray-500 text-xs">{new Date(c.nextDueDate).toLocaleDateString('ar-EG')}</span>
                : <span className="text-gray-600">—</span>
              },
              { key: 'actions', header: '', render: (c) => c.status === 'pending_approval' && canApprove ? (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-success-500" onClick={() => setConfirmAction({ contract: c, type: 'approve' })}>
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger-500" onClick={() => setConfirmAction({ contract: c, type: 'reject' })}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : null },
            ]}
            data={data} keyExtractor={(c) => c.id} emptyMessage="لا توجد عقود أقساط"
          />
          {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPage={setPage} />}
          </>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer open={!!detailContract} onClose={() => setDetailContract(null)} title={`عقد ${detailContract?.contractNumber ?? ''}`} width="w-[480px]">
        {detailContract && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">العميل</span><p className="text-gray-100 font-medium">{detailContract.customer?.fullName ?? '—'}</p></div>
              <div><span className="text-gray-500">الهاتف</span><p className="text-gray-100 font-mono">{detailContract.customer?.phone ?? '—'}</p></div>
              <div><span className="text-gray-500">إجمالي العقد</span><p className="text-gray-100"><Money value={detailContract.totalAmount} /></p></div>
              <div><span className="text-gray-500">المقدم</span><p className="text-gray-100"><Money value={detailContract.downPayment} /></p></div>
              <div><span className="text-gray-500">المتبقي</span><p className="text-gray-100"><Money value={detailContract.remainingAmount} /></p></div>
              <div><span className="text-gray-500">عدد الأقساط</span><p className="text-gray-100">{detailContract.installmentsCount}</p></div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">جدول السداد</h4>
              <div className="flex flex-col gap-2">
                {detailContract.payments?.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-750 rounded-md px-3 py-2 border border-gray-700">
                    <div>
                      <p className="text-sm font-mono text-gray-300">{new Date(p.dueDate).toLocaleDateString('ar-EG')}</p>
                      <p className="text-xs text-gray-500">{p.status === 'paid' ? `مدفوع ${p.paidDate ? new Date(p.paidDate).toLocaleDateString('ar-EG') : ''}` : p.status === 'overdue' ? 'متأخر' : 'معلق'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Money value={p.amount} />
                      {p.status !== 'paid' && detailContract.status === 'active' && (
                        <Button size="sm" loading={isRecording} onClick={() => recordPayment({ contractId: detailContract.id, paymentId: p.id })}>
                          <Check className="w-3 h-3" />تسجيل
                        </Button>
                      )}
                      {p.status === 'paid' && <Badge variant="success" dot>مدفوع</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Approve/Reject confirmation */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'approve' ? 'موافقة على العقد' : 'رفض العقد'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>إلغاء</Button>
            <Button
              variant={confirmAction?.type === 'approve' ? 'primary' : 'danger'}
              loading={isReviewing}
              onClick={() => confirmAction && reviewContract(confirmAction)}
            >
              {confirmAction?.type === 'approve' ? 'موافقة' : 'رفض'}
            </Button>
          </>
        }
      >
        <p className="text-gray-300">
          {confirmAction?.type === 'approve'
            ? `هل تريد الموافقة على عقد ${confirmAction.contract.contractNumber}؟ سيتم خصم المخزون عند الاعتماد.`
            : `هل تريد رفض عقد ${confirmAction?.contract.contractNumber}؟`}
        </p>
      </Modal>
    </AppShell>
  )
}
