import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resetDb, createRole, createPartner } from '@/test/db'
import { setSessionPartner, clearSession } from '@/test/sessionMock'
import { PATCH, DELETE } from '@/app/api/roles/[id]/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

function patch(id: string, data: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'content-type': 'application/json' },
    }),
    { params: { id } }
  )
}

function del(id: string) {
  return DELETE(new Request(`http://localhost/api/roles/${id}`), { params: { id } })
}

describe('permission gates on /api/roles/[id]', () => {
  it('PATCH: 403 without manageRoles, 200 with it', async () => {
    const noRole = await createRole({ permissions: { manageRoles: false } })
    const noPartner = await createPartner({ roleId: noRole.id })
    const target = await createRole()
    setSessionPartner(noPartner.id)
    expect((await patch(target.id, { name: 'Renamed', permissions: {} })).status).toBe(403)

    const yesRole = await createRole({ permissions: { manageRoles: true } })
    const yesPartner = await createPartner({ roleId: yesRole.id })
    setSessionPartner(yesPartner.id)
    expect((await patch(target.id, { name: 'Renamed', permissions: {} })).status).toBe(200)
  })

  it('DELETE: 403 without manageRoles, 200 with it', async () => {
    const noRole = await createRole({ permissions: { manageRoles: false } })
    const noPartner = await createPartner({ roleId: noRole.id })
    const target = await createRole()
    setSessionPartner(noPartner.id)
    expect((await del(target.id)).status).toBe(403)

    const yesRole = await createRole({ permissions: { manageRoles: true } })
    const yesPartner = await createPartner({ roleId: yesRole.id })
    setSessionPartner(yesPartner.id)
    expect((await del(target.id)).status).toBe(200)
  })
})

describe('system-default role protection', () => {
  it('PATCH returns 409 and leaves the role untouched', async () => {
    const manageRole = await createRole({ permissions: { manageRoles: true } })
    const admin = await createPartner({ roleId: manageRole.id })
    const systemRole = await createRole({ isSystemDefault: true, name: 'Owner' })
    setSessionPartner(admin.id)

    const res = await patch(systemRole.id, { name: 'Hacked Name', permissions: {} })
    expect(res.status).toBe(409)

    const stillThere = await prisma.role.findUnique({ where: { id: systemRole.id } })
    expect(stillThere).not.toBeNull()
    expect(stillThere!.name).toBe('Owner')
  })

  it('DELETE returns 409 and the role still exists afterward', async () => {
    const manageRole = await createRole({ permissions: { manageRoles: true } })
    const admin = await createPartner({ roleId: manageRole.id })
    const systemRole = await createRole({ isSystemDefault: true, name: 'Owner' })
    setSessionPartner(admin.id)

    const res = await del(systemRole.id)
    expect(res.status).toBe(409)

    const stillThere = await prisma.role.findUnique({ where: { id: systemRole.id } })
    expect(stillThere).not.toBeNull()
  })
})
