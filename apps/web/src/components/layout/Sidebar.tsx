import { NavLink } from 'react-router-dom'
import {
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  Truck,
  Receipt,
  LogOut,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/api/client'

const navItems = [
  { to: '/pos', icon: ShoppingCart, label: 'نقطة البيع' },
  { to: '/products', icon: Package, label: 'المنتجات' },
  { to: '/stock', icon: Warehouse, label: 'المخزون' },
  { to: '/customers', icon: Users, label: 'العملاء' },
  { to: '/invoices', icon: FileText, label: 'الفواتير' },
  { to: '/installments', icon: CreditCard, label: 'الأقساط' },
  { to: '/suppliers', icon: Truck, label: 'الموردون' },
  { to: '/purchase-orders', icon: ClipboardList, label: 'أوامر الشراء' },
  { to: '/expenses', icon: Receipt, label: 'المصروفات' },
  { to: '/reports', icon: BarChart3, label: 'التقارير' },
  { to: '/settings', icon: Settings, label: 'الإعدادات' },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      logout()
    }
  }

  return (
    <aside className="fixed top-0 right-0 h-full w-60 bg-gray-900 border-l border-gray-800 flex flex-col z-10">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="font-display text-2xl font-bold text-brand-400">Storify</h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-fast mx-2 rounded-r-md',
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border-r-2 border-brand-500'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100',
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-800 p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{user?.fullName}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-500 hover:text-danger-500 transition-colors duration-fast p-1"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
