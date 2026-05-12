import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

const tabs = [
  { id: 'store', label: 'بيانات المتجر' },
  { id: 'payment', label: 'طرق الدفع' },
  { id: 'users', label: 'المستخدمون والصلاحيات' },
  { id: 'eta', label: 'إعدادات الضريبة ETA' },
  { id: 'billing', label: 'الاشتراك والفوترة' },
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
          {tab !== 'store' && <div className="text-gray-500 text-center py-20">قريباً...</div>}
        </div>
      </div>
    </AppShell>
  )
}

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
