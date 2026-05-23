import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PlatformAdmin {
  id: string
  email: string
  fullName: string
  role: 'OWNER' | 'ADMIN'
}

interface AdminAuthState {
  admin: PlatformAdmin | null
  accessToken: string | null
  setAuth: (admin: PlatformAdmin, token: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
  isOwner: () => boolean
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      admin: null,
      accessToken: null,

      setAuth: (admin, accessToken) => set({ admin, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () => {
        set({ admin: null, accessToken: null })
        window.location.href = '/admin/login'
      },

      isOwner: () => get().admin?.role === 'OWNER',
    }),
    {
      name: 'hesba-admin-auth',
      partialize: (state) => ({ admin: state.admin, accessToken: state.accessToken }),
    },
  ),
)
