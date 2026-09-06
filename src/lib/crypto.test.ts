import { describe, expect, it } from 'vitest'
import { encryptSecret, decryptSecret, isEncrypted } from './crypto'

describe('crypto secret encryption', () => {
  it('round-trips a plaintext secret through encrypt/decrypt', () => {
    const secret = 'CDAR7A7U23TVEF2TYEVK4VAYXBEUO34V'
    const enc = encryptSecret(secret)
    expect(enc.startsWith('v1:')).toBe(true)
    expect(decryptSecret(enc)).toBe(secret)
  })

  it('passes a legacy plaintext value through unchanged', () => {
    const legacy = 'CDAR7A7U23TVEF2TYEVK4VAYXBEUO34V'
    expect(decryptSecret(legacy)).toBe(legacy)
  })

  it('reports encrypted vs legacy plaintext correctly', () => {
    const legacy = 'CDAR7A7U23TVEF2TYEVK4VAYXBEUO34V'
    const enc = encryptSecret(legacy)
    expect(isEncrypted(enc)).toBe(true)
    expect(isEncrypted(legacy)).toBe(false)
  })

  it('produces different ciphertexts for the same input (random IV)', () => {
    const secret = 'CDAR7A7U23TVEF2TYEVK4VAYXBEUO34V'
    const encA = encryptSecret(secret)
    const encB = encryptSecret(secret)
    expect(encA).not.toBe(encB)
    expect(decryptSecret(encA)).toBe(secret)
    expect(decryptSecret(encB)).toBe(secret)
  })

  it('throws rather than returning garbage when ciphertext is tampered with', () => {
    const secret = 'CDAR7A7U23TVEF2TYEVK4VAYXBEUO34V'
    const enc = encryptSecret(secret)
    const parts = enc.split(':')
    // flip a hex character in the ciphertext portion
    const tamperedCiphertext = parts[3].slice(0, -1) + (parts[3].slice(-1) === '0' ? '1' : '0')
    const tampered = [parts[0], parts[1], parts[2], tamperedCiphertext].join(':')
    expect(() => decryptSecret(tampered)).toThrow()
  })
})
