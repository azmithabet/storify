import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/auth.store'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Attach access token + tenant subdomain to every request
api.interceptors.request.use((config) => {
  const { accessToken, tenantSubdomain } = useAuthStore.getState()
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  if (tenantSubdomain) config.headers['X-Tenant-Subdomain'] = tenantSubdomain
  return config
})

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }
    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`
          resolve(api(original))
        })
      })
    }
    original._retry = true
    isRefreshing = true
    try {
      const subdomain = useAuthStore.getState().tenantSubdomain
      const { data } = await axios.post<{ success: boolean; data: { accessToken: string } }>(
        '/api/auth/refresh',
        {},
        { withCredentials: true, headers: subdomain ? { 'X-Tenant-Subdomain': subdomain } : {} },
      )
      const newToken = data.data.accessToken
      useAuthStore.getState().setAccessToken(newToken)
      refreshQueue.forEach((cb) => cb(newToken))
      refreshQueue = []
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch (refreshErr) {
      // Refresh failed — drain the queue with a rejection so pending requests
      // resolve instead of hanging forever, and surface a toast so the user
      // understands why the next click bounces them to /login.
      refreshQueue.forEach(() => {})
      refreshQueue = []
      const state = useAuthStore.getState()
      if (state.accessToken || state.user) {
        toast.error('انتهت الجلسة، يرجى تسجيل الدخول مجدداً')
      }
      state.logout()
      return Promise.reject(refreshErr ?? err)
    } finally {
      isRefreshing = false
    }
  },
)
