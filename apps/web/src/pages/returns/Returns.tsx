import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Badge, Money, SkeletonTable, Pagination, Drawer } from '@/components/ui'
import { api } from '@/api/client'

interface ReturnItem {
  id: string
  quantity: number
  variant: { sku: string; product: { name: string } }
}

interface Return {
  id: string
  returnType: 'refund' | 'credit'
  amount: number
  reason?: string
  createdAt: string
  invoice: { invoiceNumber: string; customer?: { fullName: string } }
  processedBy: { fullName: string }
  items: ReturnItem[]
}

interface Meta { total: number; page: number; limit: number; pages: number }

const LIMIT = 20

const typeMap = {
  refund: { label: 'استرداد نقدي', variant: 'danger' as const },
  credit: { label: 'رصيد عميل', variant: 'success' as const },
}

function ReturnDetailDrawer({ ret }: { ret: Return }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">فاتورة</span><p className="font-mono text-gray-100">{ret.invoice.invoiceNumber}</p></div>
        <div><span className="text-gray-500">العميل</span><p className="text-gray-100">{ret.invoice.customer?.fullName ?? 'نقدي'}</p></div>
        <div><span className="text-gray-500">النوع</span><p><Badge variant={typeMap[ret.returnType].variant}>{typeMap[ret.returnType].label}</Badge></p></div>
        <div><span className="text-gray-500">بواسطة</span><p className="text-gray-100">{ret.processedBy.fullName}</p></div>
        <div><span className="text-gray-500">التاريخ</span><p className="text-gray-100 font-mono text-xs">{new Date(ret.createdAt).toLocaleString('ar-EG')}</p></div>
        <div><span className="text-gray-500">المبلغ المسترد</span><p><Money value={ret.amount} size="lg" /></p></div>
      </div>

      {ret.reason && (
        <div>
          <p className="text-xs text-gray-500 mb-1">سبب الإرجاع</p>
          <p className="text-sm text-gray-300 bg-gray-900 rounded-md px-3 py-2">{ret.reason}</p>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3">الأصناف المرتجعة</h4>
        <div className="flex flex-col divide-y divide-gray-700">
          {ret.items.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-100">{item.variant.product.name}</p>
                <p className="text-xs text-gray-500 font-mono">{item.variant.sku}</p>
              </div>
              <span className="font-mono text-sm text-gray-300">× {item.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Returns() {
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [detail, setDetail] = useState<Return | null>(null)

  const { data, isLoading } = useQuery<{ data: Return[]; meta: Meta }>({
    queryKey: ['returns', page, typeFilter, from, to],
    queryFn: async () =>
      (await api.get<{ data: Return[]; meta: Meta }>('/invoices/returns', {
        params: {
          page, limit: LIMIT,
          ...(typeFilter ? { returnType: typeFilter } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      })).data,
  })

  const returns = data?.data ?? []
  const meta = data?.meta

  return (
    <AppShell title="المرتجعات">
      <div className="flex flex-col gap-6">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
          >
            <option value="">كل الأنواع</option>
            <option value="refund">استرداد نقدي</option>
            <option value="credit">رصيد عميل</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1) }}
              className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
            />
            <span className="text-gray-500 text-sm">—</span>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1) }}
              className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {isLoading ? <SkeletonTable rows={8} cols={6} /> : (
          <>
            <Table
              columns={[
                { key: 'invoice', header: 'الفاتورة', render: (r) => (
                  <button className="font-mono text-brand-400 hover:underline" onClick={() => setDetail(r)}>
                    {r.invoice.invoiceNumber}
                  </button>
                )},
                { key: 'customer', header: 'العميل', render: (r) => r.invoice.customer?.fullName ?? <span className="text-gray-500">نقدي</span> },
                { key: 'returnType', header: 'النوع', render: (r) => <Badge variant={typeMap[r.returnType].variant}>{typeMap[r.returnType].label}</Badge> },
                { key: 'items', header: 'الأصناف', render: (r) => <span className="font-mono text-gray-400">{r.items.length} صنف</span> },
                { key: 'amount', header: 'المبلغ', render: (r) => <Money value={r.amount} /> },
                { key: 'processedBy', header: 'الموظف', render: (r) => <span className="text-gray-500 text-sm">{r.processedBy.fullName}</span> },
                { key: 'createdAt', header: 'التاريخ', render: (r) => <span className="text-gray-500 text-xs">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</span> },
              ]}
              data={returns} keyExtractor={(r) => r.id} emptyMessage="لا توجد مرتجعات"
            />
            {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPage={setPage} />}
          </>
        )}
      </div>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={`مرتجع فاتورة ${detail?.invoice.invoiceNumber ?? ''}`} width="w-[480px]">
        {detail && <ReturnDetailDrawer ret={detail} />}
      </Drawer>
    </AppShell>
  )
}
