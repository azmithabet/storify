import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Input, Table, Money, SkeletonTable } from '@/components/ui'
import { api } from '@/api/client'

interface Customer { id: string; fullName: string; phone?: string; email?: string; creditBalance: number; totalInvoices: number }

export default function Customers() {
  const [search, setSearch] = useState('')
  const { data = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: async () => (await api.get<{data:Customer[]}>('/customers', { params: { search, limit: 50 } })).data.data,
  })
  return (
    <AppShell title="العملاء">
      <div className="flex flex-col gap-6">
        <div className="max-w-xs"><Input placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} startIcon={<Search className="w-4 h-4" />} /></div>
        {isLoading ? <SkeletonTable rows={8} cols={5} /> : (
          <Table
            columns={[
              { key: 'fullName', header: 'الاسم', render: (c) => <span className="font-medium text-gray-100">{c.fullName}</span> },
              { key: 'phone', header: 'الهاتف', className: 'font-mono text-gray-500' },
              { key: 'email', header: 'البريد الإلكتروني', className: 'text-gray-500' },
              { key: 'totalInvoices', header: 'الفواتير', className: 'text-center font-mono' },
              { key: 'creditBalance', header: 'الرصيد', render: (c) => c.creditBalance > 0 ? <Money value={c.creditBalance} /> : <span className="text-gray-500">—</span> },
            ]}
            data={data} keyExtractor={(c) => c.id} emptyMessage="لا يوجد عملاء"
          />
        )}
      </div>
    </AppShell>
  )
}
