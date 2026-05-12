import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, Badge, Alert, Skeleton } from '@/components/ui'
import { api } from '@/api/client'

interface DashboardData {
  today: {
    revenue: number
    invoiceCount: number
    feeExpenses: number
  }
  pending: {
    installmentApprovals: number
    overdueInstallmentPayments: number
    expenseApprovals: number
  }
  lowStockAlerts: number
  etaFailures?: number
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: DashboardData }>('/reports/dashboard')
      return res.data.data
    },
    refetchInterval: 2 * 60 * 1000,
  })

  const pendingCount =
    (data?.pending.installmentApprovals ?? 0) +
    (data?.pending.overdueInstallmentPayments ?? 0) +
    (data?.pending.expenseApprovals ?? 0)

  return (
    <AppShell title="لوحة التحكم">
      {error && (
        <Alert variant="warning" className="mb-6">
          تعذّر تحميل بيانات اللوحة.
        </Alert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="مبيعات اليوم" value={`${(data?.today.revenue ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-brand-500" />
          <StatCard label="فواتير اليوم" value={data?.today.invoiceCount ?? 0} accentColor="bg-violet-500" />
          <StatCard label="تنبيهات مخزون" value={data?.lowStockAlerts ?? 0} accentColor="bg-warning-500" />
          <StatCard label="رسوم الدفع اليوم" value={`${(data?.today.feeExpenses ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-cyan-500" />
          <StatCard label="موافقات معلقة" value={pendingCount} accentColor="bg-success-500" />
          {(data?.etaFailures ?? 0) > 0 && (
            <div className="col-span-4">
              <Alert variant="danger" title="فشل إرسال ضريبي">
                <span>{data?.etaFailures} فاتورة فشل إرسالها للضريبة.</span>{' '}
                <Badge variant="danger" dot>يتطلب مراجعة</Badge>
              </Alert>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
