import { useState, useRef, useCallback, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Search, X, Plus, Minus, ShoppingCart, UserPlus, Printer, Check, ScanLine, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Button, Input, Badge, Money, Modal } from '@/components/ui'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'

interface Variant {
  id: string
  sku: string
  barcode?: string
  sellPrice: number
  costPrice: number
  attributes: Record<string, string>
  stock: number
  product: { id: string; name: string; has_variants: boolean }
}

interface CartItem {
  variantId: string
  productName: string
  sku: string
  attributes: Record<string, string>
  unitPrice: number
  quantity: number
  availableStock: number
}

interface PaymentMethod {
  id: string
  name: string
  type: string
  feeType: 'percent' | 'fixed' | 'both' | 'none'
  feePercentage: string | number
  feeFixed?: string | number
  feeBearer: 'merchant' | 'customer' | 'negotiable'
}

interface Customer {
  id: string
  fullName: string
  phone?: string
}

interface AppliedCoupon {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minAmount?: number | null
}

interface CompletedInvoice {
  id: string
  invoiceNumber: string
  totalAmount: number
  subtotal: number
  feeAmount: number
  couponCode?: string
  couponDiscount?: number
  customerName?: string
  paymentMethodName: string
  createdAt: string
  items: { productName: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }[]
}

function printReceipt(inv: CompletedInvoice) {
  const win = window.open('', '_blank', 'width=400,height=640')
  if (!win) return
  const rows = inv.items.map((i) =>
    `<tr><td>${i.productName}<br/><small style="color:#666">${i.sku} × ${i.quantity}</small></td><td style="text-align:left;white-space:nowrap">${i.lineTotal.toFixed(2)} ج</td></tr>`
  ).join('')
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>إيصال ${inv.invoiceNumber}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:monospace;font-size:12px;width:80mm;margin:0 auto;padding:8px;color:#000}
    .center{text-align:center}
    h2{font-size:15px;margin:6px 0}
    table{width:100%;border-collapse:collapse}
    td{padding:3px 2px;vertical-align:top}
    .dashed{border-bottom:1px dashed #000;margin:6px 0}
    .total td{font-weight:bold;font-size:14px;border-top:1px dashed #000;padding-top:6px}
    @media print{@page{margin:4mm;size:80mm auto}}
  </style></head><body>
    <div class="center"><h2>Storify</h2><p style="font-size:11px">نقطة البيع</p></div>
    <div class="dashed"></div>
    <p>رقم الفاتورة: <b>${inv.invoiceNumber}</b></p>
    <p>التاريخ: ${new Date(inv.createdAt).toLocaleString('ar-EG')}</p>
    ${inv.customerName ? `<p>العميل: ${inv.customerName}</p>` : ''}
    <p>الدفع: ${inv.paymentMethodName}</p>
    <div class="dashed"></div>
    <table><tbody>${rows}</tbody></table>
    <div class="dashed"></div>
    <table><tbody>
      <tr><td>المجموع الفرعي</td><td style="text-align:left">${inv.subtotal.toFixed(2)} ج</td></tr>
      ${inv.couponDiscount && inv.couponDiscount > 0 ? `<tr><td>خصم (${inv.couponCode ?? ''})</td><td style="text-align:left;color:green">-${inv.couponDiscount.toFixed(2)} ج</td></tr>` : ''}
      ${inv.feeAmount > 0 ? `<tr><td>رسوم الدفع</td><td style="text-align:left">${inv.feeAmount.toFixed(2)} ج</td></tr>` : ''}
      <tr class="total"><td>الإجمالي</td><td style="text-align:left">${inv.totalAmount.toFixed(2)} ج</td></tr>
    </tbody></table>
    <div class="dashed"></div>
    <div class="center" style="margin-top:8px"><p>شكراً لتعاملكم معنا</p></div>
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 250)
}

function calculateFee(total: number, pm: PaymentMethod): number {
  const pct = Number(pm.feePercentage)
  const fixed = Number(pm.feeFixed ?? 0)
  if (pm.feeType === 'none') return 0
  if (pm.feeType === 'percent') return total * (pct / 100)
  if (pm.feeType === 'fixed') return fixed
  if (pm.feeType === 'both') return total * (pct / 100) + fixed
  return 0
}

export default function POS() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Variant[]>([])
  const [barcode, setBarcode] = useState('')
  const [selectedPM, setSelectedPM] = useState<PaymentMethod | null>(null)
  const [feeBearer, setFeeBearer] = useState<'merchant' | 'customer'>('merchant')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [completedInvoice, setCompletedInvoice] = useState<CompletedInvoice | null>(null)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: async () => (await api.get<{ data: PaymentMethod[] }>('/payment-methods')).data.data,
  })

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-search', customerSearch],
    queryFn: async () =>
      (await api.get<{ data: Customer[] }>('/customers', { params: { search: customerSearch, limit: 10 } })).data.data,
    enabled: customerSearch.length > 1,
  })

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    try {
      const res = await api.get<{ data: Variant[] }>('/products/search', { params: { q, limit: 8 } })
      setSearchResults(res.data.data)
    } catch {
      setSearchResults([])
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 250)
    return () => clearTimeout(t)
  }, [search, doSearch])

  useEffect(() => { searchRef.current?.focus() }, [])

  const handleBarcodeEnter = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !barcode.trim()) return
    const code = barcode.trim()
    setBarcode('')
    try {
      const res = await api.get<{ data: Variant }>(`/products/barcode/${encodeURIComponent(code)}`)
      addToCart(res.data.data)
    } catch {
      toast.error('لم يتم العثور على المنتج بهذا الباركود')
      barcodeRef.current?.focus()
    }
  }

  const addToCart = (variant: Variant) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variant.id)
      if (existing) {
        if (existing.quantity >= existing.availableStock) {
          toast.error('الكمية المتاحة غير كافية')
          return prev
        }
        return prev.map((i) =>
          i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productName: variant.product.name,
          sku: variant.sku,
          attributes: variant.attributes,
          unitPrice: Number(variant.sellPrice),
          quantity: 1,
          availableStock: variant.stock,
        },
      ]
    })
    setSearch('')
    setSearchResults([])
    searchRef.current?.focus()
  }

  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.variantId === variantId
            ? { ...i, quantity: Math.max(0, Math.min(i.quantity + delta, i.availableStock)) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    )
  }

  const removeItem = (variantId: string) => setCart((prev) => prev.filter((i) => i.variantId !== variantId))

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  const couponDiscount = appliedCoupon
    ? appliedCoupon.discountType === 'percentage'
      ? Math.min(subtotal * (appliedCoupon.discountValue / 100), subtotal)
      : Math.min(appliedCoupon.discountValue, subtotal)
    : 0
  const discountedSubtotal = subtotal - couponDiscount

  const fee = selectedPM ? calculateFee(discountedSubtotal, selectedPM) : 0
  const total = feeBearer === 'customer' ? discountedSubtotal + fee : discountedSubtotal

  const validateCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponLoading(true)
    try {
      const res = await api.get<{ data: AppliedCoupon }>('/coupons/validate', { params: { code: couponInput.trim().toUpperCase() } })
      const c = res.data.data
      if (c.minAmount && discountedSubtotal < Number(c.minAmount)) {
        toast.error(`الحد الأدنى للطلب ${Number(c.minAmount).toFixed(0)} ج`)
      } else {
        setAppliedCoupon({ ...c, discountValue: Number(c.discountValue) })
        toast.success('تم تطبيق الكوبون')
        setCouponInput('')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      toast.error(msg ?? 'كوبون غير صالح')
    } finally {
      setCouponLoading(false)
    }
  }

  const { mutate: submitSale, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedPM) throw new Error('اختر طريقة الدفع')
      if (cart.length === 0) throw new Error('السلة فارغة')
      const res = await api.post<{ data: { id: string; invoiceNumber: string; totalAmount: number; feeAmount: number } }>('/invoices', {
        paymentMethodId: selectedPM.id,
        customerId: customer?.id,
        feeBearer,
        couponCode: appliedCoupon?.code,
        items: cart.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      })
      return res.data.data
    },
    onSuccess: (apiInvoice) => {
      const invoiceRecord: CompletedInvoice = {
        id: apiInvoice.id,
        invoiceNumber: apiInvoice.invoiceNumber,
        totalAmount: apiInvoice.totalAmount,
        subtotal,
        feeAmount: feeBearer === 'customer' ? fee : 0,
        couponCode: appliedCoupon?.code,
        couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
        customerName: customer?.fullName,
        paymentMethodName: selectedPM!.name,
        createdAt: new Date().toISOString(),
        items: cart.map((i) => ({
          productName: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.unitPrice * i.quantity,
        })),
      }
      setCompletedInvoice(invoiceRecord)
      setCart([])
      setCustomer(null)
      setSelectedPM(null)
      setAppliedCoupon(null)
      setCouponInput('')
      toast.success(`تم إنشاء الفاتورة ${apiInvoice.invoiceNumber}`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'فشل إنشاء الفاتورة')
    },
  })

  return (
    <AppShell title="نقطة البيع">
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* LEFT: Search + Cart */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
            <Input
              ref={searchRef}
              placeholder="ابحث عن منتج بالاسم أو SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startIcon={<Search className="w-4 h-4" />}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-r-lg shadow-lg overflow-hidden">
                {searchResults.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => addToCart(v)}
                    className="w-full text-right px-4 py-3 hover:bg-gray-700 flex items-center justify-between border-b border-gray-700/50 last:border-0 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-100">{v.product.name}</p>
                      <p className="text-xs text-gray-500">{v.sku}</p>
                    </div>
                    <div className="text-left">
                      <Money value={v.sellPrice} size="sm" />
                      <p className={cn('text-xs', v.stock === 0 ? 'text-danger-500' : v.stock <= 5 ? 'text-warning-500' : 'text-success-500')}>
                        {v.stock} متاح
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            </div>
            <div className="w-52">
              <Input
                ref={barcodeRef}
                placeholder="باركود..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleBarcodeEnter}
                startIcon={<ScanLine className="w-4 h-4" />}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-800 rounded-r-xl border border-gray-700">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                <ShoppingCart className="w-12 h-12 opacity-30" />
                <p>السلة فارغة — ابحث عن منتج للبدء</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase">المنتج</th>
                    <th className="text-center px-4 py-3 text-xs text-gray-500 uppercase w-32">الكمية</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">الإجمالي</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.variantId} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-100">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.sku}</p>
                        {item.quantity >= item.availableStock && (
                          <Badge variant="danger" dot className="mt-1">الحد الأقصى</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => updateQty(item.variantId, -1)}
                            className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-mono">{item.quantity}</span>
                          <button
                            onClick={() => updateQty(item.variantId, 1)}
                            className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center disabled:opacity-40"
                            disabled={item.quantity >= item.availableStock}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Money value={item.unitPrice * item.quantity} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeItem(item.variantId)}
                          className="text-gray-500 hover:text-danger-500 transition-colors"
                          aria-label="إزالة"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT: Totals + Payment */}
        <div className="w-80 flex flex-col gap-4">
          <div className="bg-gray-800 rounded-r-xl border border-gray-700 p-4">
            {customer ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-100">{customer.fullName}</p>
                  {customer.phone && <p className="text-xs text-gray-500">{customer.phone}</p>}
                </div>
                <button onClick={() => setCustomer(null)} className="text-gray-500 hover:text-danger-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerModal(true)}
                className="w-full flex items-center gap-2 text-gray-400 hover:text-brand-400 transition-colors text-sm"
              >
                <UserPlus className="w-4 h-4" />
                إضافة عميل (اختياري)
              </button>
            )}
          </div>

          <div className="bg-gray-800 rounded-r-xl border border-gray-700 p-4 flex flex-col gap-3">
            <p className="text-xs uppercase text-gray-500 font-medium">طريقة الدفع</p>
            <div className="flex flex-col gap-2">
              {paymentMethods.map((pm) => {
                const pmFee = calculateFee(subtotal, pm)
                return (
                  <button
                    key={pm.id}
                    onClick={() => {
                      setSelectedPM(pm)
                      setFeeBearer(pm.feeBearer === 'customer' ? 'customer' : 'merchant')
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-md px-3 py-2 text-sm border transition-all',
                      selectedPM?.id === pm.id
                        ? 'bg-brand-600/20 border-brand-500 text-brand-300'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500',
                    )}
                  >
                    <span>{pm.name}</span>
                    {pmFee > 0 && (
                      <span className="text-xs text-warning-500 num">{pmFee.toFixed(2)} رسوم</span>
                    )}
                  </button>
                )
              })}
            </div>

            {selectedPM && fee > 0 && selectedPM.feeBearer === 'negotiable' && (
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setFeeBearer('merchant')}
                  className={cn(
                    'flex-1 py-1 rounded text-xs border transition-all',
                    feeBearer === 'merchant'
                      ? 'border-brand-500 text-brand-400 bg-brand-600/10'
                      : 'border-gray-700 text-gray-500',
                  )}
                >
                  التاجر يتحمل
                </button>
                <button
                  onClick={() => setFeeBearer('customer')}
                  className={cn(
                    'flex-1 py-1 rounded text-xs border transition-all',
                    feeBearer === 'customer'
                      ? 'border-warning-500 text-warning-400 bg-warning-500/10'
                      : 'border-gray-700 text-gray-500',
                  )}
                >
                  العميل يتحمل
                </button>
              </div>
            )}
          </div>

          {/* Coupon input */}
          <div className="bg-gray-800 rounded-r-xl border border-gray-700 p-3">
            {appliedCoupon ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-success-400" />
                  <span className="text-sm font-mono text-success-400">{appliedCoupon.code}</span>
                  <span className="text-xs text-success-500">
                    -{appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}%` : `${appliedCoupon.discountValue} ج`}
                  </span>
                </div>
                <button onClick={() => setAppliedCoupon(null)} className="text-gray-500 hover:text-danger-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && validateCoupon()}
                  placeholder="كود الخصم..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono"
                />
                <button
                  onClick={validateCoupon}
                  disabled={!couponInput.trim() || couponLoading}
                  className="px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-sm disabled:opacity-40 transition-colors"
                >
                  {couponLoading ? '...' : 'تطبيق'}
                </button>
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-r-xl border border-gray-700 p-4 flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">المجموع الفرعي</span>
              <Money value={subtotal} />
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-success-400">
                <span>خصم الكوبون ({appliedCoupon?.code})</span>
                <span className="font-mono">-{couponDiscount.toFixed(2)} ج</span>
              </div>
            )}
            {fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">
                  رسوم {selectedPM?.name}
                  {feeBearer === 'merchant' && (
                    <span className="text-xs text-gray-500 mr-1">(يتحملها التاجر)</span>
                  )}
                </span>
                <span
                  className={cn(
                    'num font-mono',
                    feeBearer === 'customer' ? 'text-warning-500' : 'text-gray-500',
                  )}
                >
                  {fee.toFixed(2)} ج
                </span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-3 flex justify-between font-semibold">
              <span className="text-gray-200">الإجمالي</span>
              <Money value={total} size="lg" />
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={() => submitSale()}
            loading={isPending}
            disabled={cart.length === 0 || !selectedPM}
          >
            إتمام البيع
          </Button>
        </div>
      </div>

      {/* Customer search modal */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="اختر عميلاً">
        <div className="flex flex-col gap-4">
          <Input
            placeholder="ابحث بالاسم أو الهاتف..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            startIcon={<Search className="w-4 h-4" />}
          />
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCustomer(c)
                  setShowCustomerModal(false)
                  setCustomerSearch('')
                }}
                className="text-right px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-200"
              >
                {c.fullName}
                {c.phone && <span className="text-gray-500 mr-2 num">{c.phone}</span>}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Completion modal */}
      <Modal open={!!completedInvoice} onClose={() => setCompletedInvoice(null)} title="تم إنشاء الفاتورة">
        {completedInvoice && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-success-500/20 flex items-center justify-center shrink-0">
                <Check className="w-6 h-6 text-success-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-100">{completedInvoice.invoiceNumber}</p>
                <Money value={completedInvoice.totalAmount} size="lg" />
                {completedInvoice.customerName && (
                  <p className="text-xs text-gray-500 mt-0.5">{completedInvoice.customerName}</p>
                )}
              </div>
            </div>

            <div className="bg-gray-900 rounded-md p-3 flex flex-col gap-1 max-h-40 overflow-y-auto">
              {completedInvoice.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-800 last:border-0">
                  <div>
                    <span className="text-gray-200">{item.productName}</span>
                    <span className="text-gray-500 mr-1 text-xs">× {item.quantity}</span>
                  </div>
                  <span className="font-mono text-gray-300">{item.lineTotal.toFixed(2)} ج</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>المجموع الفرعي</span><span>{completedInvoice.subtotal.toFixed(2)} ج</span>
              </div>
              {completedInvoice.couponDiscount && completedInvoice.couponDiscount > 0 && (
                <div className="flex justify-between text-success-400">
                  <span>خصم ({completedInvoice.couponCode})</span>
                  <span>-{completedInvoice.couponDiscount.toFixed(2)} ج</span>
                </div>
              )}
              {completedInvoice.feeAmount > 0 && (
                <div className="flex justify-between text-warning-400">
                  <span>رسوم الدفع (على العميل)</span><span>{completedInvoice.feeAmount.toFixed(2)} ج</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-100 border-t border-gray-700 pt-2 mt-1">
                <span>الإجمالي</span><Money value={completedInvoice.totalAmount} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => printReceipt(completedInvoice)}>
                <Printer className="w-4 h-4" />
                طباعة الإيصال
              </Button>
              <Button className="flex-1" onClick={() => setCompletedInvoice(null)}>
                بيع جديد
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}
