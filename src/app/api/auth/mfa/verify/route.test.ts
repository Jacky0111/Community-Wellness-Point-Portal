import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { generate, generateSecret } from 'otplib'
import { prisma } from '@/lib/prisma'
import { encryptSecret } from '@/lib/crypto'
import { resetDb, createRole, createPartner } from '@/test/db'
import { setSessionPending, clearSession } from '@/test/sessionMock'
import { POST } from '@/app/api/auth/mfa/verify/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

function verify(token: string) {
  return POST(
    new NextRequest('http://localhost/api/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
      headers: { 'content-type': 'application/json' },
    })
  )
}

describe('POST /api/auth/mfa/verify — TOTP encryption', () => {
  it('a legacy plaintext secret still verifies successfully and is lazily re-encrypted afterward', async () => {
    const role = await createRole()
    const secret = generateSecret()
    // Simulate a pre-encryption-at-rest account: raw base32 secret stored directly.
    const partner = await createPartner({ roleId: role.id, totpSecretEnc: secret, totpEnabledAt: new Date() })
    setSessionPending(partner.id)

    const token = await generate({ secret })
    const res = await verify(token)
    expect(res.status).toBe(200)

    const updated = await prisma.brandPartner.findUniqueOrThrow({ where: { id: partner.id } })
    expect(updated.totpSecretEnc).not.toBe(secret)
    expect(updated.totpSecretEnc!.startsWith('v1:')).toBe(true)
  })

  it('an already-encrypted secret verifies successfully', async () => {
    const role = await createRole()
    const secret = generateSecret()
    const partner = await createPartner({
      roleId: role.id,
      totpSecretEnc: encryptSecret(secret),
      totpEnabledAt: new Date(),
    })
    setSessionPending(partner.id)

    const token = await generate({ secret })
    const res = await verify(token)
    expect(res.status).toBe(200)
  })
})

describe('rate limiting on /api/auth/mfa/verify', () => {
  it('5 failed attempts lock the account, and the 6th attempt returns 429', async () => {
    const role = await createRole()
    const secret = generateSecret()
    const partner = await createPartner({
      roleId: role.id,
      totpSecretEnc: encryptSecret(secret),
      totpEnabledAt: new Date(),
    })
    setSessionPending(partner.id)

    for (let i = 0; i < 5; i++) {
      const res = await verify('000000')
      expect(res.status).toBe(400)
    }

    const sixth = await verify('000000')
    expect(sixth.status).toBe(429)
  })

  it('a locked account cannot promote its session even with a correct code', async () => {
    const role = await createRole()
    const secret = generateSecret()
    const partner = await createPartner({
      roleId: role.id,
      totpSecretEnc: encryptSecret(secret),
      totpEnabledAt: new Date(),
    })
    setSessionPending(partner.id)

    for (let i = 0; i < 5; i++) {
      await verify('000000')
    }

    const token = await generate({ secret })
    const res = await verify(token)
    expect(res.status).toBe(429)
  })

  it('returns 401 with no pending login session', async () => {
    expect((await verify('000000')).status).toBe(401)
  })
})
