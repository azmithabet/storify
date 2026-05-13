import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()

  if (user) {
    return <Navigate to="/pos" replace />
  }

  return <>{children}</>
}
