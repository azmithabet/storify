import axios from 'axios'
import { useAdminAuthStore } from '@/stores/admin-auth.store'

// Separate axios instance for the platform-admin panel:
//  - Hits /api/admin/* (mounted outside the tenant-scoped block on the server)
//  - Does NOT send X-Tenant-Subdomain (admin panel is cross-tenant)
//  - Uses its own refresh cookie (platformRefreshToken)
export const adminApi = axios.create({
  baseURL: '/api/admin',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

adminApi.interceptors.request.use((config) => {
  const { accessToken } = useAdminAuthStore.getState()
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

adminApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status !== 401 || original._retry) return Promise.reject(err)

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`
          resolve(adminApi(original))
        })
      })
    }
    original._retry = true
    isRefreshing = true
    try {
      const { data } = await axios.post<{ success: boolean; data: { accessToken: string } }>(
        '/api/admin/refresh',
        {},
        { withCredentials: true },
      )
      const newToken = data.data.accessToken
      useAdminAuthStore.getState().setAccessToken(newToken)
      refreshQueue.forEach((cb) => cb(newToken))
      refreshQueue = []
      original.headers.Authorization = `Bearer ${newToken}`
      return adminApi(original)
    } catch {
      useAdminAuthStore.getState().logout()
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)
