import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../encryption'

describe('encryption (AES-256-GCM)', () => {
  it('round-trips a plaintext string', () => {
    const plain = 'my-eta-client-secret-9k3l2'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plain = 'duplicate-input'
    const a = encrypt(plain)
    const b = encrypt(plain)
    expect(a).not.toBe(b)
  })

  it('rejects ciphertext that is missing parts', () => {
    expect(() => decrypt('not-a-real-ciphertext')).toThrow(/invalid_ciphertext/)
  })

  it('rejects ciphertext with a tampered auth tag (GCM integrity)', () => {
    const ct = encrypt('secret')
    const [iv, , data] = ct.split(':')
    // Replace the tag with a different but well-formed base64 string.
    const bogusTag = Buffer.from('0'.repeat(16)).toString('base64')
    const tampered = [iv, bogusTag, data].join(':')
    expect(() => decrypt(tampered)).toThrow()
  })

  it('rejects ciphertext with tampered data', () => {
    const ct = encrypt('secret')
    const [iv, tag, data] = ct.split(':')
    // Flip one byte of the encrypted data.
    const buf = Buffer.from(data, 'base64')
    buf[0] = buf[0] ^ 0xff
    const tampered = [iv, tag, buf.toString('base64')].join(':')
    expect(() => decrypt(tampered)).toThrow()
  })

  it('handles empty string', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('handles unicode / Arabic plaintext', () => {
    const plain = 'بيانات سرية — Egyptian Tax Authority'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })
})
