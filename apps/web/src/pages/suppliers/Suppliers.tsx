import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Money, SkeletonTable, Badge } from '@/components/ui'
import { api } from '@/api/client'

interface Supplier { id: string; name: string; phone?: string; balance: number; totalOrders: number }

export default function Suppliers() {
  const { data = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get<{data:Supplier[]}>('/suppliers')).data.data,
  })
  return (
    <AppShell title="الموردون">
      {isLoading ? <SkeletonTable rows={8} cols={4} /> : (
        <Table
          columns={[
            { key: 'name', header: 'المورد', render: (s) => <span className="font-medium text-gray-100">{s.name}</span> },
            { key: 'phone', header: 'الهاتف', className: 'font-mono text-gray-500' },
            { key: 'totalOrders', header: 'الطلبات', className: 'text-center font-mono' },
            { key: 'balance', header: 'الرصيد المستحق', render: (s) => s.balance > 0 ? <Money value={s.balance} /> : <Badge variant="success" dot>مسدد</Badge> },
          ]}
          data={data} keyExtractor={(s) => s.id} emptyMessage="لا يوجد موردون"
        />
      )}
    </AppShell>
  )
}
