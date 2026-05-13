import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, Check, Trash2 } from 'lucide-react'
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
  totalCost: number
}

interface PurchaseOrder {
  id: string
  poNumber: string
  supplier?: { id: string; name: string }
  branch?: { id: string; name: string }
  status: 'draft' | 'pending_approval' | 'approved' | 'received' | 'cancelled'
  totalCost: number
  expectedDate?: string
  createdAt: string
  _count?: { items: number }
  items?: POItem[]
  createdBy?: { fullName: string }
  approvedBy?: { fullName: string }
}

const statusMap: Record<string, { label: string; variant: 'gray' | 'warning' | 'success' | 'info' | 'danger' }> = {
  draft: { label: 'مسودة', variant: 'gray' },
  pending_approval: { label: 'انتظار موافقة', variant: 'warning' },
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

export default function PurchaseOrders() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null)
  const [approveTarget, setApproveTarget] = useState<PurchaseOrder | null>(null)

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

  const { mutate: approve, isPending: isApproving } = useMutation({
    mutationFn: async (id: string) => api.patch(`/purchase-orders/${id}/approve`),
    onSuccess: () => {
      toast.success('تمت الموافقة على أمر الشراء')
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      setApproveTarget(null)
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const openDetail = async (po: PurchaseOrder) => {
    const res = await api.get<{ data: PurchaseOrder }>(`/purchase-orders/${po.id}`)
    setDetailPO(res.data.data)
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
              { key: 'poNumber', header: 'رقم الأمر', render: (po) => (
                <button className="font-mono text-brand-400 hover:underline" onClick={() => openDetail(po)}>{po.poNumber}</button>
              )},
              { key: 'supplier', header: 'المورد', render: (po) => <span className="text-gray-100">{po.supplier?.name ?? '—'}</span> },
              { key: 'branch', header: 'الفرع', render: (po) => <span className="text-gray-400">{po.branch?.name ?? '—'}</span> },
              { key: 'items', header: 'الأصناف', render: (po) => <span className="font-mono text-gray-400">{po._count?.items ?? 0}</span> },
              { key: 'totalCost', header: 'الإجمالي', render: (po) => <Money value={po.totalCost} /> },
              { key: 'status', header: 'الحالة', render: (po) => {
                const s = statusMap[po.status]
                return s ? <Badge variant={s.variant} dot>{s.label}</Badge> : <span>{po.status}</span>
              }},
              { key: 'actions', header: '', render: (po) => (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openDetail(po)}><Eye className="w-3 h-3" /></Button>
                  {po.status === 'pending_approval' && (
                    <Button variant="ghost" size="sm" className="text-success-500" onClick={() => setApproveTarget(po)}>
                      <Check className="w-3 h-3" />
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
      <Drawer open={!!detailPO} onClose={() => setDetailPO(null)} title={`أمر شراء ${detailPO?.poNumber ?? ''}`} width="w-[520px]">
        {detailPO && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">المورد</span><p className="text-gray-100 font-medium">{detailPO.supplier?.name ?? '—'}</p></div>
              <div><span className="text-gray-500">الفرع</span><p className="text-gray-100">{detailPO.branch?.name ?? '—'}</p></div>
              <div><span className="text-gray-500">الحالة</span>{(() => { const s = statusMap[detailPO.status]; return s ? <Badge variant={s.variant} dot>{s.label}</Badge> : <span>{detailPO.status}</span> })()}</div>
              <div><span className="text-gray-500">أنشأه</span><p className="text-gray-100">{detailPO.createdBy?.fullName ?? '—'}</p></div>
              {detailPO.approvedBy && <div><span className="text-gray-500">وافق عليه</span><p className="text-gray-100">{detailPO.approvedBy.fullName}</p></div>}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">الأصناف</h4>
              {detailPO.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm py-2 border-b border-gray-700 last:border-0">
                  <div>
                    <p className="text-gray-100">{item.variant.product.name}</p>
                    <p className="text-gray-500 text-xs font-mono">{item.variant.sku} × {item.quantity}</p>
                  </div>
                  <Money value={item.totalCost} />
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold mt-3 pt-2 border-t border-gray-600">
                <span className="text-gray-300">الإجمالي</span>
                <Money value={detailPO.totalCost} />
              </div>
            </div>
            {detailPO.status === 'pending_approval' && (
              <Button onClick={() => { setDetailPO(null); setApproveTarget(detailPO) }}>
                <Check className="w-4 h-4" />الموافقة على الأمر
              </Button>
            )}
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
        <p className="text-gray-300">هل تريد الموافقة على <strong className="text-gray-100">{approveTarget?.poNumber}</strong>؟</p>
      </Modal>
    </AppShell>
  )
}
