import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resetDb, createRole, createPartner, createAssessment } from '@/test/db'
import { setSessionPartner, clearSession } from '@/test/sessionMock'
import { GET, POST } from '@/app/api/assessments/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

function req(url: string) {
  return new NextRequest(url)
}

describe('GET /api/assessments — row scoping', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GET(req('http://localhost/api/assessments'))
    expect(res.status).toBe(401)
  })

  it('a partner without viewAllAssessments sees only their own rows', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: false } })
    const me = await createPartner({ roleId: role.id, name: 'Me' })
    const other = await createPartner({ roleId: role.id, name: 'Other' })
    await createAssessment({ handledByPartnerId: me.id, name: 'MyClient' })
    await createAssessment({ handledByPartnerId: other.id, name: 'OtherClient' })

    setSessionPartner(me.id)
    const res = await GET(req('http://localhost/api/assessments'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.assessments).toHaveLength(1)
    expect(body.assessments[0].name).toBe('MyClient')
  })

  it('a partner with viewAllAssessments sees both partners rows', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id, name: 'Me' })
    const other = await createPartner({ roleId: role.id, name: 'Other' })
    await createAssessment({ handledByPartnerId: me.id, name: 'MyClient' })
    await createAssessment({ handledByPartnerId: other.id, name: 'OtherClient' })

    setSessionPartner(me.id)
    const res = await GET(req('http://localhost/api/assessments'))
    const body = await res.json()

    expect(res.status).toBe(200)
    const names = body.assessments.map((a: { name: string }) => a.name).sort()
    expect(names).toEqual(['MyClient', 'OtherClient'])
  })

  it('the bypass attempt: ?partnerId=<other> is ignored for a partner without the permission', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: false } })
    const me = await createPartner({ roleId: role.id, name: 'Me' })
    const other = await createPartner({ roleId: role.id, name: 'Other' })
    await createAssessment({ handledByPartnerId: me.id, name: 'MyClient' })
    await createAssessment({ handledByPartnerId: other.id, name: 'OtherClient' })

    setSessionPartner(me.id)
    const res = await GET(req(`http://localhost/api/assessments?partnerId=${other.id}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.assessments).toHaveLength(1)
    expect(body.assessments[0].name).toBe('MyClient')
  })

  it('deactivating a partner ends their live session immediately (the shipped Critical)', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id })
    setSessionPartner(me.id)

    // Sanity: the session works before deactivation.
    expect((await GET(req('http://localhost/api/assessments'))).status).toBe(200)

    await prisma.brandPartner.update({ where: { id: me.id }, data: { isActive: false } })

    const res = await GET(req('http://localhost/api/assessments'))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/assessments', () => {
  it('attribution forgery: stores the record against the session partner, not the body partnerId', async () => {
    const role = await createRole()
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    setSessionPartner(me.id)

    const res = await POST(
      new NextRequest('http://localhost/api/assessments', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-01-01',
          name: 'Client X',
          contactNumber: '5551234',
          handledByPartnerId: other.id,
        }),
        headers: { 'content-type': 'application/json' },
      })
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.assessment.handledByPartnerId).toBe(me.id)

    const stored = await prisma.assessment.findUniqueOrThrow({ where: { id: body.assessment.id } })
    expect(stored.handledByPartnerId).toBe(me.id)
  })

  it('rejects a malformed date with 400, not 500', async () => {
    const role = await createRole()
    const me = await createPartner({ roleId: role.id })
    setSessionPartner(me.id)

    const res = await POST(
      new NextRequest('http://localhost/api/assessments', {
        method: 'POST',
        body: JSON.stringify({ date: 'tomorrow', name: 'Client X', contactNumber: '5551234' }),
        headers: { 'content-type': 'application/json' },
      })
    )

    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/assessments', {
        method: 'POST',
        body: JSON.stringify({ date: '2026-01-01', name: 'X', contactNumber: '123' }),
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(res.status).toBe(401)
  })
})
