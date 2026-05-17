import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'

export interface PlanFeatures {
  installments?: boolean
  multi_currency?: boolean
  suppliers?: boolean
  expenses?: boolean
  advanced_reports?: boolean
  offline_mode?: boolean
  api_access?: boolean
  max_branches?: number
  max_users?: number
  [key: string]: unknown
}

export interface PlanLimits {
  maxProducts: number
  maxOrders: number
  maxUsers: number
  maxStorage: number
  maxInstallmentPlansMonthly: number
}

export interface MeResponse {
  user: {
    id: string
    fullName: string
    email: string
    roleSlug: string
    branchId: string
    permissions: Record<string, string[]>
  }
  tenant: {
    id: string
    name: string
    subdomain: string
    plan: {
      id: string
      name: string
      slug: string
      features: PlanFeatures
      limits: PlanLimits
    }
  }
}

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get<{ success: true; data: MeResponse }>('/auth/me')
      return res.data.data
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  })
}

export function useFeature(feature: keyof PlanFeatures): boolean {
  const { data } = useMe()
  const val = data?.tenant.plan.features?.[feature]
  return typeof val === 'boolean' ? val : Boolean(val)
}

export interface UsageItem {
  used: number
  limit: number
}

export interface UsageResponse {
  users: UsageItem
  products: UsageItem
  invoices: UsageItem
  installmentPlansThisMonth: UsageItem
}

export function useUsage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const res = await api.get<{ success: true; data: UsageResponse }>('/auth/me/usage')
      return res.data.data
    },
    enabled: !!accessToken,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
