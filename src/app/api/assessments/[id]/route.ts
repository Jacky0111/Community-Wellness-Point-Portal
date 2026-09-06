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

  if (!assessment || assessment.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const canViewAll = requirePermission(partner, 'viewAllAssessments')
  if (!canViewAll && assessment.handledByPartnerId !== partner.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ assessment })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!requirePermission(partner, 'deleteRecords')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const assessment = await prisma.assessment.findUnique({ where: { id: params.id } })

  if (!assessment || assessment.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const canViewAll = requirePermission(partner, 'viewAllAssessments')
  if (!canViewAll && assessment.handledByPartnerId !== partner.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.assessment.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), deletedByPartnerId: partner.id },
  })

  return NextResponse.json({ message: 'Record deleted' })
}
