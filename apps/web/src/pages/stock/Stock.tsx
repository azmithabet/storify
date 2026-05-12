import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Badge, SkeletonTable } from '@/components/ui'
import { api } from '@/api/client'

interface StockEntry { id: string; variantSku: string; productName: string; branchName: string; quantity: number; minQuantity: number }

export default function Stock() {
  const [_tab, _setTab] = useState<'overview' | 'movements'>('overview')
  const { data = [], isLoading } = useQuery<StockEntry[]>({
    queryKey: ['stock'],
    queryFn: async () => (await api.get<StockEntry[]>('/stock')).data,
  })
  return (
    <AppShell title="المخزون">
      {isLoading ? <SkeletonTable rows={10} cols={5} /> : (
        <Table
          columns={[
            { key: 'productName', header: 'المنتج', render: (s) => <span className="font-medium text-gray-100">{s.productName}</span> },
            { key: 'variantSku', header: 'SKU', className: 'font-mono text-gray-500' },
            { key: 'branchName', header: 'الفرع' },
            { key: 'quantity', header: 'الكمية', render: (s) => (
              <span className={s.quantity === 0 ? 'text-danger-600 font-bold' : s.quantity <= s.minQuantity ? 'text-warning-600' : 'text-success-600'}>
                {s.quantity}
              </span>
            )},
            { key: 'alert', header: 'التنبيه', render: (s) => s.quantity <= s.minQuantity && s.quantity > 0
              ? <Badge variant="warning" dot>مخزون منخفض</Badge>
              : s.quantity === 0 ? <Badge variant="danger" dot>نفذ</Badge> : null },
          ]}
          data={data} keyExtractor={(s) => s.id} emptyMessage="لا توجد بيانات مخزون"
        />
      )}
    </AppShell>
  )
}
