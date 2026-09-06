import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { resetDb, createRole, createPartner } from '@/test/db'
import { setSessionPartner, clearSession } from '@/test/sessionMock'
import { PATCH } from '@/app/api/partners/[id]/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

function patch(id: string, data: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/partners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'content-type': 'application/json' },
    }),
    { params: { id } }
  )
}

describe('PATCH /api/partners/[id] — permission gate', () => {
  it('403 without managePartners, 200 with it', async () => {
    const noRole = await createRole({ permissions: { managePartners: false } })
    const noPartner = await createPartner({ roleId: noRole.id })
    const target = await createPartner({ roleId: noRole.id })
    setSessionPartner(noPartner.id)
    expect((await patch(target.id, { name: 'New Name' })).status).toBe(403)

    const yesRole = await createRole({ permissions: { managePartners: true } })
    const yesPartner = await createPartner({ roleId: yesRole.id })
    setSessionPartner(yesPartner.id)
    expect((await patch(target.id, { name: 'New Name' })).status).toBe(200)
  })
})

describe('PATCH /api/partners/[id] — secret leakage', () => {
  it('the response never includes passwordHash or totpSecretEnc', async () => {
    const role = await createRole({ permissions: { managePartners: true } })
    const me = await createPartner({ roleId: role.id, totpSecretEnc: 'v1:aa:bb:cc' })
    setSessionPartner(me.id)

    const res = await patch(me.id, { name: 'Renamed Self' })
    const text = await res.text()
    expect(text).not.toContain('passwordHash')
    expect(text).not.toContain('totpSecretEnc')
  })
})

describe('PATCH /api/partners/[id] — self-lockout guard', () => {
  it('409 when changing your own roleId', async () => {
    const role = await createRole({ permissions: { managePartners: true } })
    const otherRole = await createRole({ permissions: { managePartners: true } })
    const me = await createPartner({ roleId: role.id })
    setSessionPartner(me.id)

    const res = await patch(me.id, { roleId: otherRole.id })
    expect(res.status).toBe(409)
  })

  it('409 when deactivating your own account', async () => {
    const role = await createRole({ permissions: { managePartners: true } })
    const me = await createPartner({ roleId: role.id })
    setSessionPartner(me.id)

    const res = await patch(me.id, { isActive: false })
    expect(res.status).toBe(409)
  })

  it('changing your own name still succeeds', async () => {
    const role = await createRole({ permissions: { managePartners: true } })
    const me = await createPartner({ roleId: role.id })
    setSessionPartner(me.id)

    const res = await patch(me.id, { name: 'My New Name' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.partner.name).toBe('My New Name')
  })

  it('changing another partners isActive still succeeds', async () => {
    const role = await createRole({ permissions: { managePartners: true } })
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    setSessionPartner(me.id)

    const res = await patch(other.id, { isActive: false })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.partner.isActive).toBe(false)
  })
})
