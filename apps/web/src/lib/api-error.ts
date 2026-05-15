import { AxiosError } from 'axios'

/**
 * Backend error envelope. Most endpoints return:
 *   { success: false, error: { code, message } }
 * A handful of older endpoints (auth, some POS paths) return a flat:
 *   { message }
 * We try both shapes so callers don't have to care.
 */
interface BackendErrorBody {
  success?: false
  error?: { code?: string; message?: string }
  message?: string
}

/**
 * Extract a user-facing message from an unknown error.
 *
 * Order of preference:
 *  1. Backend Arabic message (`response.data.error.message`)
 *  2. Flat `response.data.message` (legacy shape)
 *  3. Axios network error → generic "connection failed"
 *  4. The error's own `message`
 *  5. Caller-provided fallback (defaults to a generic Arabic message)
 */
export function getApiErrorMessage(err: unknown, fallback = 'حدث خطأ، حاول مرة أخرى'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as BackendErrorBody | undefined
    if (data?.error?.message) return data.error.message
    if (data?.message) return data.message
    if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
      return 'تعذر الاتصال بالخادم، تحقق من الإنترنت'
    }
  }
  if (err instanceof Error && err.message && !err.message.startsWith('Request failed')) {
    return err.message
  }
  return fallback
}

/**
 * Extract the backend error code (e.g. `insufficient_credit`, `not_found`)
 * so callers can branch on it before falling back to a generic toast.
 */
export function getApiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const data = err.response?.data as BackendErrorBody | undefined
    return data?.error?.code
  }
  return undefined
}
