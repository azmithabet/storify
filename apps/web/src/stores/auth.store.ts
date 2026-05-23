import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  fullName: string
  email: string
  roleSlug: string
  branchId?: string
  permissions?: Record<string, string[]>
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  tenantSubdomain: string | null
  setAuth: (user: AuthUser, token: string, subdomain: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
  hasPermission: (resource: string, action: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      tenantSubdomain: null,

      setAuth: (user, accessToken, tenantSubdomain) =>
        set({ user, accessToken, tenantSubdomain }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () => {
        set({ user: null, accessToken: null, tenantSubdomain: null })
        window.location.href = '/login'
      },

      hasPermission: (resource, action) => {
        const { user } = get()
        if (!user) return false
        if (user.roleSlug === 'super_admin') return true
        return user.permissions?.[resource]?.includes(action) ?? false
      },
    }),
    {
      name: 'hesba-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        tenantSubdomain: state.tenantSubdomain,
      }),
    },
  ),
)
