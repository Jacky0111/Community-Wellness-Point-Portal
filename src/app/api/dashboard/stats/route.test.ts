import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { prisma } from '@/lib/prisma'
import { resetDb, createRole, createPartner, createAssessment } from '@/test/db'
import { setSessionPartner, clearSession } from '@/test/sessionMock'
import { GET } from '@/app/api/dashboard/stats/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

describe('GET /api/dashboard/stats — row scoping', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('a partner without viewAllAssessments only sees their own rows in counts and recent', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: false } })
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    await createAssessment({ handledByPartnerId: me.id, name: 'Mine' })
    await createAssessment({ handledByPartnerId: other.id, name: 'Theirs' })

    setSessionPartner(me.id)
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.counts.total).toBe(1)
    expect(body.recent).toHaveLength(1)
    expect(body.recent[0].name).toBe('Mine')
  })

  it('a partner with viewAllAssessments sees both partners rows', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    await createAssessment({ handledByPartnerId: me.id, name: 'Mine' })
    await createAssessment({ handledByPartnerId: other.id, name: 'Theirs' })

    setSessionPartner(me.id)
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.counts.total).toBe(2)
    expect(body.recent).toHaveLength(2)
  })

  it('excludes soft-deleted rows from counts and recent', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id })
    await createAssessment({ handledByPartnerId: me.id, name: 'Visible' })
    const deleted = await createAssessment({ handledByPartnerId: me.id, name: 'Deleted' })
    await prisma.assessment.update({
      where: { id: deleted.id },
      data: { deletedAt: new Date(), deletedByPartnerId: me.id },
    })

    setSessionPartner(me.id)
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.counts.total).toBe(1)
    expect(body.recent).toHaveLength(1)
    expect(body.recent[0].name).toBe('Visible')
  })
})
