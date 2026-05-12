import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, Badge, Alert, Skeleton } from '@/components/ui'
import { api } from '@/api/client'

interface DashboardData {
  todaySales: number
  pendingInstallments: number
  lowStockAlerts: number
  etaFailures: number
  totalFees: number
  revenueThisMonth: number
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get<DashboardData>('/reports/dashboard')
      return res.data
    },
    refetchInterval: 2 * 60 * 1000,
  })

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
          <StatCard label="مبيعات اليوم" value={`${(data?.todaySales ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-brand-500" />
          <StatCard label="أقساط معلقة" value={data?.pendingInstallments ?? 0} accentColor="bg-violet-500" />
          <StatCard label="تنبيهات مخزون" value={data?.lowStockAlerts ?? 0} accentColor="bg-warning-500" />
          <StatCard label="إيرادات الشهر" value={`${(data?.revenueThisMonth ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-success-500" />
          <StatCard label="رسوم الدفع" value={`${(data?.totalFees ?? 0).toLocaleString('ar-EG')} ج`} accentColor="bg-cyan-500" />
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
