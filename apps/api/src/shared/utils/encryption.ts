import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { config } from '../../config/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const key = config.APP_ENCRYPTION_KEY
  if (!key) throw new Error('APP_ENCRYPTION_KEY is not set')
  // Accept either raw 32-byte hex (64 chars) or base64
  if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) return Buffer.from(key, 'hex')
  return Buffer.from(key, 'base64').subarray(0, 32)
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(12):tag(16):ciphertext — all base64
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('invalid_ciphertext')
  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(data) + decipher.final('utf8')
}
