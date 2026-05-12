import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, Button, SkeletonTable, Table, Money } from '@/components/ui'
import { api } from '@/api/client'

interface SalesReport { date: string; totalSales: number; invoiceCount: number; totalFees: number }

export default function Reports() {
  const [tab, setTab] = useState<'sales'|'stock'|'installments'|'pnl'>('sales')

  const { data: sales = [], isLoading } = useQuery<SalesReport[]>({
    queryKey: ['reports-sales'],
    queryFn: async () => (await api.get<SalesReport[]>('/reports/sales')).data,
    enabled: tab === 'sales',
  })

  const tabs = [
    { id: 'sales', label: 'المبيعات' },
    { id: 'stock', label: 'المخزون' },
    { id: 'installments', label: 'الأقساط' },
    { id: 'pnl', label: 'الأرباح والخسائر' },
  ] as const

  const totalSales = sales.reduce((s, r) => s + r.totalSales, 0)
  const totalFees = sales.reduce((s, r) => s + r.totalFees, 0)

  return (
    <AppShell title="التقارير">
      <div className="flex flex-col gap-6">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <Button key={t.id} variant={tab === t.id ? 'primary' : 'ghost'} size="sm" onClick={() => setTab(t.id as typeof tab)}>{t.label}</Button>
          ))}
        </div>

        {tab === 'sales' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="إجمالي المبيعات" value={`${totalSales.toLocaleString('ar-EG')} ج`} accentColor="bg-brand-500" />
              <StatCard label="إجمالي الرسوم" value={`${totalFees.toLocaleString('ar-EG')} ج`} accentColor="bg-warning-500" />
              <StatCard label="عدد الفواتير" value={sales.reduce((s, r) => s + r.invoiceCount, 0)} accentColor="bg-success-500" />
            </div>
            {isLoading ? <SkeletonTable rows={8} cols={4} /> : (
              <Table
                columns={[
                  { key: 'date', header: 'التاريخ', render: (r) => <span className="text-gray-500 font-mono">{r.date}</span> },
                  { key: 'invoiceCount', header: 'الفواتير', className: 'font-mono text-center' },
                  { key: 'totalSales', header: 'المبيعات', render: (r) => <Money value={r.totalSales} /> },
                  { key: 'totalFees', header: 'الرسوم', render: (r) => <Money value={r.totalFees} /> },
                ]}
                data={sales} keyExtractor={(r) => r.date} emptyMessage="لا توجد بيانات"
              />
            )}
          </>
        )}
        {tab !== 'sales' && <div className="text-gray-500 text-center py-20">قريباً...</div>}
      </div>
    </AppShell>
  )
}
