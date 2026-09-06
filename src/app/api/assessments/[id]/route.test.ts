import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { prisma } from '@/lib/prisma'
import { resetDb, createRole, createPartner, createAssessment } from '@/test/db'
import { setSessionPartner, clearSession } from '@/test/sessionMock'
import { GET, DELETE } from '@/app/api/assessments/[id]/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

function call(id: string) {
  return GET(new Request(`http://localhost/api/assessments/${id}`), { params: { id } })
}

function del(id: string) {
  return DELETE(new Request(`http://localhost/api/assessments/${id}`, { method: 'DELETE' }), {
    params: { id },
  })
}

describe('GET /api/assessments/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await call('nonexistent')
    expect(res.status).toBe(401)
  })

  it('a partner without viewAllAssessments can read their own record', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: false } })
    const me = await createPartner({ roleId: role.id })
    const assessment = await createAssessment({ handledByPartnerId: me.id, name: 'Mine' })
    setSessionPartner(me.id)

    const res = await call(assessment.id)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assessment.name).toBe('Mine')
  })

  it('a partner with viewAllAssessments can read another partners record', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    const assessment = await createAssessment({ handledByPartnerId: other.id, name: 'Theirs' })
    setSessionPartner(me.id)

    const res = await call(assessment.id)
    expect(res.status).toBe(200)
  })

  it('404-not-403: another partners record and a genuinely missing id return byte-identical bodies', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: false } })
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    const assessment = await createAssessment({ handledByPartnerId: other.id, name: 'Theirs' })
    setSessionPartner(me.id)

    const crossPartnerRes = await call(assessment.id)
    const missingRes = await call('definitely-does-not-exist')

    expect(crossPartnerRes.status).toBe(404)
    expect(missingRes.status).toBe(404)
    expect(await crossPartnerRes.text()).toBe(await missingRes.text())
  })

  it('a soft-deleted record returns 404, byte-identical to a non-existent id', async () => {
    const role = await createRole({ permissions: { viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id })
    const assessment = await createAssessment({ handledByPartnerId: me.id, name: 'Deleted' })
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { deletedAt: new Date(), deletedByPartnerId: me.id },
    })
    setSessionPartner(me.id)

    const deletedRes = await call(assessment.id)
    const missingRes = await call('definitely-does-not-exist')

    expect(deletedRes.status).toBe(404)
    expect(missingRes.status).toBe(404)
    expect(await deletedRes.text()).toBe(await missingRes.text())
  })
})

describe('DELETE /api/assessments/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await del('nonexistent')
    expect(res.status).toBe(401)
  })

  it('returns 403 without the deleteRecords permission', async () => {
    const role = await createRole({ permissions: { deleteRecords: false, viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id })
    const assessment = await createAssessment({ handledByPartnerId: me.id })
    setSessionPartner(me.id)

    const res = await del(assessment.id)
    expect(res.status).toBe(403)

    const stillThere = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.id } })
    expect(stillThere.deletedAt).toBeNull()
  })

  it('with deleteRecords, soft-deletes and stamps deletedAt/deletedByPartnerId to the caller', async () => {
    const role = await createRole({ permissions: { deleteRecords: true, viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id })
    const assessment = await createAssessment({ handledByPartnerId: me.id })
    setSessionPartner(me.id)

    const res = await del(assessment.id)
    expect(res.status).toBe(200)

    const updated = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.id } })
    expect(updated.deletedAt).not.toBeNull()
    expect(updated.deletedByPartnerId).toBe(me.id)
  })

  it('a partner without viewAllAssessments deleting another partners record gets 404, and the row is not deleted', async () => {
    const role = await createRole({ permissions: { deleteRecords: true, viewAllAssessments: false } })
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    const assessment = await createAssessment({ handledByPartnerId: other.id })
    setSessionPartner(me.id)

    const res = await del(assessment.id)
    expect(res.status).toBe(404)

    const stillThere = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.id } })
    expect(stillThere.deletedAt).toBeNull()
    expect(stillThere.deletedByPartnerId).toBeNull()
  })

  it('deleting an already-deleted record returns 404', async () => {
    const role = await createRole({ permissions: { deleteRecords: true, viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id })
    const assessment = await createAssessment({ handledByPartnerId: me.id })
    setSessionPartner(me.id)

    const first = await del(assessment.id)
    expect(first.status).toBe(200)

    const second = await del(assessment.id)
    expect(second.status).toBe(404)
  })
})
