import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Filter } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, Button, SkeletonTable, Table, Money, Badge } from '@/components/ui'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SalesSummary { totalRevenue: number; subtotal: number; taxTotal: number; discountTotal: number; feeTotal: number; invoiceCount: number }
interface ByPeriod { period: string; revenue: number; count: number }
interface SalesReport { summary: SalesSummary; byPeriod: ByPeriod[] }

interface StockItem { variantId: string; branchId: string; product: { name: string }; branch: { name: string }; sku: string; quantity: number; minQuantity: number; isLowStock: boolean; stockValue: number }
interface StockSummary { totalVariants: number; lowStockCount: number; totalStockValue: number }
interface StockReport { summary: StockSummary; items: StockItem[] }

interface InstallmentSummary { active: number; overdue: number; completed: number; pendingApproval: number; totalReceivables: number }
interface InstallmentReport { summary: InstallmentSummary }

interface PnLReport { revenue: number; cogs: number; grossProfit: number; grossMargin: number; operatingExpenses: number; netProfit: number; netMargin: number }

interface FeeSummary { totalMerchantFees: number; totalCustomerFees: number; totalFees: number }
interface FeeByPM { paymentMethod: { id: string; name?: string; type?: string }; feeBearer: string; totalFees: number; count: number }
interface FeesReport { summary: FeeSummary; byPaymentMethod: FeeByPM[] }

interface TopProduct { productName: string; variantSku: string; totalQty: number; totalRevenue: number }

interface Branch { id: string; name: string }

// ─── Date helpers ─────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

// ─── Filter bar ───────────────────────────────────────────────────────────────
interface Filters {
  from: string
  to: string
  branchId: string
  groupBy: 'day' | 'week' | 'month'
  lowStockOnly: boolean
}

function FilterBar({
  filters,
  onChange,
  showGroupBy = false,
  showLowStock = false,
  branches,
  isSuperAdmin,
}: {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
  showGroupBy?: boolean
  showLowStock?: boolean
  branches: Branch[]
  isSuperAdmin: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-800 border border-gray-700 rounded-lg">
      <Filter className="w-4 h-4 text-gray-500 shrink-0" />
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">من</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => onChange({ from: e.target.value })}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">إلى</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => onChange({ to: e.target.value })}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
        />
      </div>
      {isSuperAdmin && branches.length > 1 && (
        <select
          value={filters.branchId}
          onChange={(e) => onChange({ branchId: e.target.value })}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
        >
          <option value="">كل الفروع</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      {showGroupBy && (
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as const).map((g) => (
            <button
              key={g}
              onClick={() => onChange({ groupBy: g })}
              className={`px-2 py-1 rounded text-xs transition-colors ${filters.groupBy === g ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
            >
              {g === 'day' ? 'يومي' : g === 'week' ? 'أسبوعي' : 'شهري'}
            </button>
          ))}
        </div>
      )}
      {showLowStock && (
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={filters.lowStockOnly} onChange={(e) => onChange({ lowStockOnly: e.target.checked })} className="accent-brand-500" />
          منخفض المخزون فقط
        </label>
      )}
      <div className="flex gap-2 mr-auto">
        <button
          className="text-xs text-gray-500 hover:text-gray-300 underline"
          onClick={() => onChange({ from: monthStart(), to: today() })}
        >هذا الشهر</button>
        <button
          className="text-xs text-gray-500 hover:text-gray-300 underline"
          onClick={() => {
            const d = new Date(); d.setFullYear(d.getFullYear() - 1)
            onChange({ from: d.toISOString().slice(0, 10), to: today() })
          }}
        >سنة كاملة</button>
        <button
          className="text-xs text-gray-500 hover:text-gray-300 underline"
          onClick={() => onChange({ from: '', to: '' })}
        >الكل</button>
      </div>
    </div>
  )
}

// ─── Excel download helper ────────────────────────────────────────────────────
function buildParams(filters: Filters, extra?: Record<string, string>) {
  const p: Record<string, string> = {}
  if (filters.from) p.from = filters.from
  if (filters.to) p.to = filters.to
  if (filters.branchId) p.branchId = filters.branchId
  return { ...p, ...extra }
}

async function downloadExcel(path: string, params: Record<string, string>, filename: string) {
  const res = await api.get(path, { params: { ...params, format: 'excel' }, responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([res.data as BlobPart]))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Reports() {
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = user?.roleSlug === 'super_admin'

  const [tab, setTab] = useState<'sales' | 'stock' | 'installments' | 'pnl' | 'fees' | 'top'>('sales')
  const [filters, setFilters] = useState<Filters>({
    from: monthStart(),
    to: today(),
    branchId: '',
    groupBy: 'day',
    lowStockOnly: false,
  })

  const patchFilters = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))

  const tabs = [
    { id: 'sales', label: 'المبيعات' },
    { id: 'stock', label: 'المخزون' },
    { id: 'installments', label: 'الأقساط' },
    { id: 'pnl', label: 'الأرباح والخسائر' },
    { id: 'fees', label: 'رسوم الدفع' },
    { id: 'top', label: 'أكثر المنتجات مبيعاً' },
  ] as const

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await api.get<{ data: Branch[] }>('/branches')).data.data,
    enabled: isSuperAdmin,
  })

  // ── Sales ────────────────────────────────────────────────────────────────────
  const salesParams = buildParams(filters, { groupBy: filters.groupBy })
  const { data: salesData, isLoading: salesLoading } = useQuery<SalesReport>({
    queryKey: ['reports-sales', salesParams],
    queryFn: async () => (await api.get<{ data: SalesReport }>('/reports/sales', { params: salesParams })).data.data,
    enabled: tab === 'sales',
  })

  // ── Stock ────────────────────────────────────────────────────────────────────
  const stockParams = buildParams({ ...filters, from: '', to: '' }, { lowStockOnly: filters.lowStockOnly ? 'true' : 'false' })
  const { data: stockData, isLoading: stockLoading } = useQuery<StockReport>({
    queryKey: ['reports-stock', stockParams],
    queryFn: async () => (await api.get<{ data: StockReport }>('/reports/stock', { params: stockParams })).data.data,
    enabled: tab === 'stock',
  })

  // ── Installments ─────────────────────────────────────────────────────────────
  const installParams = buildParams({ ...filters, from: '', to: '' })
  const { data: installData, isLoading: installLoading } = useQuery<InstallmentReport>({
    queryKey: ['reports-installments', installParams],
    queryFn: async () => (await api.get<{ data: InstallmentReport }>('/reports/installments', { params: installParams })).data.data,
    enabled: tab === 'installments',
  })

  // ── P&L ──────────────────────────────────────────────────────────────────────
  const pnlParams = buildParams(filters)
  const { data: pnlData, isLoading: pnlLoading } = useQuery<PnLReport>({
    queryKey: ['reports-pnl', pnlParams],
    queryFn: async () => (await api.get<{ data: PnLReport }>('/reports/profit-loss', { params: pnlParams })).data.data,
    enabled: tab === 'pnl',
  })

  const feesParams = buildParams(filters)
  const { data: feesData, isLoading: feesLoading } = useQuery<FeesReport>({
    queryKey: ['reports-fees', feesParams],
    queryFn: async () => (await api.get<{ data: FeesReport }>('/reports/fees', { params: feesParams })).data.data,
    enabled: tab === 'fees',
  })

  const topParams = buildParams(filters, { limit: '20' })
  const { data: topData, isLoading: topLoading } = useQuery<TopProduct[]>({
    queryKey: ['reports-top', topParams],
    queryFn: async () => (await api.get<{ data: TopProduct[] }>('/reports/top-products', { params: topParams })).data.data,
    enabled: tab === 'top',
  })

  const salesSummary = salesData?.summary
  const byPeriod = salesData?.byPeriod ?? []
  const stockSummary = stockData?.summary
  const stockItems = stockData?.items ?? []
  const installSummary = installData?.summary

  return (
    <AppShell title="التقارير">
      <div className="flex flex-col gap-5">

        {/* Tab selector */}
        <div className="flex gap-2">
          {tabs.map((t) => (
            <Button key={t.id} variant={tab === t.id ? 'primary' : 'ghost'} size="sm" onClick={() => setTab(t.id as typeof tab)}>{t.label}</Button>
          ))}
        </div>

        {/* ── Sales Tab ─────────────────────────────────────────────────────── */}
        {tab === 'sales' && (
          <>
            <FilterBar filters={filters} onChange={patchFilters} showGroupBy branches={branches} isSuperAdmin={isSuperAdmin} />
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="إجمالي المبيعات" value={`${(salesSummary?.totalRevenue ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-brand-500" />
              <StatCard label="إجمالي الرسوم" value={`${(salesSummary?.feeTotal ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-warning-500" />
              <StatCard label="عدد الفواتير" value={salesSummary?.invoiceCount ?? 0} accentColor="bg-success-500" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {filters.from && filters.to ? `${filters.from} — ${filters.to}` : 'كل الفترات'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => downloadExcel('/reports/sales', salesParams, 'sales-report.xlsx')}>
                <Download className="w-3 h-3" />تصدير Excel
              </Button>
            </div>
            {salesLoading ? <SkeletonTable rows={8} cols={3} /> : (
              <Table
                columns={[
                  { key: 'period', header: 'الفترة', render: (r) => <span className="text-gray-400 font-mono text-sm">{r.period}</span> },
                  { key: 'count', header: 'الفواتير', className: 'font-mono text-center text-gray-300' },
                  { key: 'revenue', header: 'الإيرادات', render: (r) => <Money value={r.revenue} /> },
                ]}
                data={byPeriod} keyExtractor={(r) => r.period} emptyMessage="لا توجد بيانات في هذه الفترة"
              />
            )}
          </>
        )}

        {/* ── Stock Tab ─────────────────────────────────────────────────────── */}
        {tab === 'stock' && (
          <>
            <FilterBar filters={filters} onChange={patchFilters} showLowStock branches={branches} isSuperAdmin={isSuperAdmin} />
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="إجمالي الأصناف" value={stockSummary?.totalVariants ?? 0} accentColor="bg-brand-500" />
              <StatCard label="مخزون منخفض" value={stockSummary?.lowStockCount ?? 0} accentColor="bg-warning-500" />
              <StatCard label="قيمة المخزون" value={`${(stockSummary?.totalStockValue ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-success-500" />
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => downloadExcel('/reports/stock', stockParams, 'stock-report.xlsx')}>
                <Download className="w-3 h-3" />تصدير Excel
              </Button>
            </div>
            {stockLoading ? <SkeletonTable rows={8} cols={5} /> : (
              <Table
                columns={[
                  { key: 'product', header: 'المنتج', render: (s) => <span className="font-medium text-gray-100">{s.product.name}</span> },
                  { key: 'sku', header: 'SKU', className: 'font-mono text-gray-500 text-sm' },
                  { key: 'branch', header: 'الفرع', render: (s) => <span className="text-gray-400">{s.branch.name}</span> },
                  { key: 'quantity', header: 'الكمية', render: (s) => (
                    <span className={s.quantity === 0 ? 'text-danger-500 font-bold' : s.isLowStock ? 'text-warning-500' : 'text-success-500'}>{s.quantity}</span>
                  )},
                  { key: 'status', header: 'الحالة', render: (s) => s.quantity === 0
                    ? <Badge variant="danger" dot>نفذ</Badge>
                    : s.isLowStock ? <Badge variant="warning" dot>منخفض</Badge>
                    : null
                  },
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
            <FilterBar filters={filters} onChange={patchFilters} branches={branches} isSuperAdmin={isSuperAdmin} />
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
          <>
            <FilterBar filters={filters} onChange={patchFilters} branches={branches} isSuperAdmin={isSuperAdmin} />
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => downloadExcel('/reports/profit-loss', pnlParams, 'profit-loss.xlsx')}>
                <Download className="w-3 h-3" />تصدير Excel
              </Button>
            </div>
            {pnlLoading ? <SkeletonTable rows={6} cols={2} /> : (
              <div className="max-w-lg bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
                {[
                  { label: 'الإيرادات', value: pnlData?.revenue ?? 0, cls: 'text-success-400' },
                  { label: 'تكلفة المبيعات (COGS)', value: -(pnlData?.cogs ?? 0), cls: 'text-danger-400' },
                  { label: 'إجمالي الربح', value: pnlData?.grossProfit ?? 0, cls: 'text-brand-400 font-semibold', margin: pnlData?.grossMargin },
                  { label: 'مصروفات التشغيل', value: -(pnlData?.operatingExpenses ?? 0), cls: 'text-danger-400' },
                  { label: 'صافي الربح', value: pnlData?.netProfit ?? 0, cls: 'text-success-300 font-bold text-base', margin: pnlData?.netMargin },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center px-6 py-4">
                    <div>
                      <span className="text-sm text-gray-300">{row.label}</span>
                      {row.margin !== undefined && (
                        <span className="text-xs text-gray-500 mr-2">({row.margin.toFixed(1)}%)</span>
                      )}
                    </div>
                    <span className={`font-mono ${row.cls}`}>{row.value.toLocaleString('ar-EG')} ج</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Fees Tab ──────────────────────────────────────────────────────── */}
        {tab === 'fees' && (
          <>
            <FilterBar filters={filters} onChange={patchFilters} branches={branches} isSuperAdmin={isSuperAdmin} />
            {feesLoading ? <SkeletonTable rows={5} cols={4} /> : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <StatCard label="إجمالي الرسوم" value={`${(feesData?.summary.totalFees ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-brand-500" />
                  <StatCard label="رسوم على التاجر" value={`${(feesData?.summary.totalMerchantFees ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-danger-500" />
                  <StatCard label="رسوم على العميل" value={`${(feesData?.summary.totalCustomerFees ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-success-500" />
                </div>
                <Table
                  columns={[
                    { key: 'pm', header: 'طريقة الدفع', render: (r) => <span className="font-medium text-gray-100">{r.paymentMethod.name ?? '—'}</span> },
                    { key: 'bearer', header: 'يتحمل الرسوم', render: (r) => (
                      <Badge variant={r.feeBearer === 'merchant' ? 'danger' : 'success'}>
                        {r.feeBearer === 'merchant' ? 'التاجر' : 'العميل'}
                      </Badge>
                    )},
                    { key: 'count', header: 'عدد الفواتير', render: (r) => <span className="font-mono text-gray-400">{r.count}</span> },
                    { key: 'total', header: 'إجمالي الرسوم', render: (r) => <Money value={r.totalFees} /> },
                  ]}
                  data={feesData?.byPaymentMethod ?? []}
                  keyExtractor={(r) => `${r.paymentMethod.id}-${r.feeBearer}`}
                  emptyMessage="لا توجد رسوم في هذه الفترة"
                />
              </>
            )}
          </>
        )}

        {/* ── Top Products Tab ──────────────────────────────────────────────── */}
        {tab === 'top' && (
          <>
            <FilterBar filters={filters} onChange={patchFilters} branches={branches} isSuperAdmin={isSuperAdmin} />
            {topLoading ? <SkeletonTable rows={10} cols={4} /> : (
              <Table
                columns={[
                  { key: 'rank', header: '#', render: (r) => <span className="font-mono text-gray-500">{(topData ?? []).indexOf(r) + 1}</span> },
                  { key: 'product', header: 'المنتج', render: (r) => <span className="font-medium text-gray-100">{r.productName}</span> },
                  { key: 'sku', header: 'SKU', render: (r) => <span className="font-mono text-gray-500 text-xs">{r.variantSku}</span> },
                  { key: 'qty', header: 'الكمية المباعة', render: (r) => <span className="font-mono text-brand-400">{r.totalQty.toLocaleString('ar-EG')}</span> },
                  { key: 'revenue', header: 'الإيرادات', render: (r) => <Money value={r.totalRevenue} /> },
                ]}
                data={topData ?? []}
                keyExtractor={(r) => r.variantSku}
                emptyMessage="لا توجد بيانات مبيعات في هذه الفترة"
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
