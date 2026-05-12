import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Badge, Money, SkeletonTable, Input } from '@/components/ui'
import { Search } from 'lucide-react'
import { api } from '@/api/client'

interface Invoice { id: string; invoiceNumber: string; customerName?: string; totalAmount: number; status: string; paymentMethodName: string; createdAt: string }

const statusMap: Record<string, { label: string; variant: 'success'|'warning'|'danger'|'gray' }> = {
  completed: { label: 'مكتملة', variant: 'success' },
  pending: { label: 'معلقة', variant: 'warning' },
  cancelled: { label: 'ملغاة', variant: 'danger' },
  returned: { label: 'مرتجعة', variant: 'gray' },
}

export default function Invoices() {
  const [search, setSearch] = useState('')
  const { data = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', search],
    queryFn: async () => (await api.get<Invoice[]>('/invoices', { params: { search, limit: 50 } })).data,
  })
  return (
    <AppShell title="الفواتير">
      <div className="flex flex-col gap-6">
        <div className="max-w-xs"><Input placeholder="بحث برقم الفاتورة..." value={search} onChange={(e) => setSearch(e.target.value)} startIcon={<Search className="w-4 h-4" />} /></div>
        {isLoading ? <SkeletonTable rows={8} cols={5} /> : (
          <Table
            columns={[
              { key: 'invoiceNumber', header: 'رقم الفاتورة', className: 'font-mono text-brand-400' },
              { key: 'customerName', header: 'العميل', render: (i) => i.customerName ?? <span className="text-gray-500">—</span> },
              { key: 'paymentMethodName', header: 'طريقة الدفع', className: 'text-gray-400' },
              { key: 'totalAmount', header: 'الإجمالي', render: (i) => <Money value={i.totalAmount} /> },
              { key: 'status', header: 'الحالة', render: (i) => { const s = statusMap[i.status]; return s ? <Badge variant={s.variant} dot>{s.label}</Badge> : i.status } },
              { key: 'createdAt', header: 'التاريخ', render: (i) => <span className="text-gray-500 text-xs">{new Date(i.createdAt).toLocaleDateString('ar-EG')}</span> },
            ]}
            data={data} keyExtractor={(i) => i.id} emptyMessage="لا توجد فواتير"
          />
        )}
      </div>
    </AppShell>
  )
}
