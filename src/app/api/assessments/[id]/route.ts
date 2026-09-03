import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { handledByPartner: { select: { name: true } } },
  })

  if (!assessment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const canViewAll = requirePermission(partner, 'viewAllAssessments')
  if (!canViewAll && assessment.handledByPartnerId !== partner.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ assessment })
}
