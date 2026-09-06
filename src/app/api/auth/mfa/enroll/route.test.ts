import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { generate } from 'otplib'
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/crypto'
import { resetDb, createRole, createPartner } from '@/test/db'
import { setSessionPending, clearSession, getSession } from '@/test/sessionMock'
import { GET, POST } from '@/app/api/auth/mfa/enroll/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

function postToken(token: string) {
  return POST(
    new NextRequest('http://localhost/api/auth/mfa/enroll', {
      method: 'POST',
      body: JSON.stringify({ token }),
      headers: { 'content-type': 'application/json' },
    })
  )
}

describe('POST /api/auth/mfa/enroll — TOTP encryption', () => {
  it('stores a newly enrolled secret v1:-prefixed, not as raw base32', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id })
    setSessionPending(partner.id)

    const enrollRes = await GET()
    expect(enrollRes.status).toBe(200)
    const { secret } = await enrollRes.json()

    const token = await generate({ secret })
    const verifyRes = await postToken(token)
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

    await GET()

    const res = await postToken('000000')
    expect(res.status).toBe(400)
  })

  it('returns 401 with no pending login session', async () => {
    expect((await GET()).status).toBe(401)
  })
})

describe('POST /api/auth/mfa/enroll — server-held pending secret', () => {
  it('ignores a body-supplied secret and enrolls the session secret instead', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id })
    setSessionPending(partner.id)

    const enrollRes = await GET()
    const { secret: sessionSecret } = await enrollRes.json()

    const attackerSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
    const tokenForAttackerSecret = await generate({ secret: attackerSecret })

    const res = await POST(
      new NextRequest('http://localhost/api/auth/mfa/enroll', {
        method: 'POST',
        body: JSON.stringify({ secret: attackerSecret, token: tokenForAttackerSecret }),
        headers: { 'content-type': 'application/json' },
      })
    )
    // The attacker-controlled secret does not match the session's secret,
    // so its token must not verify.
    expect(res.status).toBe(400)

    // Now prove the session secret is what actually gets stored on a
    // legitimate completion — even when a different secret rides along
    // in the body.
    const correctToken = await generate({ secret: sessionSecret })
    const res2 = await POST(
      new NextRequest('http://localhost/api/auth/mfa/enroll', {
        method: 'POST',
        body: JSON.stringify({ secret: attackerSecret, token: correctToken }),
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(res2.status).toBe(200)

    const updated = await prisma.brandPartner.findUniqueOrThrow({ where: { id: partner.id } })
    expect(decryptSecret(updated.totpSecretEnc!)).toBe(sessionSecret)
    expect(decryptSecret(updated.totpSecretEnc!)).not.toBe(attackerSecret)
  })

  it('returns 400 when POSTed with no pending secret in session', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id })
    // Simulate pendingPartnerId present but no GET (thus no pendingTotpSecret) —
    // e.g. directly setting session state the way a stale/tampered session might.
    setSessionPending(partner.id)

    const res = await postToken('123456')
    expect(res.status).toBe(400)
  })

  it('clears pendingTotpSecret from the session on successful enrollment', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id })
    setSessionPending(partner.id)

    const enrollRes = await GET()
    const { secret } = await enrollRes.json()
    const session = await getSession()
    expect(session.pendingTotpSecret).toBe(secret)

    const token = await generate({ secret })
    const res = await postToken(token)
    expect(res.status).toBe(200)

    const sessionAfter = await getSession()
    expect(sessionAfter.pendingTotpSecret).toBeUndefined()
  })
})
