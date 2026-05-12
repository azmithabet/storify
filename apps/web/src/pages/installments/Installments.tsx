import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Badge, Money, SkeletonTable } from '@/components/ui'
import { api } from '@/api/client'

interface InstallmentContract { id: string; contractNumber: string; customerName: string; totalAmount: number; remainingAmount: number; status: string; nextDueDate?: string }

const statusMap: Record<string, { label: string; variant: 'warning'|'success'|'danger'|'gray'|'info' }> = {
  pending_approval: { label: 'انتظار موافقة', variant: 'warning' },
  active: { label: 'نشط', variant: 'success' },
  overdue: { label: 'متأخر', variant: 'danger' },
  completed: { label: 'مكتمل', variant: 'info' },
  cancelled: { label: 'ملغي', variant: 'gray' },
}

export default function Installments() {
  const { data = [], isLoading } = useQuery<InstallmentContract[]>({
    queryKey: ['installments'],
    queryFn: async () => (await api.get<InstallmentContract[]>('/installments')).data,
  })
  return (
    <AppShell title="الأقساط">
      {isLoading ? <SkeletonTable rows={8} cols={5} /> : (
        <Table
          columns={[
            { key: 'contractNumber', header: 'رقم العقد', className: 'font-mono text-brand-400' },
            { key: 'customerName', header: 'العميل', render: (c) => <span className="font-medium text-gray-100">{c.customerName}</span> },
            { key: 'totalAmount', header: 'إجمالي العقد', render: (c) => <Money value={c.totalAmount} /> },
            { key: 'remainingAmount', header: 'المتبقي', render: (c) => <Money value={c.remainingAmount} /> },
            { key: 'status', header: 'الحالة', render: (c) => { const s = statusMap[c.status]; return s ? <Badge variant={s.variant} dot>{s.label}</Badge> : c.status } },
            { key: 'nextDueDate', header: 'الاستحقاق القادم', render: (c) => c.nextDueDate ? <span className="text-gray-500 text-xs">{new Date(c.nextDueDate).toLocaleDateString('ar-EG')}</span> : <span className="text-gray-600">—</span> },
          ]}
          data={data} keyExtractor={(c) => c.id} emptyMessage="لا توجد عقود أقساط"
        />
      )}
    </AppShell>
  )
}
