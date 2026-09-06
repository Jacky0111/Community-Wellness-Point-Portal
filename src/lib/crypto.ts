import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const VERSION_PREFIX = 'v1'
const IV_LENGTH_BYTES = 12

if (!process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set')
}

if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
  throw new Error('ENCRYPTION_KEY environment variable must be exactly 64 hex characters (32 bytes)')
}

const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')

/**
 * True if `stored` is a value produced by encryptSecret (self-describing
 * `v1:<iv>:<tag>:<ciphertext>` format), false if it's a legacy plaintext
 * secret that predates encryption at rest.
 */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(`${VERSION_PREFIX}:`)
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [VERSION_PREFIX, iv.toString('hex'), tag.toString('hex'), ciphertext.toString('hex')].join(':')
}

/**
 * Decrypts a value produced by encryptSecret. For backward compatibility
 * with production accounts enrolled before encryption at rest existed,
 * a value that isn't in the `v1:` format is treated as legacy plaintext
 * and returned as-is.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) {
    return stored
  }

  const parts = stored.split(':')
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted secret')
  }

  const [, ivHex, tagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
