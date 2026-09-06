import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { resetDb, createRole, createPartner } from '@/test/db'
import { setSessionPartner, clearSession } from '@/test/sessionMock'
import { GET, POST } from '@/app/api/roles/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

describe('permission gates on /api/roles', () => {
  it('GET: 403 without manageRoles, 200 with it', async () => {
    const noRole = await createRole({ permissions: { manageRoles: false } })
    const noPartner = await createPartner({ roleId: noRole.id })
    setSessionPartner(noPartner.id)
    expect((await GET()).status).toBe(403)

    const yesRole = await createRole({ permissions: { manageRoles: true } })
    const yesPartner = await createPartner({ roleId: yesRole.id })
    setSessionPartner(yesPartner.id)
    expect((await GET()).status).toBe(200)
  })

  it('POST: 403 without manageRoles, 201 with it', async () => {
    const noRole = await createRole({ permissions: { manageRoles: false } })
    const noPartner = await createPartner({ roleId: noRole.id })
    setSessionPartner(noPartner.id)
    const forbidden = await POST(
      new NextRequest('http://localhost/api/roles', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Role', permissions: {} }),
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(forbidden.status).toBe(403)

    const yesRole = await createRole({ permissions: { manageRoles: true } })
    const yesPartner = await createPartner({ roleId: yesRole.id })
    setSessionPartner(yesPartner.id)
    const allowed = await POST(
      new NextRequest('http://localhost/api/roles', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Role 2', permissions: { exportData: true } }),
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(allowed.status).toBe(201)
  })

  it('returns 403 when not authenticated', async () => {
    expect((await GET()).status).toBe(403)
  })
})
