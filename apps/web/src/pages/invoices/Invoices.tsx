import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Eye, RotateCcw, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Input, Table, Badge, Money, SkeletonTable, Button, Drawer, Pagination, Modal } from '@/components/ui'
import { api } from '@/api/client'

function printInvoice(inv: Invoice) {
  const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const rows = (inv.items ?? []).map((item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${item.productName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:left">${fmt(Number(item.unitPrice))}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:left">${fmt(Number(item.totalPrice))}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>فاتورة ${inv.invoiceNumber}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:13px;color:#111;background:#fff;padding:32px}
      h1{font-size:22px;font-weight:700;margin-bottom:4px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0;padding:16px;background:#f9fafb;border-radius:8px}
      .meta-item label{font-size:11px;color:#6b7280;display:block;margin-bottom:2px}
      .meta-item p{font-weight:600}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#f3f4f6;padding:10px 12px;text-align:right;font-size:12px;color:#374151}
      th:not(:first-child){text-align:center}
      th:last-child,th:nth-child(3){text-align:left}
      .totals{margin-top:20px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:260px}
      .totals-row{display:flex;justify-content:space-between;width:260px;font-size:13px;color:#374151}
      .totals-row.total{font-size:16px;font-weight:700;border-top:2px solid #111;padding-top:8px;margin-top:4px}
      .footer{margin-top:40px;text-align:center;font-size:11px;color:#9ca3af}
      @media print{body{padding:16px}}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>فاتورة ضريبية</h1>
        <p style="color:#6b7280;font-size:12px">Storify POS</p>
      </div>
      <div style="text-align:left">
        <p style="font-size:18px;font-weight:700;font-family:monospace">${inv.invoiceNumber}</p>
        <p style="font-size:12px;color:#6b7280">${new Date(inv.createdAt).toLocaleString('ar-EG')}</p>
      </div>
    </div>
    <div class="meta">
      <div class="meta-item"><label>العميل</label><p>${inv.customer?.fullName ?? 'نقدي'}</p></div>
      <div class="meta-item"><label>طريقة الدفع</label><p>${inv.paymentMethod?.name ?? '—'}</p></div>
      <div class="meta-item"><label>الكاشير</label><p>${inv.cashier?.fullName ?? '—'}</p></div>
      <div class="meta-item"><label>الحالة</label><p>${inv.status === 'completed' ? 'مكتملة' : inv.status}</p></div>
    </div>
    <table>
      <thead><tr>
        <th>الصنف</th><th style="text-align:center">الكمية</th><th style="text-align:left">سعر الوحدة</th><th style="text-align:left">الإجمالي</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>المجموع الفرعي</span><span>${fmt(Number(inv.subtotal))}</span></div>
      ${Number(inv.discountAmount) > 0 ? `<div class="totals-row" style="color:#dc2626"><span>الخصم</span><span>- ${fmt(Number(inv.discountAmount))}</span></div>` : ''}
      ${Number(inv.taxTotal) > 0 ? `<div class="totals-row"><span>الضريبة</span><span>${fmt(Number(inv.taxTotal))}</span></div>` : ''}
      ${Number(inv.feeAmount) > 0 ? `<div class="totals-row"><span>رسوم الدفع</span><span>${fmt(Number(inv.feeAmount))}</span></div>` : ''}
      <div class="totals-row total"><span>الإجمالي</span><span>${fmt(Number(inv.totalAmount))} ج</span></div>
    </div>
    <div class="footer"><p>شكراً لتعاملكم معنا — تم الإنشاء بواسطة Storify</p></div>
  </body></html>`

  const win = window.open('', '_blank', 'width=800,height=1000')
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.print(); setTimeout(() => win.close(), 500) }, 300)
}

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

interface ReturnItem { itemId: string; quantity: number; maxQty: number; productName: string; variantSku: string }

const LIMIT = 20

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'gray' }> = {
  completed: { label: 'مكتملة', variant: 'success' },
  pending: { label: 'معلقة', variant: 'warning' },
  cancelled: { label: 'ملغاة', variant: 'danger' },
  returned: { label: 'مرتجعة', variant: 'gray' },
}

function ReturnModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const qc = useQueryClient()
  const [returnItems, setReturnItems] = useState<ReturnItem[]>(
    (invoice.items ?? []).map((i) => ({ itemId: i.id, quantity: 0, maxQty: i.quantity, productName: i.productName, variantSku: i.variantSku }))
  )
  const [returnType, setReturnType] = useState<'refund' | 'credit'>('refund')
  const [reason, setReason] = useState('')

  const { mutate: submitReturn, isPending } = useMutation({
    mutationFn: async () => {
      const items = returnItems.filter((i) => i.quantity > 0).map((i) => ({ itemId: i.itemId, quantity: i.quantity }))
      if (items.length === 0) throw new Error('اختر صنفاً واحداً على الأقل')
      await api.post(`/invoices/${invoice.id}/return`, { returnType, reason: reason || undefined, items })
    },
    onSuccess: () => {
      toast.success('تم تسجيل المرتجع')
      qc.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as Error).message
      toast.error(msg === 'اختر صنفاً واحداً على الأقل' ? msg : 'فشل تسجيل المرتجع')
    },
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-gray-400 mb-3">اختر الأصناف المرتجعة والكمية</p>
        <div className="flex flex-col gap-2">
          {returnItems.map((item, idx) => (
            <div key={item.itemId} className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0">
              <div className="flex-1">
                <p className="text-sm text-gray-100">{item.productName}</p>
                <p className="text-xs text-gray-500 font-mono">{item.variantSku} · الكمية المباعة: {item.maxQty}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReturnItems((prev) => prev.map((r, i) => i === idx ? { ...r, quantity: Math.max(0, r.quantity - 1) } : r))}
                  className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-sm"
                  disabled={item.quantity === 0}
                >−</button>
                <span className="w-6 text-center font-mono text-sm">{item.quantity}</span>
                <button
                  onClick={() => setReturnItems((prev) => prev.map((r, i) => i === idx ? { ...r, quantity: Math.min(r.maxQty, r.quantity + 1) } : r))}
                  className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-sm"
                  disabled={item.quantity >= item.maxQty}
                >+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-400 mb-2">نوع المرتجع</p>
        <div className="flex gap-2">
          <button
            onClick={() => setReturnType('refund')}
            className={`flex-1 py-2 rounded text-sm border transition-all ${returnType === 'refund' ? 'border-brand-500 text-brand-400 bg-brand-600/10' : 'border-gray-700 text-gray-400'}`}
          >استرداد نقدي</button>
          <button
            onClick={() => setReturnType('credit')}
            className={`flex-1 py-2 rounded text-sm border transition-all ${returnType === 'credit' ? 'border-success-500 text-success-400 bg-success-500/10' : 'border-gray-700 text-gray-400'}`}
          >رصيد للعميل</button>
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-1">سبب الإرجاع (اختياري)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500 resize-none"
          placeholder="عيب في المنتج، مقاس خاطئ..."
        />
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
        <Button className="flex-1" loading={isPending} onClick={() => submitReturn()}>
          <RotateCcw className="w-4 h-4" />
          تأكيد الإرجاع
        </Button>
      </div>
    </div>
  )
}

export default function Invoices() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null)
  const [returnInvoice, setReturnInvoice] = useState<Invoice | null>(null)

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

      <Drawer
        open={!!detailInvoice}
        onClose={() => setDetailInvoice(null)}
        title={`فاتورة ${detailInvoice?.invoiceNumber ?? ''}`}
        width="w-[520px]"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={() => detailInvoice && printInvoice(detailInvoice)}>
              <Printer className="w-4 h-4" />طباعة
            </Button>
            {detailInvoice?.status === 'completed' && (
              <Button variant="secondary" onClick={() => { setReturnInvoice(detailInvoice); setDetailInvoice(null) }}>
                <RotateCcw className="w-4 h-4" />إرجاع
              </Button>
            )}
          </div>
        }
      >
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
      <Modal open={!!returnInvoice} onClose={() => setReturnInvoice(null)} title={`إرجاع فاتورة ${returnInvoice?.invoiceNumber ?? ''}`}>
        {returnInvoice && <ReturnModal invoice={returnInvoice} onClose={() => setReturnInvoice(null)} />}
      </Modal>
    </AppShell>
  )
}
