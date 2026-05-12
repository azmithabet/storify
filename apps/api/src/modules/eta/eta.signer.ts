import crypto from 'crypto'

/**
 * Signs an ETA document using CAdES-BES detached signature.
 *
 * Production: requires USB token or HSM with the merchant's signing certificate.
 * The private key never leaves the hardware token.
 *
 * In dev/test mode: generates a self-signed placeholder for integration testing.
 * The ETA preprod validator will reject self-signed certs — you must use a real
 * ETA-approved certificate before production go-live.
 *
 * Integration with node-pkcs11 (hardware token):
 *   const pkcs11 = new PKCS11()
 *   pkcs11.load('/path/to/token/driver.so')
 *   const slot = pkcs11.C_GetSlotList(true)[0]
 *   const session = pkcs11.C_OpenSession(slot, ...)
 *   pkcs11.C_Login(session, CKU_USER, pin)
 *   // use PKCS#1 RSA-SHA256 or CMS to sign
 */
export function serializeCanonical(document: object): string {
  return JSON.stringify(document, (_key, val) => {
    if (Array.isArray(val)) return val
    if (val !== null && typeof val === 'object') {
      return Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
    }
    return val
  })
}

export function hashDocument(serialized: string): string {
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex').toUpperCase()
}

export interface SigningResult {
  signatureValue: string
  signingTime: string
  certificateSerialNumber?: string
}

/**
 * Signs using a PEM private key (dev only).
 * In production, replace with HSM/PKCS11 signing.
 */
export function signWithPem(
  serialized: string,
  privateKeyPem: string,
): SigningResult {
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(serialized, 'utf8')
  const signatureValue = sign.sign(privateKeyPem, 'base64')
  return {
    signatureValue,
    signingTime: new Date().toISOString(),
  }
}

export function buildSignatureBlock(result: SigningResult): object {
  return {
    signatureType: 'I',
    value: result.signatureValue,
  }
}
