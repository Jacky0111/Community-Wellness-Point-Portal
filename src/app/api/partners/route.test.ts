import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { resetDb, createRole, createPartner } from '@/test/db'
import { setSessionPartner, clearSession } from '@/test/sessionMock'
import { GET, POST } from '@/app/api/partners/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

describe('permission gates on /api/partners', () => {
  it('GET: 403 without managePartners, 200 with it', async () => {
    const noRole = await createRole({ permissions: { managePartners: false } })
    const noPartner = await createPartner({ roleId: noRole.id })
    setSessionPartner(noPartner.id)
    expect((await GET()).status).toBe(403)

    const yesRole = await createRole({ permissions: { managePartners: true } })
    const yesPartner = await createPartner({ roleId: yesRole.id })
    setSessionPartner(yesPartner.id)
    expect((await GET()).status).toBe(200)
  })

  it('POST: 403 without managePartners, 201 with it', async () => {
    const noRole = await createRole({ permissions: { managePartners: false } })
    const noPartner = await createPartner({ roleId: noRole.id })
    setSessionPartner(noPartner.id)
    const forbidden = await POST(
      new NextRequest('http://localhost/api/partners', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Guy', email: 'newguy@example.com', roleId: noRole.id }),
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(forbidden.status).toBe(403)

    const yesRole = await createRole({ permissions: { managePartners: true } })
    const yesPartner = await createPartner({ roleId: yesRole.id })
    setSessionPartner(yesPartner.id)
    const allowed = await POST(
      new NextRequest('http://localhost/api/partners', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Guy', email: 'newguy2@example.com', roleId: yesRole.id }),
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(allowed.status).toBe(201)
  })
})

describe('secret leakage on /api/partners', () => {
  it('GET response body never includes passwordHash or totpSecretEnc', async () => {
    const role = await createRole({ permissions: { managePartners: true } })
    const partner = await createPartner({ roleId: role.id, totpSecretEnc: 'v1:aa:bb:cc' })
    setSessionPartner(partner.id)

    const res = await GET()
    const text = await res.text()
    expect(text).not.toContain('passwordHash')
    expect(text).not.toContain('totpSecretEnc')

    const body = JSON.parse(text)
    for (const p of body.partners) {
      expect(p).not.toHaveProperty('passwordHash')
      expect(p).not.toHaveProperty('totpSecretEnc')
    }
  })

  it('the invite POST response never includes passwordHash or totpSecretEnc', async () => {
    const role = await createRole({ permissions: { managePartners: true } })
    const partner = await createPartner({ roleId: role.id })
    setSessionPartner(partner.id)

    const res = await POST(
      new NextRequest('http://localhost/api/partners', {
        method: 'POST',
        body: JSON.stringify({ name: 'Invitee', email: 'invitee@example.com', roleId: role.id }),
        headers: { 'content-type': 'application/json' },
      })
    )
    const text = await res.text()
    expect(text).not.toContain('passwordHash')
    expect(text).not.toContain('totpSecretEnc')

    const body = JSON.parse(text)
    expect(body.partner).not.toHaveProperty('passwordHash')
    expect(body.partner).not.toHaveProperty('totpSecretEnc')
    // The plaintext temporary password IS expected in this one response
    // (it's how the invite flow hands it to the admin) — just not the hash.
    expect(body.temporaryPassword).toBeTruthy()
  })
})
