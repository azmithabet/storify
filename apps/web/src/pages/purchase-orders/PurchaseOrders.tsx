import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, Check, Trash2, PackageCheck, CreditCard, Printer, SendHorizontal } from 'lucide-react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Table, Badge, Money, SkeletonTable, Button, Drawer, Modal, Input, Pagination } from '@/components/ui'
import { api } from '@/api/client'

interface Supplier { id: string; name: string }
interface Branch { id: string; name: string; isMain: boolean }
interface Variant { id: string; sku: string; product: { name: string } }

interface POItem {
  id: string
  variant: { id: string; sku: string; product: { name: string } }
  quantity: number
  unitCost: number
  subtotal: number
}

interface PurchaseOrder {
  id: string
  supplier?: { id: string; name: string }
  branch?: { id: string; name: string }
  status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled'
  totalAmount: number
  expectedDate?: string
  createdAt: string
  _count?: { items: number }
  items?: POItem[]
  createdBy?: { fullName: string }
  approvedBy?: { fullName: string }
}

// ─── Receive Modal ────────────────────────────────────────────────────────────

function ReceiveModal({ po, onClose, onConfirm, isPending }: { po: PurchaseOrder | null; onClose: () => void; onConfirm: (d: { receivedDate?: string; notes?: string }) => void; isPending: boolean }) {
  const { register, handleSubmit } = useForm<{ receivedDate?: string; notes?: string }>()
  if (!po) return null
  return (
    <Modal open={!!po} onClose={onClose} title={`استلام أمر الشراء: ${po.id.slice(0, 8).toUpperCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={isPending} onClick={handleSubmit(onConfirm)}>
            <PackageCheck className="w-4 h-4" />تأكيد الاستلام
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-400">سيتم تحديث المخزون تلقائياً بكميات جميع الأصناف في هذا الأمر.</p>
        <Input label="تاريخ الاستلام" type="date" {...register('receivedDate')} />
        <div>
          <label className="text-sm text-gray-400 block mb-1">ملاحظات (اختياري)</label>
          <textarea {...register('notes')} rows={2} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500 resize-none" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({ po, onClose, onConfirm, isPending }: { po: PurchaseOrder | null; onClose: () => void; onConfirm: (d: { amount: number; paymentMethod?: string }) => void; isPending: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<{ amount: number; paymentMethod?: string }>({
    resolver: zodResolver(z.object({ amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'), paymentMethod: z.string().optional() })),
  })
  if (!po) return null
  return (
    <Modal open={!!po} onClose={onClose} title={`تسجيل دفعة: ${po.id.slice(0, 8).toUpperCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={isPending} onClick={handleSubmit(onConfirm)}>
            <CreditCard className="w-4 h-4" />تسجيل الدفعة
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="المبلغ المدفوع (ج)" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
        <div>
          <label className="text-sm text-gray-400 block mb-1">طريقة الدفع (اختياري)</label>
          <select {...register('paymentMethod')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
            <option value="">اختر</option>
            <option value="cash">نقدي</option>
            <option value="bank_transfer">تحويل بنكي</option>
            <option value="check">شيك</option>
          </select>
        </div>
      </div>
    </Modal>
  )
}

const statusMap: Record<string, { label: string; variant: 'gray' | 'warning' | 'success' | 'info' | 'danger' }> = {
  draft: { label: 'مسودة', variant: 'gray' },
  pending: { label: 'انتظار موافقة', variant: 'warning' },
  approved: { label: 'موافق', variant: 'success' },
  received: { label: 'مستلم', variant: 'info' },
  cancelled: { label: 'ملغي', variant: 'danger' },
}

const schema = z.object({
  supplierId: z.string().uuid('اختر المورد'),
  branchId: z.string().uuid('اختر الفرع'),
  expectedDate: z.string().optional(),
  paymentType: z.string().optional(),
  items: z.array(z.object({
    variantId: z.string().uuid('اختر منتجاً'),
    variantLabel: z.string().optional(),
    quantity: z.coerce.number().int().positive('يجب أن يكون موجباً'),
    unitCost: z.coerce.number().positive('يجب أن يكون أكبر من صفر'),
  })).min(1, 'أضف صنفاً واحداً على الأقل'),
})
type FormData = z.infer<typeof schema>

// ─── Per-row variant search ───────────────────────────────────────────────────
function VariantSearchField({
  index,
  register,
  setValue,
  error,
}: {
  index: number
  register: ReturnType<typeof useForm<FormData>>['register']
  setValue: ReturnType<typeof useForm<FormData>>['setValue']
  error?: string
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Variant[]>([])
  const [selected, setSelected] = useState<string>('')

  const search = async (query: string) => {
    setQ(query)
    if (query.length < 2) { setResults([]); return }
    const res = await api.get<{ data: Variant[] }>('/products/search', { params: { q: query, limit: 8 } })
    setResults(res.data.data)
  }

  const pick = (v: Variant) => {
    setValue(`items.${index}.variantId`, v.id, { shouldValidate: true })
    setValue(`items.${index}.variantLabel`, `${v.product.name} (${v.sku})`)
    setSelected(`${v.product.name} (${v.sku})`)
    setResults([])
    setQ('')
  }

  return (
    <div className="relative flex-1">
      <input
        value={selected || q}
        placeholder="بحث عن منتج بالاسم أو SKU..."
        onChange={(e) => { setSelected(''); search(e.target.value) }}
        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
      />
      <input type="hidden" {...register(`items.${index}.variantId`)} />
      {results.length > 0 && (
        <div className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
          {results.map((v) => (
            <button key={v.id} type="button"
              className="w-full text-right px-3 py-2 text-sm hover:bg-gray-700 text-gray-200"
              onClick={() => pick(v)}
            >
              {v.product.name} <span className="text-gray-500 font-mono text-xs mr-1">{v.sku}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-danger-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function printPO(po: PurchaseOrder) {
  const win = window.open('', '_blank', 'width=800,height=700')
  if (!win) return
  const statusLabels: Record<string, string> = { draft: 'مسودة', pending: 'انتظار موافقة', approved: 'موافق', received: 'مستلم', cancelled: 'ملغي' }
  const poRef = po.id.slice(0, 8).toUpperCase()
  const rows = (po.items ?? []).map((item) =>
    `<tr><td>${item.variant.product.name}</td><td>${item.variant.sku}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:left">${Number(item.unitCost).toFixed(2)} ج</td><td style="text-align:left">${Number(item.subtotal).toFixed(2)} ج</td></tr>`
  ).join('')
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>أمر شراء ${poRef}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;padding:24px;color:#000}
    h1{font-size:20px;margin-bottom:4px}h2{font-size:13px;color:#555;margin-bottom:16px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
    .grid div{font-size:12px}.grid div span{color:#777;display:block;font-size:11px}
    table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:right}
    th{background:#f5f5f5;font-weight:600}.total td{font-weight:bold;border-top:2px solid #999}
    .footer{margin-top:40px;display:flex;justify-content:space-between}
    @media print{@page{margin:15mm;size:A4}}
  </style></head><body>
    <h1>Storify — أمر شراء</h1>
    <h2>رقم الأمر: <strong>${poRef}</strong> | الحالة: ${statusLabels[po.status] ?? po.status}</h2>
    <div class="grid">
      <div><span>المورد</span>${po.supplier?.name ?? '—'}</div>
      <div><span>الفرع</span>${po.branch?.name ?? '—'}</div>
      <div><span>أنشأه</span>${po.createdBy?.fullName ?? '—'}</div>
      <div><span>تاريخ الإنشاء</span>${new Date(po.createdAt).toLocaleDateString('ar-EG')}</div>
      ${po.approvedBy ? `<div><span>وافق عليه</span>${po.approvedBy.fullName}</div>` : ''}
    </div>
    <table>
      <thead><tr><th>المنتج</th><th>SKU</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total"><td colspan="4">الإجمالي الكلي</td><td style="text-align:left">${Number(po.totalAmount).toFixed(2)} ج</td></tr></tfoot>
    </table>
    <div class="footer">
      <div style="text-align:center;width:40%"><div style="border-top:1px solid #000;margin-top:40px;padding-top:8px">توقيع المستلم</div></div>
      <div style="text-align:center;width:40%"><div style="border-top:1px solid #000;margin-top:40px;padding-top:8px">توقيع المورد</div></div>
    </div>
  </body></html>`)
  win.document.close()
  setTimeout(() => { win.print(); win.close() }, 300)
}

export default function PurchaseOrders() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null)
  const [approveTarget, setApproveTarget] = useState<PurchaseOrder | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<PurchaseOrder | null>(null)

  const { data: poData, isLoading } = useQuery<{ data: PurchaseOrder[]; meta: { total: number; page: number; limit: number; pages: number } }>({
    queryKey: ['purchase-orders', page],
    queryFn: async () => (await api.get<{ data: PurchaseOrder[]; meta: { total: number; page: number; limit: number; pages: number } }>('/purchase-orders', { params: { limit: 20, page } })).data,
  })

  const data = poData?.data ?? []
  const meta = poData?.meta

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get<{ data: Supplier[] }>('/suppliers', { params: { limit: 100 } })).data.data,
  })

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await api.get<{ data: Branch[] }>('/branches')).data.data,
  })

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ variantId: '', variantLabel: '', quantity: 1, unitCost: 0 }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: async (data: FormData) => api.post('/purchase-orders', {
      supplierId: data.supplierId,
      branchId: data.branchId,
      expectedDate: data.expectedDate,
      paymentType: data.paymentType,
      items: data.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitCost: i.unitCost })),
    }),
    onSuccess: () => {
      toast.success('تم إنشاء أمر الشراء')
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      setDrawerOpen(false)
      reset()
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const { mutate: submit, isPending: isSubmitting } = useMutation({
    mutationFn: async (id: string) => api.patch(`/purchase-orders/${id}/submit`),
    onSuccess: () => {
      toast.success('تم إرسال أمر الشراء للموافقة')
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const { mutate: approve, isPending: isApproving } = useMutation({
    mutationFn: async (id: string) => api.patch(`/purchase-orders/${id}/approve`),
    onSuccess: () => {
      toast.success('تمت الموافقة على أمر الشراء')
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      setApproveTarget(null)
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const { mutate: receive, isPending: isReceiving } = useMutation({
    mutationFn: async ({ id, receivedDate, notes }: { id: string; receivedDate?: string; notes?: string }) =>
      api.post(`/purchase-orders/${id}/receive`, { receivedDate: receivedDate || undefined, notes: notes || undefined }),
    onSuccess: () => {
      toast.success('تم استلام أمر الشراء وتحديث المخزون')
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      setReceiveTarget(null)
    },
    onError: (e: unknown) => {
      const code = (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code
      toast.error(code === 'invalid_status' ? 'أمر الشراء يجب أن يكون معتمداً أولاً' : 'حدث خطأ في الاستلام')
    },
  })

  const { mutate: recordPayment, isPending: isPaymentPending } = useMutation({
    mutationFn: async ({ id, amount, paymentMethod }: { id: string; amount: number; paymentMethod?: string }) =>
      api.post(`/purchase-orders/${id}/payments`, { amount, paymentMethod: paymentMethod || undefined }),
    onSuccess: () => {
      toast.success('تم تسجيل الدفعة للمورد')
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      setPaymentTarget(null)
    },
    onError: () => toast.error('حدث خطأ في تسجيل الدفعة'),
  })

  const openDetail = async (po: PurchaseOrder) => {
    try {
      // Show drawer immediately with list data while fetching details
      setDetailPO(po)
      const res = await api.get<{ data: PurchaseOrder }>(`/purchase-orders/${po.id}`)
      setDetailPO(res.data.data)
    } catch {
      toast.error('تعذر تحميل تفاصيل الأمر')
    }
  }

  const items = watch('items')
  const totalCost = items.reduce((sum, item) => sum + (Number(item.unitCost) * Number(item.quantity) || 0), 0)

  return (
    <AppShell title="أوامر الشراء">
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Button onClick={() => {
            reset({ items: [{ variantId: '', variantLabel: '', quantity: 1, unitCost: 0 }] })
            setDrawerOpen(true)
          }}>
            <Plus className="w-4 h-4" />أمر شراء جديد
          </Button>
        </div>

        {isLoading ? <SkeletonTable rows={8} cols={6} /> : (
          <>
          <Table
            columns={[
              { key: 'id', header: 'رقم الأمر', render: (po) => (
                <button className="font-mono text-brand-400 hover:underline text-xs" onClick={() => openDetail(po)}>{po.id.slice(0, 8).toUpperCase()}</button>
              )},
              { key: 'supplier', header: 'المورد', render: (po) => <span className="text-gray-100">{po.supplier?.name ?? '—'}</span> },
              { key: 'branch', header: 'الفرع', render: (po) => <span className="text-gray-400">{po.branch?.name ?? '—'}</span> },
              { key: 'items', header: 'الأصناف', render: (po) => <span className="font-mono text-gray-400">{po._count?.items ?? 0}</span> },
              { key: 'totalAmount', header: 'الإجمالي', render: (po) => <Money value={Number(po.totalAmount)} /> },
              { key: 'status', header: 'الحالة', render: (po) => {
                const s = statusMap[po.status]
                return s ? <Badge variant={s.variant} dot>{s.label}</Badge> : <span>{po.status}</span>
              }},
              { key: 'actions', header: '', render: (po) => (
                <div className="flex gap-1 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => openDetail(po)}><Eye className="w-3 h-3" /></Button>
                  {po.status === 'draft' && (
                    <Button variant="ghost" size="sm" className="text-warning-500" onClick={() => submit(po.id)} loading={isSubmitting} title="إرسال للموافقة">
                      <SendHorizontal className="w-3 h-3" />
                    </Button>
                  )}
                  {po.status === 'pending' && (
                    <Button variant="ghost" size="sm" className="text-success-500" onClick={() => setApproveTarget(po)} title="الموافقة على الأمر">
                      <Check className="w-3 h-3" />
                    </Button>
                  )}
                  {po.status === 'approved' && (
                    <Button variant="ghost" size="sm" className="text-info-500" onClick={() => setReceiveTarget(po)} title="استلام البضاعة">
                      <PackageCheck className="w-3 h-3" />
                    </Button>
                  )}
                  {po.status === 'received' && (
                    <Button variant="ghost" size="sm" className="text-brand-400" onClick={() => setPaymentTarget(po)} title="تسجيل دفعة للمورد">
                      <CreditCard className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )},
            ]}
            data={data} keyExtractor={(po) => po.id} emptyMessage="لا توجد أوامر شراء"
          />
          {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPage={setPage} />}
          </>
        )}
      </div>

      {/* Create PO Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="أمر شراء جديد" width="w-[560px]"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
            <Button loading={isCreating} onClick={handleSubmit((d) => create(d))}>إنشاء الأمر</Button>
          </>
        }
      >
        <form className="flex flex-col gap-5">
          <div>
            <label className="text-sm text-gray-400 block mb-1">المورد</label>
            <select {...register('supplierId')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="">اختر المورد</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errors.supplierId && <p className="text-danger-500 text-xs mt-1">{errors.supplierId.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">الفرع</label>
            <select {...register('branchId')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="">اختر الفرع</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {errors.branchId && <p className="text-danger-500 text-xs mt-1">{errors.branchId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="تاريخ التسليم المتوقع" type="date" {...register('expectedDate')} />
            <div>
              <label className="text-sm text-gray-400 block mb-1">طريقة الدفع</label>
              <select {...register('paymentType')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
                <option value="">اختر</option>
                <option value="cash">نقدي</option>
                <option value="credit">آجل</option>
                <option value="bank_transfer">تحويل بنكي</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-300">الأصناف</label>
              <Button type="button" variant="ghost" size="sm"
                onClick={() => append({ variantId: '', variantLabel: '', quantity: 1, unitCost: 0 })}>
                <Plus className="w-3 h-3" />إضافة صنف
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {fields.map((field, idx) => (
                <div key={field.id} className="bg-gray-750 border border-gray-700 rounded-md p-3 flex flex-col gap-2">
                  <div className="flex gap-2 items-start">
                    <VariantSearchField
                      index={idx}
                      register={register}
                      setValue={setValue}
                      error={(errors.items?.[idx]?.variantId as { message?: string } | undefined)?.message}
                    />
                    <Button type="button" variant="ghost" size="sm" className="text-danger-500 mt-1" onClick={() => remove(idx)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="الكمية" type="number" min={1} {...register(`items.${idx}.quantity`)}
                      error={(errors.items?.[idx]?.quantity as { message?: string } | undefined)?.message} />
                    <Input label="سعر الوحدة (ج)" type="number" step="0.01" {...register(`items.${idx}.unitCost`)}
                      error={(errors.items?.[idx]?.unitCost as { message?: string } | undefined)?.message} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm mt-3 bg-gray-750 rounded-md px-3 py-2 border border-gray-700">
              <span className="text-gray-400">الإجمالي التقديري</span>
              <span className="font-semibold text-gray-100">{totalCost.toLocaleString('ar-EG')} ج</span>
            </div>
          </div>
        </form>
      </Drawer>

      {/* PO Detail Drawer */}
      <Drawer open={!!detailPO} onClose={() => setDetailPO(null)} title={`أمر شراء #${detailPO?.id.slice(0, 8).toUpperCase() ?? ''}`} width="w-[520px]">
        {detailPO && (
          <div className="flex flex-col gap-6">
            {/* ── Action buttons at the TOP so they're always visible ── */}
            <div className="flex flex-wrap gap-2">
              {detailPO.status === 'draft' && (
                <Button loading={isSubmitting} onClick={() => { submit(detailPO.id); setDetailPO(null) }}>
                  <SendHorizontal className="w-4 h-4" />إرسال للموافقة
                </Button>
              )}
              {detailPO.status === 'pending' && (
                <Button onClick={() => { setDetailPO(null); setApproveTarget(detailPO) }}>
                  <Check className="w-4 h-4" />الموافقة على الأمر
                </Button>
              )}
              {detailPO.status === 'approved' && (
                <Button onClick={() => { setDetailPO(null); setReceiveTarget(detailPO) }}>
                  <PackageCheck className="w-4 h-4" />استلام البضاعة
                </Button>
              )}
              {detailPO.status === 'received' && (
                <Button variant="secondary" onClick={() => { setDetailPO(null); setPaymentTarget(detailPO) }}>
                  <CreditCard className="w-4 h-4" />تسجيل دفعة للمورد
                </Button>
              )}
              <Button variant="secondary" onClick={() => printPO(detailPO)}>
                <Printer className="w-4 h-4" />طباعة
              </Button>
            </div>

            {/* ── Metadata ── */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">المورد</span><p className="text-gray-100 font-medium">{detailPO.supplier?.name ?? '—'}</p></div>
              <div><span className="text-gray-500">الفرع</span><p className="text-gray-100">{detailPO.branch?.name ?? '—'}</p></div>
              <div><span className="text-gray-500">الحالة</span>{(() => { const s = statusMap[detailPO.status]; return s ? <Badge variant={s.variant} dot>{s.label}</Badge> : <span>{detailPO.status}</span> })()}</div>
              <div><span className="text-gray-500">أنشأه</span><p className="text-gray-100">{detailPO.createdBy?.fullName ?? '—'}</p></div>
              {detailPO.approvedBy && <div><span className="text-gray-500">وافق عليه</span><p className="text-gray-100">{detailPO.approvedBy.fullName}</p></div>}
            </div>

            {/* ── Items ── */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">الأصناف</h4>
              {detailPO.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm py-2 border-b border-gray-700 last:border-0">
                  <div>
                    <p className="text-gray-100">{item.variant?.product?.name ?? '—'}</p>
                    <p className="text-gray-500 text-xs font-mono">{item.variant?.sku} × {item.quantity}</p>
                  </div>
                  <Money value={Number(item.subtotal)} />
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold mt-3 pt-2 border-t border-gray-600">
                <span className="text-gray-300">الإجمالي</span>
                <Money value={Number(detailPO.totalAmount)} />
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal open={!!approveTarget} onClose={() => setApproveTarget(null)} title="الموافقة على أمر الشراء"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveTarget(null)}>إلغاء</Button>
            <Button loading={isApproving} onClick={() => approveTarget && approve(approveTarget.id)}>موافقة</Button>
          </>
        }
      >
        <p className="text-gray-300">هل تريد الموافقة على الأمر <strong className="text-gray-100 font-mono">#{approveTarget?.id.slice(0, 8).toUpperCase()}</strong>؟</p>
      </Modal>

      <ReceiveModal po={receiveTarget} onClose={() => setReceiveTarget(null)} onConfirm={(d) => receiveTarget && receive({ id: receiveTarget.id, ...d })} isPending={isReceiving} />
      <PaymentModal po={paymentTarget} onClose={() => setPaymentTarget(null)} onConfirm={(d) => paymentTarget && recordPayment({ id: paymentTarget.id, ...d })} isPending={isPaymentPending} />
    </AppShell>
  )
}
