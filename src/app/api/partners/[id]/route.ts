import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { PARTNER_SAFE_SELECT } from '@/lib/partnerSelect'

const partnerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'managePartners')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = partnerUpdateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Self-lockout guard: `isSystemDefault` protects the seeded Owner *role*
  // from deletion, but nothing previously stopped a partner from reassigning
  // their own account away from it, or deactivating themselves outright.
  // Either one can leave the system with nobody able to administer it.
  // Changing one's own name is still allowed.
  const isSelf = params.id === partner.id
  const attemptsRoleChange = parsed.data.roleId !== undefined
  const attemptsSelfDeactivate = parsed.data.isActive === false
  if (isSelf && (attemptsRoleChange || attemptsSelfDeactivate)) {
    return NextResponse.json(
      { error: 'You cannot change your own role or deactivate your own account' },
      { status: 409 }
    )
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
