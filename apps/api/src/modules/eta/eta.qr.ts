export function buildEtaQrData(params: {
  etaLongId: string
  taxpayerId: string
  invoiceNumber: string
  issuedAt: Date
  totalAmount: number
  isProd?: boolean
}): string {
  const { etaLongId, isProd } = params
  const baseUrl = isProd
    ? 'https://eta.gov.eg/taxmobile/Index'
    : 'https://preprod.eta.gov.eg/taxmobile/Index'
  return `${baseUrl}?documentId=${etaLongId}`
}

/**
 * Generates a QR PNG buffer.
 * Install `qrcode` (pnpm add qrcode @types/qrcode) to enable.
 * Returns null in environments where the package is not available.
 */
export async function generateQrPng(data: string): Promise<Buffer | null> {
  try {
    // Dynamic import to avoid compile-time failure when qrcode is not installed
    const mod = await eval('import("qrcode")') as { default?: { toBuffer: (d: string, o: object) => Promise<Buffer> }; toBuffer?: (d: string, o: object) => Promise<Buffer> }
    const toBuffer = mod.default?.toBuffer ?? mod.toBuffer
    if (!toBuffer) return null
    return await toBuffer(data, { type: 'png', width: 200 })
  } catch {
    return null
  }
}
