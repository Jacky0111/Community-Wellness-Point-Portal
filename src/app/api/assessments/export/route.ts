import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { buildAssessmentWhere } from '@/lib/assessmentQuery'
import { toExportRow } from '@/lib/export'

export async function GET(request: NextRequest) {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const where = buildAssessmentWhere(
    {
      dateFrom: url.searchParams.get('dateFrom') ?? undefined,
      dateTo: url.searchParams.get('dateTo') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      partnerId: url.searchParams.get('partnerId') ?? undefined,
    },
    { currentPartnerId: partner.id, canViewAll: requirePermission(partner, 'viewAllAssessments') }
  )

  const assessments = await prisma.assessment.findMany({
    where,
    include: { handledByPartner: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Results')
  const rows = assessments.map(toExportRow)
  if (rows.length > 0) {
    sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }))
    sheet.addRows(rows)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="wellness-results.xlsx"',
    },
  })
}
