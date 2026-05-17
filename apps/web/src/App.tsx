import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthGuard, GuestGuard, RoleGuard } from '@/components/guards/AuthGuard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Skeleton } from '@/components/ui'

const Landing = lazy(() => import('@/pages/Landing'))
const Login = lazy(() => import('@/pages/auth/Login'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Register = lazy(() => import('@/pages/auth/Register'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const ComponentsShowcase = lazy(() => import('@/pages/dev/Components'))

// Lazy-load all protected pages (stubs for now)
const POS = lazy(() => import('@/pages/pos/POS'))
const DayClose = lazy(() => import('@/pages/pos/DayClose'))
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
const Returns = lazy(() => import('@/pages/returns/Returns'))

const PageLoader = () => (
  <div className="p-8 flex flex-col gap-4">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-64 w-full" />
  </div>
)

function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
}

export default function App() {
  return (
    <RouteBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Guest routes */}
          <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
          <Route path="/forgot-password" element={<GuestGuard><ForgotPassword /></GuestGuard>} />
          <Route path="/reset-password" element={<GuestGuard><ResetPassword /></GuestGuard>} />
          <Route path="/register" element={<GuestGuard><Register /></GuestGuard>} />

          {/* Dev route (no auth required in dev) */}
          <Route path="/dev/components" element={<ComponentsShowcase />} />

          {/* Public marketing landing — visible to everyone */}
          <Route path="/" element={<Landing />} />

          {/* Protected routes — each wrapped in RoleGuard so unauthorized users
              see a friendly "forbidden" view rather than a half-loaded page
              with all empty data and 403s in the console. Super-admin bypasses. */}
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/pos" element={<AuthGuard><RoleGuard resource="invoices" action="create"><POS /></RoleGuard></AuthGuard>} />
          <Route path="/day-close" element={<AuthGuard><RoleGuard resource="reports" action="read"><DayClose /></RoleGuard></AuthGuard>} />
          <Route path="/products/*" element={<AuthGuard><RoleGuard resource="products" action="read"><Products /></RoleGuard></AuthGuard>} />
          <Route path="/stock/*" element={<AuthGuard><RoleGuard resource="stock" action="read"><Stock /></RoleGuard></AuthGuard>} />
          <Route path="/customers/*" element={<AuthGuard><RoleGuard resource="customers" action="read"><Customers /></RoleGuard></AuthGuard>} />
          <Route path="/invoices/*" element={<AuthGuard><RoleGuard resource="invoices" action="read"><Invoices /></RoleGuard></AuthGuard>} />
          <Route path="/installments/*" element={<AuthGuard><RoleGuard resource="installments" action="read"><Installments /></RoleGuard></AuthGuard>} />
          <Route path="/suppliers/*" element={<AuthGuard><RoleGuard resource="suppliers" action="read"><Suppliers /></RoleGuard></AuthGuard>} />
          <Route path="/expenses/*" element={<AuthGuard><RoleGuard resource="expenses" action="read"><Expenses /></RoleGuard></AuthGuard>} />
          <Route path="/reports/*" element={<AuthGuard><RoleGuard resource="reports" action="read"><Reports /></RoleGuard></AuthGuard>} />
          <Route path="/purchase-orders/*" element={<AuthGuard><RoleGuard resource="purchase_orders" action="read"><PurchaseOrders /></RoleGuard></AuthGuard>} />
          <Route path="/settings/*" element={<AuthGuard><RoleGuard resource="settings" action="read"><Settings /></RoleGuard></AuthGuard>} />
          <Route path="/returns/*" element={<AuthGuard><RoleGuard resource="invoices" action="read"><Returns /></RoleGuard></AuthGuard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </RouteBoundary>
  )
}
