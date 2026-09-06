import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { generate } from 'otplib'
import { prisma } from '@/lib/prisma'
import { resetDb, createRole, createPartner } from '@/test/db'
import { setSessionPending, clearSession } from '@/test/sessionMock'
import { GET, POST } from '@/app/api/auth/mfa/enroll/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

describe('POST /api/auth/mfa/enroll — TOTP encryption', () => {
  it('stores a newly enrolled secret v1:-prefixed, not as raw base32', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id })
    setSessionPending(partner.id)

    const enrollRes = await GET()
    expect(enrollRes.status).toBe(200)
    const { secret } = await enrollRes.json()

    const token = await generate({ secret })
    const verifyRes = await POST(
      new NextRequest('http://localhost/api/auth/mfa/enroll', {
        method: 'POST',
        body: JSON.stringify({ secret, token }),
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(verifyRes.status).toBe(200)

    const updated = await prisma.brandPartner.findUniqueOrThrow({ where: { id: partner.id } })
    expect(updated.totpSecretEnc).not.toBeNull()
    expect(updated.totpSecretEnc).not.toBe(secret)
    expect(updated.totpSecretEnc!.startsWith('v1:')).toBe(true)
    expect(updated.totpEnabledAt).not.toBeNull()
  })

  it('rejects an invalid code with 400', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id })
    setSessionPending(partner.id)

    const enrollRes = await GET()
    const { secret } = await enrollRes.json()

    const res = await POST(
      new NextRequest('http://localhost/api/auth/mfa/enroll', {
        method: 'POST',
        body: JSON.stringify({ secret, token: '000000' }),
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 401 with no pending login session', async () => {
    expect((await GET()).status).toBe(401)
  })
})
