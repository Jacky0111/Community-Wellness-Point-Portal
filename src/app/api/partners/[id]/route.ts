import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'

const partnerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})

// Same rationale as src/app/api/partners/route.ts: never let passwordHash or
// totpSecretEnc reach the client.
const PARTNER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  mustChangePassword: true,
  totpEnabledAt: true,
  isActive: true,
  roleId: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BrandPartnerSelect

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'managePartners')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = partnerUpdateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const updated = await prisma.brandPartner.update({
      where: { id: params.id },
      data: parsed.data,
      select: PARTNER_SAFE_SELECT,
    })

    return NextResponse.json({ partner: updated })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw e
  }
}
