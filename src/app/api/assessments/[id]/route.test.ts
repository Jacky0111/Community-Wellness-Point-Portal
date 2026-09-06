import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { resetDb, createRole, createPartner, createAssessment } from '@/test/db'
import { setSessionPartner, clearSession } from '@/test/sessionMock'
import { GET } from '@/app/api/assessments/[id]/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

function call(id: string) {
  return GET(new Request(`http://localhost/api/assessments/${id}`), { params: { id } })
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
})
