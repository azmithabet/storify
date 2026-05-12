import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard, GuestGuard } from '@/components/guards/AuthGuard'
import { Skeleton } from '@/components/ui'

const Login = lazy(() => import('@/pages/auth/Login'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Register = lazy(() => import('@/pages/auth/Register'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const ComponentsShowcase = lazy(() => import('@/pages/dev/Components'))

// Lazy-load all protected pages (stubs for now)
const POS = lazy(() => import('@/pages/pos/POS'))
const Products = lazy(() => import('@/pages/products/Products'))
const Stock = lazy(() => import('@/pages/stock/Stock'))
const Customers = lazy(() => import('@/pages/customers/Customers'))
const Invoices = lazy(() => import('@/pages/invoices/Invoices'))
const Installments = lazy(() => import('@/pages/installments/Installments'))
const Suppliers = lazy(() => import('@/pages/suppliers/Suppliers'))
const Expenses = lazy(() => import('@/pages/expenses/Expenses'))
const Reports = lazy(() => import('@/pages/reports/Reports'))
const PurchaseOrders = lazy(() => import('@/pages/purchase-orders/PurchaseOrders'))
const Settings = lazy(() => import('@/pages/settings/Settings'))

const PageLoader = () => (
  <div className="p-8 flex flex-col gap-4">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-64 w-full" />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Guest routes */}
        <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
        <Route path="/forgot-password" element={<GuestGuard><ForgotPassword /></GuestGuard>} />
        <Route path="/reset-password" element={<GuestGuard><ResetPassword /></GuestGuard>} />
        <Route path="/register" element={<GuestGuard><Register /></GuestGuard>} />

        {/* Dev route (no auth required in dev) */}
        <Route path="/dev/components" element={<ComponentsShowcase />} />

        {/* Protected routes */}
        <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/pos" element={<AuthGuard><POS /></AuthGuard>} />
        <Route path="/products/*" element={<AuthGuard><Products /></AuthGuard>} />
        <Route path="/stock/*" element={<AuthGuard><Stock /></AuthGuard>} />
        <Route path="/customers/*" element={<AuthGuard><Customers /></AuthGuard>} />
        <Route path="/invoices/*" element={<AuthGuard><Invoices /></AuthGuard>} />
        <Route path="/installments/*" element={<AuthGuard><Installments /></AuthGuard>} />
        <Route path="/suppliers/*" element={<AuthGuard><Suppliers /></AuthGuard>} />
        <Route path="/expenses/*" element={<AuthGuard><Expenses /></AuthGuard>} />
        <Route path="/reports/*" element={<AuthGuard><Reports /></AuthGuard>} />
        <Route path="/purchase-orders/*" element={<AuthGuard><PurchaseOrders /></AuthGuard>} />
        <Route path="/settings/*" element={<AuthGuard><Settings /></AuthGuard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
