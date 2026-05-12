import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, Button, SkeletonTable, Table, Money } from '@/components/ui'
import { api } from '@/api/client'

// ─── Sales ────────────────────────────────────────────────────────────────────
interface SalesSummary { totalRevenue: number; subtotal: number; taxTotal: number; discountTotal: number; feeTotal: number; invoiceCount: number }
interface ByPeriod { period: string; revenue: number; count: number }
interface SalesReport { summary: SalesSummary; byPeriod: ByPeriod[] }

// ─── Stock ────────────────────────────────────────────────────────────────────
interface StockItem { variantId: string; branchId: string; product: { name: string }; branch: { name: string }; sku: string; quantity: number; minQuantity: number; isLowStock: boolean; stockValue: number }
interface StockSummary { totalVariants: number; lowStockCount: number; totalStockValue: number }
interface StockReport { summary: StockSummary; items: StockItem[] }

// ─── Installments ─────────────────────────────────────────────────────────────
interface InstallmentSummary { active: number; overdue: number; completed: number; pendingApproval: number; totalReceivables: number }
interface InstallmentReport { summary: InstallmentSummary }

// ─── P&L ──────────────────────────────────────────────────────────────────────
interface PnLReport { revenue: number; cogs: number; grossProfit: number; grossMargin: number; operatingExpenses: number; netProfit: number; netMargin: number }

export default function Reports() {
  const [tab, setTab] = useState<'sales' | 'stock' | 'installments' | 'pnl'>('sales')

  const tabs = [
    { id: 'sales', label: 'المبيعات' },
    { id: 'stock', label: 'المخزون' },
    { id: 'installments', label: 'الأقساط' },
    { id: 'pnl', label: 'الأرباح والخسائر' },
  ] as const

  // ── Sales ────────────────────────────────────────────────────────────────────
  const { data: salesData, isLoading: salesLoading } = useQuery<SalesReport>({
    queryKey: ['reports-sales'],
    queryFn: async () => (await api.get<{ data: SalesReport }>('/reports/sales')).data.data,
    enabled: tab === 'sales',
  })

  // ── Stock ────────────────────────────────────────────────────────────────────
  const { data: stockData, isLoading: stockLoading } = useQuery<StockReport>({
    queryKey: ['reports-stock'],
    queryFn: async () => (await api.get<{ data: StockReport }>('/reports/stock')).data.data,
    enabled: tab === 'stock',
  })

  // ── Installments ─────────────────────────────────────────────────────────────
  const { data: installData, isLoading: installLoading } = useQuery<InstallmentReport>({
    queryKey: ['reports-installments'],
    queryFn: async () => (await api.get<{ data: InstallmentReport }>('/reports/installments')).data.data,
    enabled: tab === 'installments',
  })

  // ── P&L ──────────────────────────────────────────────────────────────────────
  const { data: pnlData, isLoading: pnlLoading } = useQuery<PnLReport>({
    queryKey: ['reports-pnl'],
    queryFn: async () => (await api.get<{ data: PnLReport }>('/reports/pnl')).data.data,
    enabled: tab === 'pnl',
  })

  const salesSummary = salesData?.summary
  const byPeriod = salesData?.byPeriod ?? []
  const stockSummary = stockData?.summary
  const stockItems = stockData?.items ?? []
  const installSummary = installData?.summary

  return (
    <AppShell title="التقارير">
      <div className="flex flex-col gap-6">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <Button key={t.id} variant={tab === t.id ? 'primary' : 'ghost'} size="sm" onClick={() => setTab(t.id as typeof tab)}>{t.label}</Button>
          ))}
        </div>

        {/* ── Sales Tab ─────────────────────────────────────────────────────── */}
        {tab === 'sales' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="إجمالي المبيعات" value={`${(salesSummary?.totalRevenue ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-brand-500" />
              <StatCard label="إجمالي الرسوم" value={`${(salesSummary?.feeTotal ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-warning-500" />
              <StatCard label="عدد الفواتير" value={salesSummary?.invoiceCount ?? 0} accentColor="bg-success-500" />
            </div>
            {salesLoading ? <SkeletonTable rows={8} cols={3} /> : (
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

        {/* ── Stock Tab ─────────────────────────────────────────────────────── */}
        {tab === 'stock' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="إجمالي الأصناف" value={stockSummary?.totalVariants ?? 0} accentColor="bg-brand-500" />
              <StatCard label="مخزون منخفض" value={stockSummary?.lowStockCount ?? 0} accentColor="bg-warning-500" />
              <StatCard label="قيمة المخزون" value={`${(stockSummary?.totalStockValue ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-success-500" />
            </div>
            {stockLoading ? <SkeletonTable rows={8} cols={5} /> : (
              <Table
                columns={[
                  { key: 'product', header: 'المنتج', render: (s) => <span className="font-medium text-gray-100">{s.product.name}</span> },
                  { key: 'sku', header: 'SKU', className: 'font-mono text-gray-500' },
                  { key: 'branch', header: 'الفرع', render: (s) => <span className="text-gray-400">{s.branch.name}</span> },
                  { key: 'quantity', header: 'الكمية', render: (s) => (
                    <span className={s.quantity === 0 ? 'text-danger-600 font-bold' : s.isLowStock ? 'text-warning-500' : 'text-success-600'}>{s.quantity}</span>
                  )},
                  { key: 'stockValue', header: 'القيمة', render: (s) => <Money value={s.stockValue} /> },
                ]}
                data={stockItems} keyExtractor={(s) => `${s.variantId}-${s.branchId}`} emptyMessage="لا توجد بيانات"
              />
            )}
          </>
        )}

        {/* ── Installments Tab ──────────────────────────────────────────────── */}
        {tab === 'installments' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="عقود نشطة" value={installSummary?.active ?? 0} accentColor="bg-success-500" />
              <StatCard label="متأخرة" value={installSummary?.overdue ?? 0} accentColor="bg-danger-500" />
              <StatCard label="إجمالي المستحقات" value={`${(installSummary?.totalReceivables ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-brand-500" />
            </div>
            {installLoading ? <SkeletonTable rows={4} cols={3} /> : (
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="انتظار موافقة" value={installSummary?.pendingApproval ?? 0} accentColor="bg-warning-500" />
                <StatCard label="مكتملة" value={installSummary?.completed ?? 0} accentColor="bg-gray-500" />
              </div>
            )}
          </>
        )}

        {/* ── P&L Tab ───────────────────────────────────────────────────────── */}
        {tab === 'pnl' && (
          pnlLoading ? <SkeletonTable rows={6} cols={2} /> : (
            <div className="max-w-lg bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
              {[
                { label: 'الإيرادات', value: pnlData?.revenue ?? 0, className: 'text-success-400' },
                { label: 'تكلفة المبيعات (COGS)', value: -(pnlData?.cogs ?? 0), className: 'text-danger-400' },
                { label: 'إجمالي الربح', value: pnlData?.grossProfit ?? 0, className: 'text-brand-400 font-semibold', margin: pnlData?.grossMargin },
                { label: 'مصروفات التشغيل', value: -(pnlData?.operatingExpenses ?? 0), className: 'text-danger-400' },
                { label: 'صافي الربح', value: pnlData?.netProfit ?? 0, className: 'text-success-300 font-bold text-base', margin: pnlData?.netMargin },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center px-6 py-4">
                  <div>
                    <span className="text-sm text-gray-300">{row.label}</span>
                    {row.margin !== undefined && (
                      <span className="text-xs text-gray-500 mr-2">({row.margin.toFixed(1)}%)</span>
                    )}
                  </div>
                  <span className={`font-mono ${row.className}`}>
                    {row.value.toLocaleString('ar-EG')} ج
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </AppShell>
  )
}
