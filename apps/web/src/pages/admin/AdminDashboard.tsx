import { useQuery } from '@tanstack/react-query'
import { Building2, CreditCard, TrendingUp, Users, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { StatCard, Card, Skeleton, Alert } from '@/components/ui'
import { adminApi } from '@/api/admin-client'
import { formatMoney, formatNumber } from '@/lib/format'
import { getApiErrorMessage } from '@/lib/api-error'

interface RevenueData {
  mrr: number
  arpu: number
  activePayingSubs: number
  trialingSubs: number
  totalTenants: number
  activeTenants: number
  suspendedTenants: number
  cancelledLast30Days: number
  churnRate: number
  revenueLast30Days: number
  successfulPaymentsLast30Days: number
  failedPaymentsLast30Days: number
}

export default function AdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'revenue'],
    queryFn: async () => {
      const res = await adminApi.get<{ success: true; data: RevenueData }>('/revenue')
      return res.data.data
    },
  })

  return (
    <AdminShell title="لوحة التحكم">
      {error ? (
        <Alert variant="danger">{getApiErrorMessage(error, 'تعذر تحميل البيانات')}</Alert>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="MRR (شهري متكرر)"
              value={`${formatMoney(data.mrr)} ج.م`}
              accentColor="bg-success-500"
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <StatCard
              label="ARPU (متوسط لكل مشترك)"
              value={`${formatMoney(data.arpu)} ج.م`}
              accentColor="bg-brand-500"
              icon={<CreditCard className="w-4 h-4" />}
            />
            <StatCard
              label="اشتراكات نشطة (دافعة)"
              value={formatNumber(data.activePayingSubs)}
              accentColor="bg-success-500"
              icon={<CheckCircle2 className="w-4 h-4" />}
            />
            <StatCard
              label="اشتراكات تجريبية"
              value={formatNumber(data.trialingSubs)}
              accentColor="bg-warning-500"
              icon={<Users className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <StatCard
              label="إجمالي المتاجر"
              value={formatNumber(data.totalTenants)}
              icon={<Building2 className="w-4 h-4" />}
            />
            <StatCard
              label="متاجر نشطة"
              value={formatNumber(data.activeTenants)}
              accentColor="bg-success-500"
              icon={<CheckCircle2 className="w-4 h-4" />}
            />
            <StatCard
              label="متاجر معلّقة"
              value={formatNumber(data.suspendedTenants)}
              accentColor="bg-warning-500"
              icon={<AlertTriangle className="w-4 h-4" />}
            />
            <StatCard
              label="إلغاءات آخر 30 يوم"
              value={formatNumber(data.cancelledLast30Days)}
              accentColor="bg-danger-500"
              icon={<XCircle className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
            <Card>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">إيرادات آخر 30 يوم</h3>
              <p className="font-mono text-3xl font-bold text-success-400">
                {formatMoney(data.revenueLast30Days)} <span className="text-base text-gray-500">ج.م</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {formatNumber(data.successfulPaymentsLast30Days)} عملية ناجحة
              </p>
            </Card>

            <Card>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">معدّل الإلغاء (شهري)</h3>
              <p className="font-mono text-3xl font-bold text-gray-100">
                {(data.churnRate * 100).toFixed(1)}<span className="text-base text-gray-500">%</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {formatNumber(data.cancelledLast30Days)} / {formatNumber(data.activePayingSubs + data.cancelledLast30Days)}
              </p>
            </Card>

            <Card>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">مدفوعات فاشلة آخر 30 يوم</h3>
              <p className="font-mono text-3xl font-bold text-danger-400">
                {formatNumber(data.failedPaymentsLast30Days)}
              </p>
              <p className="text-xs text-gray-500 mt-2">قد تحتاج تدخّل (dunning)</p>
            </Card>
          </div>
        </>
      )}
    </AdminShell>
  )
}
