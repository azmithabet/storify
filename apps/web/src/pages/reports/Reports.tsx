import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, Button, SkeletonTable, Table, Money } from '@/components/ui'
import { api } from '@/api/client'

interface SalesSummary {
  totalRevenue: number
  subtotal: number
  taxTotal: number
  discountTotal: number
  feeTotal: number
  invoiceCount: number
}

interface ByPeriod { period: string; revenue: number; count: number }

interface SalesReport {
  summary: SalesSummary
  byPeriod: ByPeriod[]
}

export default function Reports() {
  const [tab, setTab] = useState<'sales'|'stock'|'installments'|'pnl'>('sales')

  const { data: salesData, isLoading } = useQuery<SalesReport>({
    queryKey: ['reports-sales'],
    queryFn: async () => (await api.get<{data: SalesReport}>('/reports/sales')).data.data,
    enabled: tab === 'sales',
  })

  const tabs = [
    { id: 'sales', label: 'المبيعات' },
    { id: 'stock', label: 'المخزون' },
    { id: 'installments', label: 'الأقساط' },
    { id: 'pnl', label: 'الأرباح والخسائر' },
  ] as const

  const summary = salesData?.summary
  const byPeriod = salesData?.byPeriod ?? []

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
              <StatCard label="إجمالي المبيعات" value={`${(summary?.totalRevenue ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-brand-500" />
              <StatCard label="إجمالي الرسوم" value={`${(summary?.feeTotal ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-warning-500" />
              <StatCard label="عدد الفواتير" value={summary?.invoiceCount ?? 0} accentColor="bg-success-500" />
            </div>
            {isLoading ? <SkeletonTable rows={8} cols={3} /> : (
              <Table
                columns={[
                  { key: 'period', header: 'الفترة', render: (r) => <span className="text-gray-500 font-mono">{r.period}</span> },
                  { key: 'count', header: 'الفواتير', className: 'font-mono text-center' },
                  { key: 'revenue', header: 'الإيرادات', render: (r) => <Money value={r.revenue} /> },
                ]}
                data={byPeriod} keyExtractor={(r) => r.period} emptyMessage="لا توجد بيانات"
              />
            )}
          </>
        )}
        {tab !== 'sales' && <div className="text-gray-500 text-center py-20">قريباً...</div>}
      </div>
    </AppShell>
  )
}
