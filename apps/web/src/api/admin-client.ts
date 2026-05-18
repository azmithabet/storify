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

function isAccessTokenExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const [, payloadB64] = token.split('.')
    if (!payloadB64) return true
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const exp = JSON.parse(json).exp
    if (typeof exp !== 'number') return true
    return Date.now() + 30_000 >= exp * 1000
  } catch {
    return true
  }
}

let prefetchPromise: Promise<void> | null = null

async function ensureFreshAdminAccessToken(): Promise<void> {
  const { admin, accessToken } = useAdminAuthStore.getState()
  if (!admin) return
  if (!isAccessTokenExpired(accessToken)) return
  if (prefetchPromise) return prefetchPromise

  prefetchPromise = (async () => {
    try {
      const { data } = await axios.post<{ success: boolean; data: { accessToken: string } }>(
        '/api/admin/refresh',
        {},
        { withCredentials: true },
      )
      useAdminAuthStore.getState().setAccessToken(data.data.accessToken)
    } catch {
      // Let the response interceptor handle the surface (logout) when the next
      // request still 401s.
    } finally {
      prefetchPromise = null
    }
  })()
  return prefetchPromise
}

adminApi.interceptors.request.use(async (config) => {
  await ensureFreshAdminAccessToken()
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
