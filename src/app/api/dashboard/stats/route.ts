import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { buildAssessmentWhere } from '@/lib/assessmentQuery'
import { computeDashboardCounts } from '@/lib/dashboardStats'

export async function GET() {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const where = buildAssessmentWhere(
    {},
    { currentPartnerId: partner.id, canViewAll: requirePermission(partner, 'viewAllAssessments') }
  )

  const rows = await prisma.assessment.findMany({ where, select: { createdAt: true } })
  const counts = computeDashboardCounts(rows)

  const recent = await prisma.assessment.findMany({
    where,
    include: { handledByPartner: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({ counts, recent })
}
