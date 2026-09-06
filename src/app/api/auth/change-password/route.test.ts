import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { resetDb, createRole, createPartner } from '@/test/db'
import { setSessionPartner, setSessionPending, clearSession } from '@/test/sessionMock'
import { POST } from '@/app/api/auth/change-password/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

function changePassword(newPassword: string) {
  return POST(
    new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
      headers: { 'content-type': 'application/json' },
    })
  )
}

describe('POST /api/auth/change-password — validation', () => {
  it('a 1-character password returns 400', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id, mustChangePassword: true })
    setSessionPending(partner.id)

    const res = await changePassword('x')
    expect(res.status).toBe(400)
  })

  it('a valid password succeeds for a pending (mid-login) session', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id, mustChangePassword: true })
    setSessionPending(partner.id)

    const res = await changePassword('a-valid-new-password')
    expect(res.status).toBe(200)
  })

  it('a valid password succeeds for a fully-authenticated session too', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id, mustChangePassword: false })
    setSessionPartner(partner.id)

    const res = await changePassword('a-valid-new-password')
    expect(res.status).toBe(200)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await changePassword('a-valid-new-password')
    expect(res.status).toBe(401)
  })
})
