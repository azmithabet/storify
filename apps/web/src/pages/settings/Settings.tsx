import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Button, Input, Badge, Table, Drawer } from '@/components/ui'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'

const tabs = [
  { id: 'store', label: 'بيانات المتجر' },
  { id: 'branches', label: 'الفروع' },
  { id: 'payment', label: 'طرق الدفع' },
  { id: 'users', label: 'المستخدمون' },
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
          {tab === 'users' && <UsersSettings />}
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
