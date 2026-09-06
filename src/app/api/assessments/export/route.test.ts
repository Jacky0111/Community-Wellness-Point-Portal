import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { resetDb, createRole, createPartner, createAssessment } from '@/test/db'
import { setSessionPartner, clearSession } from '@/test/sessionMock'
import { GET } from '@/app/api/assessments/export/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

async function namesInWorkbook(res: Response): Promise<string[]> {
  const buf = Buffer.from(await res.arrayBuffer())
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buf as unknown as ArrayBuffer)
  const sheet = workbook.getWorksheet('Results')!
  const names: string[] = []
  const header = sheet.getRow(1).values as unknown[]
  const nameCol = header.findIndex((v) => v === 'Name')
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    names.push(String((row.values as unknown[])[nameCol]))
  })
  return names
}

describe('GET /api/assessments/export', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GET(new NextRequest('http://localhost/api/assessments/export'))
    expect(res.status).toBe(401)
  })

  it('the export gate: 403 without exportData, succeeds with it', async () => {
    const noExportRole = await createRole({ permissions: { exportData: false, viewAllAssessments: true } })
    const partner = await createPartner({ roleId: noExportRole.id })
    setSessionPartner(partner.id)

    const forbidden = await GET(new NextRequest('http://localhost/api/assessments/export'))
    expect(forbidden.status).toBe(403)

    const exportRole = await createRole({ permissions: { exportData: true, viewAllAssessments: true } })
    const exporter = await createPartner({ roleId: exportRole.id })
    setSessionPartner(exporter.id)

    const allowed = await GET(new NextRequest('http://localhost/api/assessments/export'))
    expect(allowed.status).toBe(200)
  })

  it('row scoping: a partner without viewAllAssessments only exports their own rows', async () => {
    const role = await createRole({ permissions: { exportData: true, viewAllAssessments: false } })
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    await createAssessment({ handledByPartnerId: me.id, name: 'MyClient' })
    await createAssessment({ handledByPartnerId: other.id, name: 'OtherClient' })

    setSessionPartner(me.id)
    const res = await GET(new NextRequest('http://localhost/api/assessments/export'))
    expect(res.status).toBe(200)
    expect(await namesInWorkbook(res)).toEqual(['MyClient'])
  })

  it('a partner with viewAllAssessments exports both partners rows', async () => {
    const role = await createRole({ permissions: { exportData: true, viewAllAssessments: true } })
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    await createAssessment({ handledByPartnerId: me.id, name: 'MyClient' })
    await createAssessment({ handledByPartnerId: other.id, name: 'OtherClient' })

    setSessionPartner(me.id)
    const res = await GET(new NextRequest('http://localhost/api/assessments/export'))
    expect(res.status).toBe(200)
    expect((await namesInWorkbook(res)).sort()).toEqual(['MyClient', 'OtherClient'])
  })

  it('the bypass attempt: ?partnerId=<other> is ignored for a partner without the permission', async () => {
    const role = await createRole({ permissions: { exportData: true, viewAllAssessments: false } })
    const me = await createPartner({ roleId: role.id })
    const other = await createPartner({ roleId: role.id })
    await createAssessment({ handledByPartnerId: me.id, name: 'MyClient' })
    await createAssessment({ handledByPartnerId: other.id, name: 'OtherClient' })

    setSessionPartner(me.id)
    const res = await GET(
      new NextRequest(`http://localhost/api/assessments/export?partnerId=${other.id}`)
    )
    expect(res.status).toBe(200)
    expect(await namesInWorkbook(res)).toEqual(['MyClient'])
  })
})
