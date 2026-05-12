import { useState, useRef, useCallback, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Search, X, Plus, Minus, ShoppingCart, UserPlus, Printer, Check } from 'lucide-react'
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
  feeType: 'percentage' | 'fixed' | 'both' | 'none'
  feeValue: number
  feeFixed?: number
  feeBearerDefault: 'merchant' | 'customer' | 'negotiable'
}

interface Customer {
  id: string
  name: string
  phone?: string
}

interface CompletedInvoice {
  id: string
  invoiceNumber: string
  totalAmount: number
}

function calculateFee(total: number, pm: PaymentMethod): number {
  if (pm.feeType === 'none') return 0
  if (pm.feeType === 'percentage') return total * (pm.feeValue / 100)
  if (pm.feeType === 'fixed') return pm.feeFixed ?? pm.feeValue
  if (pm.feeType === 'both') return total * (pm.feeValue / 100) + (pm.feeFixed ?? 0)
  return 0
}

export default function POS() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Variant[]>([])
  const [selectedPM, setSelectedPM] = useState<PaymentMethod | null>(null)
  const [feeBearer, setFeeBearer] = useState<'merchant' | 'customer'>('merchant')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [completedInvoice, setCompletedInvoice] = useState<CompletedInvoice | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: async () => (await api.get<PaymentMethod[]>('/payment-methods')).data,
  })

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-search', customerSearch],
    queryFn: async () =>
      (await api.get<Customer[]>('/customers', { params: { search: customerSearch, limit: 10 } })).data,
    enabled: customerSearch.length > 1,
  })

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    try {
      const res = await api.get<Variant[]>('/products/search', { params: { q, limit: 8 } })
      setSearchResults(res.data)
    } catch {
      setSearchResults([])
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 250)
    return () => clearTimeout(t)
  }, [search, doSearch])

  useEffect(() => { searchRef.current?.focus() }, [])

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
  const fee = selectedPM ? calculateFee(subtotal, selectedPM) : 0
  const total = feeBearer === 'customer' ? subtotal + fee : subtotal

  const { mutate: submitSale, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedPM) throw new Error('اختر طريقة الدفع')
      if (cart.length === 0) throw new Error('السلة فارغة')
      const res = await api.post<CompletedInvoice>('/invoices', {
        paymentMethodId: selectedPM.id,
        customerId: customer?.id,
        feeBearer,
        items: cart.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      })
      return res.data
    },
    onSuccess: (invoice) => {
      setCompletedInvoice(invoice)
      setCart([])
      setCustomer(null)
      setSelectedPM(null)
      toast.success(`تم إنشاء الفاتورة ${invoice.invoiceNumber}`)
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
          <div className="relative">
            <Input
              ref={searchRef}
              placeholder="ابحث عن منتج أو اقرأ الباركود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startIcon={<Search className="w-4 h-4" />}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-dropdown top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-r-lg shadow-lg overflow-hidden">
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
                  <p className="text-sm font-medium text-gray-100">{customer.name}</p>
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
                      setFeeBearer(pm.feeBearerDefault === 'customer' ? 'customer' : 'merchant')
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

            {selectedPM && fee > 0 && selectedPM.feeBearerDefault === 'negotiable' && (
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

          <div className="bg-gray-800 rounded-r-xl border border-gray-700 p-4 flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">المجموع الفرعي</span>
              <Money value={subtotal} />
            </div>
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
                {c.name}
                {c.phone && <span className="text-gray-500 mr-2 num">{c.phone}</span>}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Completion modal */}
      <Modal open={!!completedInvoice} onClose={() => setCompletedInvoice(null)} title="تم إنشاء الفاتورة">
        {completedInvoice && (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="w-16 h-16 rounded-full bg-success-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-success-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-100">{completedInvoice.invoiceNumber}</p>
              <Money value={completedInvoice.totalAmount} size="xl" className="mt-2" />
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
                <Printer className="w-4 h-4" />
                طباعة
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
