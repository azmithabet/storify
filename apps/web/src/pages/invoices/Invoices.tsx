import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Eye } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Input, Table, Badge, Money, SkeletonTable, Button, Drawer, Pagination } from '@/components/ui'
import { api } from '@/api/client'

interface InvoiceItem {
  id: string
  productName: string
  variantSku: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  customer?: { fullName: string; phone?: string }
  totalAmount: number
  subtotal: number
  feeAmount: number
  taxTotal: number
  discountAmount: number
  status: string
  paymentMethod?: { name: string; type: string }
  cashier?: { fullName: string }
  createdAt: string
  items?: InvoiceItem[]
}

interface Meta { total: number; page: number; limit: number; pages: number }

const LIMIT = 20

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'gray' }> = {
  completed: { label: 'مكتملة', variant: 'success' },
  pending: { label: 'معلقة', variant: 'warning' },
  cancelled: { label: 'ملغاة', variant: 'danger' },
  returned: { label: 'مرتجعة', variant: 'gray' },
}

export default function Invoices() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null)

  const { data, isLoading } = useQuery<{ data: Invoice[]; meta: Meta }>({
    queryKey: ['invoices', search, page],
    queryFn: async () => (await api.get<{ data: Invoice[]; meta: Meta }>('/invoices', { params: { search, limit: LIMIT, page } })).data,
  })

  const invoices = data?.data ?? []
  const meta = data?.meta

  const openDetail = async (inv: Invoice) => {
    const res = await api.get<{ data: Invoice }>(`/invoices/${inv.id}`)
    setDetailInvoice(res.data.data)
  }

  return (
    <AppShell title="الفواتير">
      <div className="flex flex-col gap-6">
        <div className="max-w-xs">
          <Input placeholder="بحث برقم الفاتورة..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} startIcon={<Search className="w-4 h-4" />} />
        </div>

        {isLoading ? <SkeletonTable rows={8} cols={6} /> : (
          <>
            <Table
              columns={[
                { key: 'invoiceNumber', header: 'رقم الفاتورة', render: (i) => (
                  <button className="font-mono text-brand-400 hover:underline" onClick={() => openDetail(i)}>{i.invoiceNumber}</button>
                )},
                { key: 'customer', header: 'العميل', render: (i) => i.customer?.fullName ?? <span className="text-gray-500">—</span> },
                { key: 'paymentMethod', header: 'طريقة الدفع', render: (i) => <span className="text-gray-400">{i.paymentMethod?.name ?? '—'}</span> },
                { key: 'totalAmount', header: 'الإجمالي', render: (i) => <Money value={i.totalAmount} /> },
                { key: 'status', header: 'الحالة', render: (i) => {
                  const s = statusMap[i.status]
                  return s ? <Badge variant={s.variant} dot>{s.label}</Badge> : <span>{i.status}</span>
                }},
                { key: 'createdAt', header: 'التاريخ', render: (i) => <span className="text-gray-500 text-xs">{new Date(i.createdAt).toLocaleDateString('ar-EG')}</span> },
                { key: 'actions', header: '', render: (i) => (
                  <Button variant="ghost" size="sm" onClick={() => openDetail(i)}><Eye className="w-3 h-3" /></Button>
                )},
              ]}
              data={invoices} keyExtractor={(i) => i.id} emptyMessage="لا توجد فواتير"
            />
            {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPage={setPage} />}
          </>
        )}
      </div>

      <Drawer open={!!detailInvoice} onClose={() => setDetailInvoice(null)} title={`فاتورة ${detailInvoice?.invoiceNumber ?? ''}`} width="w-[520px]">
        {detailInvoice && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">العميل</span><p className="text-gray-100 font-medium">{detailInvoice.customer?.fullName ?? 'نقدي'}</p></div>
              <div><span className="text-gray-500">الكاشير</span><p className="text-gray-100">{detailInvoice.cashier?.fullName ?? '—'}</p></div>
              <div><span className="text-gray-500">طريقة الدفع</span><p className="text-gray-100">{detailInvoice.paymentMethod?.name ?? '—'}</p></div>
              <div><span className="text-gray-500">التاريخ</span><p className="text-gray-100 font-mono text-xs">{new Date(detailInvoice.createdAt).toLocaleString('ar-EG')}</p></div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">الأصناف</h4>
              <div className="flex flex-col gap-1">
                {detailInvoice.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm py-2 border-b border-gray-700 last:border-0">
                    <div>
                      <p className="text-gray-100">{item.productName}</p>
                      <p className="text-gray-500 text-xs font-mono">{item.variantSku} × {item.quantity}</p>
                    </div>
                    <Money value={item.totalPrice} />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-750 rounded-md border border-gray-700 p-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-gray-400"><span>المجموع الفرعي</span><Money value={detailInvoice.subtotal} /></div>
              {detailInvoice.discountAmount > 0 && (
                <div className="flex justify-between text-danger-400"><span>الخصم</span><span>-<Money value={detailInvoice.discountAmount} /></span></div>
              )}
              {detailInvoice.taxTotal > 0 && (
                <div className="flex justify-between text-gray-400"><span>الضريبة</span><Money value={detailInvoice.taxTotal} /></div>
              )}
              {detailInvoice.feeAmount > 0 && (
                <div className="flex justify-between text-gray-400"><span>رسوم الدفع</span><Money value={detailInvoice.feeAmount} /></div>
              )}
              <div className="flex justify-between text-gray-100 font-semibold border-t border-gray-600 pt-2 mt-1">
                <span>الإجمالي</span><Money value={detailInvoice.totalAmount} />
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </AppShell>
  )
}
