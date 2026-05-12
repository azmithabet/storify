import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Money, Badge, SkeletonTable } from '@/components/ui'
import { api } from '@/api/client'

interface Expense { id: string; description: string; amount: number; categoryName: string; status: string; createdAt: string }

export default function Expenses() {
  const { data = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: async () => (await api.get<Expense[]>('/expenses')).data,
  })
  return (
    <AppShell title="المصروفات">
      {isLoading ? <SkeletonTable rows={8} cols={4} /> : (
        <Table
          columns={[
            { key: 'description', header: 'الوصف', render: (e) => <span className="font-medium text-gray-100">{e.description}</span> },
            { key: 'categoryName', header: 'الفئة', className: 'text-gray-400' },
            { key: 'amount', header: 'المبلغ', render: (e) => <Money value={e.amount} /> },
            { key: 'status', header: 'الحالة', render: (e) => (
              <Badge variant={e.status === 'approved' ? 'success' : e.status === 'rejected' ? 'danger' : 'warning'} dot>
                {e.status === 'approved' ? 'موافق' : e.status === 'rejected' ? 'مرفوض' : 'انتظار'}
              </Badge>
            )},
            { key: 'createdAt', header: 'التاريخ', render: (e) => <span className="text-gray-500 text-xs">{new Date(e.createdAt).toLocaleDateString('ar-EG')}</span> },
          ]}
          data={data} keyExtractor={(e) => e.id} emptyMessage="لا توجد مصروفات"
        />
      )}
    </AppShell>
  )
}
