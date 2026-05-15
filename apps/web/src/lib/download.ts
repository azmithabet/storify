import { api } from '@/api/client'

/**
 * Trigger a browser download for a Blob. Cleans up the object URL afterward.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * GET a binary endpoint and download the response as a file.
 * The MIME type is preserved from the response when possible.
 */
export async function downloadFromApi(
  path: string,
  filename: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const cleanParams: Record<string, string> = {}
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') cleanParams[k] = String(v)
    }
  }
  const res = await api.get(path, { params: cleanParams, responseType: 'blob' })
  const contentType =
    (res.headers as Record<string, string>)['content-type'] ?? 'application/octet-stream'
  downloadBlob(new Blob([res.data as BlobPart], { type: contentType }), filename)
}
