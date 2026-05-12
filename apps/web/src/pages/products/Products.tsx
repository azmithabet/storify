import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Button, Input, Badge, Table, Drawer, Money, SkeletonTable } from '@/components/ui'
import { api } from '@/api/client'

interface Product {
  id: string; name: string; sku?: string; sellPrice: number
  isActive: boolean; totalStock?: number
}

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  sellPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  isActive: z.boolean().default(true),
})
type FormData = z.infer<typeof schema>

export default function Products() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', search],
    queryFn: async () => (await api.get<Product[]>('/products', { params: { search, limit: 50 } })).data,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const openNew = () => { setEditing(null); reset({}); setDrawerOpen(true) }
  const openEdit = (p: Product) => { setEditing(p); reset({ name: p.name, sellPrice: p.sellPrice, isActive: p.isActive }); setDrawerOpen(true) }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      if (editing) await api.patch(`/products/${editing.id}`, data)
      else await api.post('/products', { ...data, variants: [{ sku: data.sku ?? `SKU-${Date.now()}`, sellPrice: data.sellPrice, costPrice: data.costPrice }] })
    },
    onSuccess: () => { toast.success(editing ? 'تم التحديث' : 'تم الإنشاء'); qc.invalidateQueries({ queryKey: ['products'] }); setDrawerOpen(false) },
    onError: () => toast.error('حدث خطأ'),
  })

  return (
    <AppShell title="المنتجات">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-xs"><Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} startIcon={<Search className="w-4 h-4" />} /></div>
          <Button onClick={openNew}><Plus className="w-4 h-4" />منتج جديد</Button>
        </div>
        {isLoading ? <SkeletonTable rows={8} cols={5} /> : (
          <Table
            columns={[
              { key: 'name', header: 'المنتج', render: (p) => <p className="font-medium text-gray-100">{p.name}</p> },
              { key: 'sku', header: 'الكود', className: 'font-mono text-gray-500' },
              { key: 'sellPrice', header: 'السعر', render: (p) => <Money value={p.sellPrice} /> },
              { key: 'totalStock', header: 'المخزون', render: (p) => <span className={p.totalStock === 0 ? 'text-danger-600 font-bold' : 'text-success-600'}>{p.totalStock ?? '—'}</span> },
              { key: 'isActive', header: 'الحالة', render: (p) => <Badge variant={p.isActive ? 'success' : 'gray'} dot>{p.isActive ? 'نشط' : 'معطّل'}</Badge> },
              { key: 'actions', header: '', render: (p) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(p) }}><Edit2 className="w-3 h-3" /></Button> },
            ]}
            data={products} keyExtractor={(p) => p.id} emptyMessage="لا توجد منتجات"
          />
        )}
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل المنتج' : 'منتج جديد'}
        footer={<><Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button><Button loading={isPending} onClick={handleSubmit((d) => save(d))}>حفظ</Button></>}
      >
        <form className="flex flex-col gap-5">
          <Input label="اسم المنتج" error={errors.name?.message} {...register('name')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU" {...register('sku')} />
            <Input label="باركود" {...register('barcode')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="سعر البيع" type="number" step="0.01" error={errors.sellPrice?.message} {...register('sellPrice')} />
            <Input label="سعر التكلفة" type="number" step="0.01" {...register('costPrice')} />
          </div>
          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" {...register('isActive')} className="w-4 h-4 accent-brand-500" />منتج نشط
          </label>
        </form>
      </Drawer>
    </AppShell>
  )
}
