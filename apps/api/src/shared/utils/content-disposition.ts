/**
 * Build an RFC 5987-compliant Content-Disposition value that survives
 * non-ASCII (e.g. Arabic) characters.
 *
 * HTTP headers must be ISO-8859-1, so a raw Arabic filename triggers
 * `ERR_INVALID_CHAR` at the Node response writer. RFC 5987 lets us send a
 * UTF-8 percent-encoded filename via `filename*=`, with an ASCII fallback in
 * `filename=` for legacy clients.
 *
 * Usage: `reply.header('Content-Disposition', contentDispositionAttachment('كشف_حساب_العميل.xlsx'))`
 */
export function contentDispositionAttachment(filename: string): string {
  // ASCII fallback — strip everything outside printable ASCII, collapse
  // whitespace and quotes that would break the simple `filename="..."` form.
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download'
  const utf8 = encodeURIComponent(filename)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`
}
