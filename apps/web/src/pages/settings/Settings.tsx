import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, ToggleLeft, ToggleRight, Shield, Tag } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Button, Input, Badge, Table, Drawer, Pagination } from '@/components/ui'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'

const tabs = [
  { id: 'store', label: 'بيانات المتجر' },
  { id: 'branches', label: 'الفروع' },
  { id: 'payment', label: 'طرق الدفع' },
  { id: 'categories', label: 'فئات المنتجات' },
  { id: 'tax', label: 'معدلات الضريبة' },
  { id: 'expense-categories', label: 'فئات المصروفات' },
  { id: 'users', label: 'المستخدمون' },
  { id: 'coupons', label: 'الكوبونات' },
  { id: 'audit', label: 'سجل التدقيق' },
  { id: 'password', label: 'كلمة المرور' },
]

export default function Settings() {
  const [tab, setTab] = useState('store')
  return (
    <AppShell title="الإعدادات">
      <div className="flex gap-6">
        <nav className="w-48 flex flex-col gap-1 shrink-0">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('text-right px-3 py-2 rounded-r-md text-sm transition-colors', tab === t.id ? 'bg-brand-600/20 text-brand-400 border-r-2 border-brand-500' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800')}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 bg-gray-800 rounded-r-xl border border-gray-700 p-6">
          {tab === 'store' && <StoreSettings />}
          {tab === 'branches' && <BranchesSettings />}
          {tab === 'payment' && <PaymentMethodsSettings />}
          {tab === 'categories' && <ProductCategoriesSettings />}
          {tab === 'tax' && <TaxRatesSettings />}
          {tab === 'expense-categories' && <ExpenseCategoriesSettings />}
          {tab === 'users' && <UsersSettings />}
          {tab === 'coupons' && <CouponsSettings />}
          {tab === 'audit' && <AuditLogSettings />}
          {tab === 'password' && <ChangePasswordSettings />}
        </div>
      </div>
    </AppShell>
  )
}

// ─── Store Settings ───────────────────────────────────────────────────────────
function StoreSettings() {
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h3 className="text-lg font-semibold text-gray-100">بيانات المتجر</h3>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm text-gray-400 block mb-1">اسم المتجر</label>
          <input className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500" placeholder="اسم متجرك" />
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">المنطقة الزمنية</label>
          <select className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100">
            <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
          </select>
        </div>
        <Button className="w-fit">حفظ التغييرات</Button>
      </div>
    </div>
  )
}

// ─── Branches Settings ────────────────────────────────────────────────────────
interface Branch { id: string; name: string; isMain: boolean; isActive: boolean; address?: string; phone?: string }

const branchSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  address: z.string().optional(),
  phone: z.string().optional(),
})
type BranchFormData = z.infer<typeof branchSchema>

function BranchesSettings() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches-settings'],
    queryFn: async () => (await api.get<{ data: Branch[] }>('/branches')).data.data,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BranchFormData>({ resolver: zodResolver(branchSchema) })

  const openNew = () => { setEditing(null); reset({}); setDrawerOpen(true) }
  const openEdit = (b: Branch) => { setEditing(b); reset({ name: b.name, address: b.address ?? '', phone: b.phone ?? '' }); setDrawerOpen(true) }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: BranchFormData) => {
      if (editing) await api.patch(`/branches/${editing.id}`, data)
      else await api.post('/branches', data)
    },
    onSuccess: () => {
      toast.success(editing ? 'تم تحديث الفرع' : 'تم إضافة الفرع')
      qc.invalidateQueries({ queryKey: ['branches-settings'] })
      qc.invalidateQueries({ queryKey: ['branches'] })
      setDrawerOpen(false)
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const { mutate: toggleActive } = useMutation({
    mutationFn: async (b: Branch) => api.patch(`/branches/${b.id}`, { isActive: !b.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches-settings'] })
      qc.invalidateQueries({ queryKey: ['branches'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">الفروع</h3>
        <Button onClick={openNew}><Plus className="w-4 h-4" />فرع جديد</Button>
      </div>

      <Table
        columns={[
          { key: 'name', header: 'الفرع', render: (b) => (
            <div>
              <span className="font-medium text-gray-100">{b.name}</span>
              {b.isMain && <Badge variant="info" className="mr-2">رئيسي</Badge>}
            </div>
          )},
          { key: 'address', header: 'العنوان', render: (b) => <span className="text-gray-400 text-sm">{b.address ?? '—'}</span> },
          { key: 'phone', header: 'الهاتف', className: 'font-mono text-gray-500 text-sm' },
          { key: 'isActive', header: 'الحالة', render: (b) => <Badge variant={b.isActive ? 'success' : 'gray'} dot>{b.isActive ? 'نشط' : 'معطّل'}</Badge> },
          { key: 'actions', header: '', render: (b) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(b)} disabled={b.isMain}><Edit2 className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" onClick={() => toggleActive(b)} disabled={b.isMain}>
                {b.isActive ? <ToggleRight className="w-4 h-4 text-success-500" /> : <ToggleLeft className="w-4 h-4 text-gray-500" />}
              </Button>
            </div>
          )},
        ]}
        data={branches} keyExtractor={(b) => b.id} emptyMessage="لا توجد فروع"
      />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل الفرع' : 'فرع جديد'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
            <Button loading={isPending} onClick={handleSubmit((d) => save(d))}>حفظ</Button>
          </>
        }
      >
        <form className="flex flex-col gap-5">
          <Input label="اسم الفرع" error={errors.name?.message} {...register('name')} />
          <Input label="العنوان" {...register('address')} />
          <Input label="رقم الهاتف" type="tel" {...register('phone')} />
        </form>
      </Drawer>
    </div>
  )
}

// ─── Payment Methods Settings ─────────────────────────────────────────────────
interface PaymentMethod {
  id: string; name: string; type: string
  feeType: string; feePercentage: string | number; feeFixed: string | number
  feeBearer: string; isActive: boolean
}

const pmSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  type: z.enum(['cash', 'card', 'ewallet', 'bnpl', 'bank_transfer']),
  feeType: z.enum(['none', 'percentage', 'fixed', 'both']).default('none'),
  feePercentage: z.coerce.number().min(0).default(0),
  feeFixed: z.coerce.number().min(0).default(0),
  feeBearer: z.enum(['customer', 'merchant', 'negotiable']).default('merchant'),
})
type PmFormData = z.infer<typeof pmSchema>

const typeLabels: Record<string, string> = { cash: 'نقدي', card: 'بطاقة', ewallet: 'محفظة', bnpl: 'تقسيط', bank_transfer: 'تحويل بنكي' }
const feeTypeLabels: Record<string, string> = { none: 'بدون', percentage: 'نسبة مئوية', fixed: 'مبلغ ثابت', both: 'نسبة + ثابت' }

function PaymentMethodsSettings() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentMethod | null>(null)

  const { data: methods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: async () => (await api.get<{ data: PaymentMethod[] }>('/payment-methods')).data.data,
  })

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PmFormData>({ resolver: zodResolver(pmSchema) })
  const feeType = watch('feeType')

  const openNew = () => { setEditing(null); reset({ feeType: 'none', feeBearer: 'merchant', feePercentage: 0, feeFixed: 0 }); setDrawerOpen(true) }
  const openEdit = (pm: PaymentMethod) => {
    setEditing(pm)
    reset({ name: pm.name, type: pm.type as PmFormData['type'], feeType: pm.feeType as PmFormData['feeType'], feePercentage: Number(pm.feePercentage), feeFixed: Number(pm.feeFixed), feeBearer: pm.feeBearer as PmFormData['feeBearer'] })
    setDrawerOpen(true)
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: PmFormData) => {
      if (editing) await api.patch(`/payment-methods/${editing.id}`, data)
      else await api.post('/payment-methods', data)
    },
    onSuccess: () => {
      toast.success(editing ? 'تم التحديث' : 'تم الإضافة')
      qc.invalidateQueries({ queryKey: ['payment-methods'] })
      setDrawerOpen(false)
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const { mutate: toggleActive } = useMutation({
    mutationFn: async (pm: PaymentMethod) => api.patch(`/payment-methods/${pm.id}`, { isActive: !pm.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
    onError: () => toast.error('حدث خطأ'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">طرق الدفع</h3>
        <Button onClick={openNew}><Plus className="w-4 h-4" />إضافة طريقة</Button>
      </div>

      <Table
        columns={[
          { key: 'name', header: 'الاسم', render: (pm) => <span className="font-medium text-gray-100">{pm.name}</span> },
          { key: 'type', header: 'النوع', render: (pm) => <Badge variant="gray">{typeLabels[pm.type] ?? pm.type}</Badge> },
          { key: 'feeType', header: 'نوع الرسوم', render: (pm) => <span className="text-gray-400 text-sm">{feeTypeLabels[pm.feeType] ?? pm.feeType}</span> },
          { key: 'fee', header: 'الرسوم', render: (pm) => (
            <span className="font-mono text-sm text-gray-300">
              {pm.feeType === 'none' ? '—' : pm.feeType === 'percentage' ? `${Number(pm.feePercentage)}%` : pm.feeType === 'fixed' ? `${Number(pm.feeFixed)} ج` : `${Number(pm.feePercentage)}% + ${Number(pm.feeFixed)} ج`}
            </span>
          )},
          { key: 'isActive', header: 'الحالة', render: (pm) => <Badge variant={pm.isActive ? 'success' : 'gray'} dot>{pm.isActive ? 'نشط' : 'معطّل'}</Badge> },
          { key: 'actions', header: '', render: (pm) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(pm)}><Edit2 className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" onClick={() => toggleActive(pm)}>
                {pm.isActive ? <ToggleRight className="w-4 h-4 text-success-500" /> : <ToggleLeft className="w-4 h-4 text-gray-500" />}
              </Button>
            </div>
          )},
        ]}
        data={methods} keyExtractor={(pm) => pm.id} emptyMessage="لا توجد طرق دفع"
      />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل طريقة الدفع' : 'طريقة دفع جديدة'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
            <Button loading={isPending} onClick={handleSubmit((d) => save(d))}>حفظ</Button>
          </>
        }
      >
        <form className="flex flex-col gap-5">
          <Input label="الاسم" error={errors.name?.message} {...register('name')} />
          <div>
            <label className="text-sm text-gray-400 block mb-1">النوع</label>
            <select {...register('type')} disabled={!!editing} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500 disabled:opacity-50">
              <option value="cash">نقدي</option>
              <option value="card">بطاقة بنكية</option>
              <option value="ewallet">محفظة إلكترونية</option>
              <option value="bnpl">تقسيط (BNPL)</option>
              <option value="bank_transfer">تحويل بنكي</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">نوع الرسوم</label>
            <select {...register('feeType')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="none">بدون رسوم</option>
              <option value="percentage">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت</option>
              <option value="both">نسبة + مبلغ ثابت</option>
            </select>
          </div>
          {(feeType === 'percentage' || feeType === 'both') && (
            <Input label="نسبة الرسوم (%)" type="number" step="0.01" {...register('feePercentage')} />
          )}
          {(feeType === 'fixed' || feeType === 'both') && (
            <Input label="مبلغ الرسوم الثابت (ج)" type="number" step="0.01" {...register('feeFixed')} />
          )}
          <div>
            <label className="text-sm text-gray-400 block mb-1">من يتحمل الرسوم</label>
            <select {...register('feeBearer')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="merchant">المتجر</option>
              <option value="customer">العميل</option>
              <option value="negotiable">قابل للتفاوض</option>
            </select>
          </div>
        </form>
      </Drawer>
    </div>
  )
}

// ─── Users Settings ───────────────────────────────────────────────────────────
interface TenantUser { id: string; fullName: string; email: string; role: { id: string; name: string; slug: string }; isActive: boolean; lastLogin?: string }
interface Role { id: string; name: string; slug: string }

const userSchema = z.object({
  fullName: z.string().min(1, 'الاسم مطلوب'),
  email: z.string().email('بريد غير صالح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  roleId: z.string().uuid('اختر دوراً'),
  branchId: z.string().uuid().optional().or(z.literal('')),
})
type UserFormData = z.infer<typeof userSchema>

function UsersSettings() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: users = [], isLoading } = useQuery<TenantUser[]>({
    queryKey: ['tenant-users'],
    queryFn: async () => (await api.get<{ data: TenantUser[] }>('/auth/users')).data.data,
  })

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<{ data: Role[] }>('/auth/roles')).data.data,
    enabled: drawerOpen,
  })

  const { data: branches = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['branches'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/branches')).data.data,
    enabled: drawerOpen,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserFormData>({ resolver: zodResolver(userSchema) })

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: async (data: UserFormData) => api.post('/auth/users', { ...data, branchId: data.branchId || undefined }),
    onSuccess: () => {
      toast.success('تم إضافة المستخدم')
      qc.invalidateQueries({ queryKey: ['tenant-users'] })
      setDrawerOpen(false)
      reset()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      toast.error(msg ?? 'حدث خطأ')
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">المستخدمون والأدوار</h3>
        <Button onClick={() => { reset({}); setDrawerOpen(true) }}><Plus className="w-4 h-4" />مستخدم جديد</Button>
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm">جارٍ التحميل...</div>
      ) : (
        <Table
          columns={[
            { key: 'fullName', header: 'الاسم', render: (u) => <span className="font-medium text-gray-100">{u.fullName}</span> },
            { key: 'email', header: 'البريد الإلكتروني', className: 'text-gray-400 text-sm' },
            { key: 'role', header: 'الدور', render: (u) => <Badge variant="gray">{u.role?.name ?? u.role?.slug ?? '—'}</Badge> },
            { key: 'isActive', header: 'الحالة', render: (u) => <Badge variant={u.isActive ? 'success' : 'gray'} dot>{u.isActive ? 'نشط' : 'معطّل'}</Badge> },
            { key: 'lastLogin', header: 'آخر دخول', render: (u) => u.lastLogin
              ? <span className="text-gray-500 text-xs">{new Date(u.lastLogin).toLocaleDateString('ar-EG')}</span>
              : <span className="text-gray-600">—</span>
            },
          ]}
          data={users} keyExtractor={(u) => u.id} emptyMessage="لا يوجد مستخدمون"
        />
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="مستخدم جديد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
            <Button loading={isPending} onClick={handleSubmit((d) => createUser(d))}>حفظ</Button>
          </>
        }
      >
        <form className="flex flex-col gap-5">
          <Input label="الاسم الكامل" error={errors.fullName?.message} {...register('fullName')} />
          <Input label="البريد الإلكتروني" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="كلمة المرور" type="password" error={errors.password?.message} {...register('password')} />
          <div>
            <label className="text-sm text-gray-400 block mb-1">الدور</label>
            <select {...register('roleId')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="">اختر الدور</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {errors.roleId && <p className="text-danger-500 text-xs mt-1">{errors.roleId.message}</p>}
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">الفرع (اختياري)</label>
            <select {...register('branchId')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="">كل الفروع</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </form>
      </Drawer>
    </div>
  )
}

// ─── Product Categories Settings ──────────────────────────────────────────────
interface ProductCategory { id: string; name: string; parentId?: string; isActive: boolean }

const catSchema = z.object({ name: z.string().min(1, 'الاسم مطلوب') })
type CatFormData = z.infer<typeof catSchema>

function ProductCategoriesSettings() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<ProductCategory | null>(null)

  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ['product-categories-settings'],
    queryFn: async () => (await api.get<{ data: ProductCategory[] }>('/products/categories')).data.data,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CatFormData>({ resolver: zodResolver(catSchema) })

  const openNew = () => { setEditing(null); reset({}); setDrawerOpen(true) }
  const openEdit = (c: ProductCategory) => { setEditing(c); reset({ name: c.name }); setDrawerOpen(true) }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: CatFormData) => {
      if (editing) await api.patch(`/products/categories/${editing.id}`, data)
      else await api.post('/products/categories', data)
    },
    onSuccess: () => {
      toast.success(editing ? 'تم التحديث' : 'تم الإضافة')
      qc.invalidateQueries({ queryKey: ['product-categories-settings'] })
      qc.invalidateQueries({ queryKey: ['product-categories'] })
      setDrawerOpen(false)
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const { mutate: toggle } = useMutation({
    mutationFn: async (c: ProductCategory) => api.patch(`/products/categories/${c.id}`, { isActive: !c.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-categories-settings'] }),
    onError: () => toast.error('حدث خطأ'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">فئات المنتجات</h3>
        <Button onClick={openNew}><Plus className="w-4 h-4" />فئة جديدة</Button>
      </div>
      <Table
        columns={[
          { key: 'name', header: 'الفئة', render: (c) => <span className="font-medium text-gray-100">{c.name}</span> },
          { key: 'isActive', header: 'الحالة', render: (c) => <Badge variant={c.isActive ? 'success' : 'gray'} dot>{c.isActive ? 'نشطة' : 'معطّلة'}</Badge> },
          { key: 'actions', header: '', render: (c) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit2 className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" onClick={() => toggle(c)}>
                {c.isActive ? <ToggleRight className="w-4 h-4 text-success-500" /> : <ToggleLeft className="w-4 h-4 text-gray-500" />}
              </Button>
            </div>
          )},
        ]}
        data={categories} keyExtractor={(c) => c.id} emptyMessage="لا توجد فئات"
      />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل الفئة' : 'فئة جديدة'}
        footer={<><Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button><Button loading={isPending} onClick={handleSubmit((d) => save(d))}>حفظ</Button></>}
      >
        <form className="flex flex-col gap-4">
          <Input label="اسم الفئة" error={errors.name?.message} {...register('name')} />
        </form>
      </Drawer>
    </div>
  )
}

// ─── Tax Rates Settings ───────────────────────────────────────────────────────
interface TaxRate { id: string; name: string; rate: string | number; isDefault: boolean; isActive: boolean }

const taxSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  rate: z.coerce.number().min(0, 'لا يمكن أن يكون سالباً').max(100, 'أقصى قيمة 100'),
  isDefault: z.boolean().default(false),
})
type TaxFormData = z.infer<typeof taxSchema>

function TaxRatesSettings() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<TaxRate | null>(null)

  const { data: taxRates = [] } = useQuery<TaxRate[]>({
    queryKey: ['tax-rates-settings'],
    queryFn: async () => (await api.get<{ data: TaxRate[] }>('/products/tax-rates')).data.data,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaxFormData>({ resolver: zodResolver(taxSchema) })

  const openNew = () => { setEditing(null); reset({ rate: 0, isDefault: false }); setDrawerOpen(true) }
  const openEdit = (t: TaxRate) => { setEditing(t); reset({ name: t.name, rate: Number(t.rate), isDefault: t.isDefault }); setDrawerOpen(true) }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: TaxFormData) => {
      if (editing) await api.patch(`/products/tax-rates/${editing.id}`, data)
      else await api.post('/products/tax-rates', data)
    },
    onSuccess: () => {
      toast.success(editing ? 'تم التحديث' : 'تم الإضافة')
      qc.invalidateQueries({ queryKey: ['tax-rates-settings'] })
      qc.invalidateQueries({ queryKey: ['tax-rates'] })
      setDrawerOpen(false)
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const { mutate: toggle } = useMutation({
    mutationFn: async (t: TaxRate) => api.patch(`/products/tax-rates/${t.id}`, { isActive: !t.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-rates-settings'] }),
    onError: () => toast.error('حدث خطأ'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">معدلات الضريبة</h3>
        <Button onClick={openNew}><Plus className="w-4 h-4" />معدل جديد</Button>
      </div>
      <Table
        columns={[
          { key: 'name', header: 'الاسم', render: (t) => (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-100">{t.name}</span>
              {t.isDefault && <Badge variant="info">افتراضي</Badge>}
            </div>
          )},
          { key: 'rate', header: 'النسبة', render: (t) => <span className="font-mono text-gray-300">{Number(t.rate)}%</span> },
          { key: 'isActive', header: 'الحالة', render: (t) => <Badge variant={t.isActive ? 'success' : 'gray'} dot>{t.isActive ? 'نشط' : 'معطّل'}</Badge> },
          { key: 'actions', header: '', render: (t) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Edit2 className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" onClick={() => toggle(t)}>
                {t.isActive ? <ToggleRight className="w-4 h-4 text-success-500" /> : <ToggleLeft className="w-4 h-4 text-gray-500" />}
              </Button>
            </div>
          )},
        ]}
        data={taxRates} keyExtractor={(t) => t.id} emptyMessage="لا توجد معدلات ضريبة"
      />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل معدل الضريبة' : 'معدل ضريبة جديد'}
        footer={<><Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button><Button loading={isPending} onClick={handleSubmit((d) => save(d))}>حفظ</Button></>}
      >
        <form className="flex flex-col gap-4">
          <Input label="الاسم (مثال: ضريبة القيمة المضافة)" error={errors.name?.message} {...register('name')} />
          <Input label="النسبة %" type="number" step="0.01" error={errors.rate?.message} {...register('rate')} />
          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" {...register('isDefault')} className="w-4 h-4 accent-brand-500" />
            تعيين كمعدل افتراضي
          </label>
        </form>
      </Drawer>
    </div>
  )
}

// ─── Audit Log Settings ───────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  entity: string
  entityId?: string
  action: string
  before?: unknown
  after?: unknown
  ip?: string
  createdAt: string
  actor?: { id: string; fullName: string }
}
interface AuditMeta { total: number; page: number; limit: number; pages: number }

const entityLabels: Record<string, string> = {
  invoice: 'فاتورة', product: 'منتج', user: 'مستخدم', customer: 'عميل',
  supplier: 'مورد', expense: 'مصروف', stock: 'مخزون', installment: 'قسط',
  purchase_order: 'طلب شراء', branch: 'فرع',
}

const actionLabels: Record<string, { label: string; color: string }> = {
  create: { label: 'إنشاء', color: 'text-success-400' },
  update: { label: 'تعديل', color: 'text-brand-400' },
  delete: { label: 'حذف', color: 'text-danger-400' },
  approve: { label: 'موافقة', color: 'text-success-400' },
  reject: { label: 'رفض', color: 'text-warning-400' },
  login: { label: 'دخول', color: 'text-gray-400' },
}

function AuditLogSettings() {
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')

  const { data, isLoading } = useQuery<{ data: AuditLogEntry[]; meta: AuditMeta }>({
    queryKey: ['audit-logs', page, entity, action],
    queryFn: async () => {
      const res = await api.get<{ data: AuditLogEntry[]; meta: AuditMeta }>('/auth/audit-logs', {
        params: { page, limit: 20, ...(entity ? { entity } : {}), ...(action ? { action } : {}) },
      })
      return res.data
    },
  })

  const logs = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-400" />سجل التدقيق
        </h3>
      </div>

      <div className="flex gap-3">
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
          <option value="">كل الكيانات</option>
          {Object.entries(entityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
          <option value="">كل الإجراءات</option>
          {Object.entries(actionLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-gray-700 rounded animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">لا توجد سجلات</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-700">
          {logs.map((log) => {
            const act = actionLabels[log.action] ?? { label: log.action, color: 'text-gray-400' }
            return (
              <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm font-medium', act.color)}>{act.label}</span>
                    <span className="text-xs text-gray-400">{entityLabels[log.entity] ?? log.entity}</span>
                    {log.actor && <span className="text-xs text-gray-500">بواسطة {log.actor.fullName}</span>}
                    {log.ip && <span className="text-xs text-gray-600 font-mono">{log.ip}</span>}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{new Date(log.createdAt).toLocaleString('ar-EG')}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {meta && meta.pages > 1 && (
        <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPage={setPage} />
      )}
    </div>
  )
}

// ─── Change Password Settings ─────────────────────────────────────────────────

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z.string().min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'),
  confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتان',
  path: ['confirmPassword'],
})
type PwFormData = z.infer<typeof pwSchema>

function ChangePasswordSettings() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwFormData>({ resolver: zodResolver(pwSchema) })

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: async (data: PwFormData) => {
      await api.patch('/auth/me/password', { currentPassword: data.currentPassword, newPassword: data.newPassword })
    },
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح')
      reset()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      toast.error(msg ?? 'حدث خطأ')
    },
  })

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <h3 className="text-lg font-semibold text-gray-100">تغيير كلمة المرور</h3>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit((d) => changePassword(d))}>
        <Input label="كلمة المرور الحالية" type="password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <Input label="كلمة المرور الجديدة" type="password" error={errors.newPassword?.message} {...register('newPassword')} />
        <Input label="تأكيد كلمة المرور الجديدة" type="password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button loading={isPending} type="submit" className="w-fit">تغيير كلمة المرور</Button>
      </form>
    </div>
  )
}

// ─── Expense Categories Settings ──────────────────────────────────────────────
interface ExpenseCategory { id: string; name: string; description?: string; isActive: boolean }

const expCatSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  description: z.string().optional(),
})
type ExpCatFormData = z.infer<typeof expCatSchema>

function ExpenseCategoriesSettings() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseCategory | null>(null)

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories-settings'],
    queryFn: async () => (await api.get<{ data: ExpenseCategory[] }>('/expenses/categories')).data.data,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpCatFormData>({ resolver: zodResolver(expCatSchema) })

  const openNew = () => { setEditing(null); reset({}); setDrawerOpen(true) }
  const openEdit = (c: ExpenseCategory) => { setEditing(c); reset({ name: c.name, description: c.description ?? '' }); setDrawerOpen(true) }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: ExpCatFormData) => {
      if (editing) await api.patch(`/expenses/categories/${editing.id}`, data)
      else await api.post('/expenses/categories', data)
    },
    onSuccess: () => {
      toast.success(editing ? 'تم التحديث' : 'تم الإضافة')
      qc.invalidateQueries({ queryKey: ['expense-categories-settings'] })
      qc.invalidateQueries({ queryKey: ['expense-categories'] })
      setDrawerOpen(false)
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const { mutate: toggle } = useMutation({
    mutationFn: async (c: ExpenseCategory) => api.patch(`/expenses/categories/${c.id}`, { isActive: !c.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense-categories-settings'] }),
    onError: () => toast.error('حدث خطأ'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">فئات المصروفات</h3>
        <Button onClick={openNew}><Plus className="w-4 h-4" />فئة جديدة</Button>
      </div>
      <Table
        columns={[
          { key: 'name', header: 'الفئة', render: (c) => <span className="font-medium text-gray-100">{c.name}</span> },
          { key: 'description', header: 'الوصف', render: (c) => <span className="text-gray-500 text-sm">{c.description ?? '—'}</span> },
          { key: 'isActive', header: 'الحالة', render: (c) => <Badge variant={c.isActive ? 'success' : 'gray'} dot>{c.isActive ? 'نشطة' : 'معطّلة'}</Badge> },
          { key: 'actions', header: '', render: (c) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit2 className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" onClick={() => toggle(c)}>
                {c.isActive ? <ToggleRight className="w-4 h-4 text-success-500" /> : <ToggleLeft className="w-4 h-4 text-gray-500" />}
              </Button>
            </div>
          )},
        ]}
        data={categories} keyExtractor={(c) => c.id} emptyMessage="لا توجد فئات"
      />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل الفئة' : 'فئة مصروف جديدة'}
        footer={<><Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button><Button loading={isPending} onClick={handleSubmit((d) => save(d))}>حفظ</Button></>}
      >
        <form className="flex flex-col gap-4">
          <Input label="اسم الفئة" error={errors.name?.message} {...register('name')} />
          <div>
            <label className="text-sm text-gray-400 block mb-1">الوصف (اختياري)</label>
            <textarea {...register('description')} rows={2} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500 resize-none" />
          </div>
        </form>
      </Drawer>
    </div>
  )
}

// ─── Coupons Settings ─────────────────────────────────────────────────────────

interface Coupon {
  id: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: string | number
  minAmount?: string | number | null
  maxUses?: number | null
  usedCount: number
  expiresAt?: string | null
  isActive: boolean
}

const couponSchema = z.object({
  code: z.string().min(1, 'الكود مطلوب').toUpperCase(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().positive('يجب أن تكون القيمة أكبر من صفر'),
  minAmount: z.coerce.number().min(0).optional().or(z.literal('')),
  maxUses: z.coerce.number().int().positive().optional().or(z.literal('')),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
})
type CouponFormData = z.infer<typeof couponSchema>

function CouponsSettings() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ['coupons'],
    queryFn: async () => (await api.get<{ data: Coupon[] }>('/coupons')).data.data,
  })

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CouponFormData>({ resolver: zodResolver(couponSchema) })
  const discountType = watch('discountType')

  const openNew = () => { setEditing(null); reset({ discountType: 'percentage', isActive: true }); setDrawerOpen(true) }
  const openEdit = (c: Coupon) => {
    setEditing(c)
    reset({
      code: c.code,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      minAmount: c.minAmount ? Number(c.minAmount) : '',
      maxUses: c.maxUses ?? '',
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : '',
      isActive: c.isActive,
    })
    setDrawerOpen(true)
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: CouponFormData) => {
      const body = {
        ...data,
        code: data.code.toUpperCase(),
        minAmount: data.minAmount === '' ? undefined : data.minAmount,
        maxUses: data.maxUses === '' ? undefined : data.maxUses,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : undefined,
      }
      if (editing) await api.patch(`/coupons/${editing.id}`, body)
      else await api.post('/coupons', body)
    },
    onSuccess: () => {
      toast.success(editing ? 'تم التحديث' : 'تم إضافة الكوبون')
      qc.invalidateQueries({ queryKey: ['coupons'] })
      setDrawerOpen(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      toast.error(msg ?? 'حدث خطأ')
    },
  })

  const { mutate: toggle } = useMutation({
    mutationFn: async (c: Coupon) => api.patch(`/coupons/${c.id}`, { isActive: !c.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
    onError: () => toast.error('حدث خطأ'),
  })

  const { mutate: deleteCoupon } = useMutation({
    mutationFn: async (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => { toast.success('تم حذف الكوبون'); qc.invalidateQueries({ queryKey: ['coupons'] }) },
    onError: () => toast.error('لا يمكن حذف كوبون مستخدم'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <Tag className="w-5 h-5 text-brand-400" />كوبونات الخصم
        </h3>
        <Button onClick={openNew}><Plus className="w-4 h-4" />كوبون جديد</Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-gray-700 rounded animate-pulse" />)}</div>
      ) : (
        <Table
          columns={[
            { key: 'code', header: 'الكود', render: (c) => <span className="font-mono font-bold text-brand-400">{c.code}</span> },
            { key: 'discount', header: 'الخصم', render: (c) => (
              <span className="font-mono text-gray-300">
                {c.discountType === 'percentage' ? `${Number(c.discountValue)}%` : `${Number(c.discountValue)} ج`}
              </span>
            )},
            { key: 'uses', header: 'الاستخدامات', render: (c) => (
              <span className="text-sm text-gray-400 font-mono">
                {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
              </span>
            )},
            { key: 'expiresAt', header: 'الانتهاء', render: (c) => c.expiresAt
              ? <span className={cn('text-xs font-mono', new Date(c.expiresAt) < new Date() ? 'text-danger-400' : 'text-gray-400')}>{new Date(c.expiresAt).toLocaleDateString('ar-EG')}</span>
              : <span className="text-gray-600">—</span>
            },
            { key: 'isActive', header: 'الحالة', render: (c) => <Badge variant={c.isActive ? 'success' : 'gray'} dot>{c.isActive ? 'نشط' : 'معطّل'}</Badge> },
            { key: 'actions', header: '', render: (c) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => toggle(c)}>
                  {c.isActive ? <ToggleRight className="w-4 h-4 text-success-500" /> : <ToggleLeft className="w-4 h-4 text-gray-500" />}
                </Button>
                <Button variant="ghost" size="sm" className="text-danger-500" onClick={() => deleteCoupon(c.id)}><Edit2 className="w-3 h-3" /></Button>
              </div>
            )},
          ]}
          data={coupons} keyExtractor={(c) => c.id} emptyMessage="لا توجد كوبونات"
        />
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل الكوبون' : 'كوبون جديد'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
            <Button loading={isPending} onClick={handleSubmit((d) => save(d))}>حفظ</Button>
          </>
        }
      >
        <form className="flex flex-col gap-5">
          <Input label="كود الخصم" placeholder="مثال: SUMMER20" error={errors.code?.message} {...register('code')} disabled={!!editing} />
          <div>
            <label className="text-sm text-gray-400 block mb-1">نوع الخصم</label>
            <select {...register('discountType')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="percentage">نسبة مئوية (%)</option>
              <option value="fixed">مبلغ ثابت (ج)</option>
            </select>
          </div>
          <Input
            label={discountType === 'percentage' ? 'قيمة الخصم (%)' : 'قيمة الخصم (ج)'}
            type="number" step="0.01"
            error={errors.discountValue?.message}
            {...register('discountValue')}
          />
          <Input label="الحد الأدنى للطلب (ج) — اختياري" type="number" step="0.01" {...register('minAmount')} />
          <Input label="الحد الأقصى للاستخدام — اختياري" type="number" {...register('maxUses')} />
          <div>
            <label className="text-sm text-gray-400 block mb-1">تاريخ الانتهاء — اختياري</label>
            <input type="datetime-local" {...register('expiresAt')} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500" />
          </div>
          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" {...register('isActive')} className="w-4 h-4 accent-brand-500" />
            كوبون نشط
          </label>
        </form>
      </Drawer>
    </div>
  )
}
