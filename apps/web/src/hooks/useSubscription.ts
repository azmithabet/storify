import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'SUSPENDED'

export interface SubscriptionStatusData {
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  planName: string
  billingCycle: 'MONTHLY' | 'YEARLY'
}

export function useSubscriptionStatus() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: async () => {
      const res = await api.get<{ subscription: SubscriptionStatusData | null }>(
        '/billing/status',
      )
      return res.data.subscription
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  })
}
