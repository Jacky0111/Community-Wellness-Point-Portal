import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { partnerInputSchema } from '@/lib/partnerSchema'
import { hashPassword } from '@/lib/password'
import { randomBytes } from 'crypto'

// Explicit select: never return passwordHash, totpSecretEnc, or other secret
// fields to the client. Prisma's default `include: { role: true }` would
// return every scalar column on BrandPartner, which includes the password
// hash and encrypted TOTP secret — those must never leave the server.
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

export async function GET() {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'managePartners')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const partners = await prisma.brandPartner.findMany({
    select: PARTNER_SAFE_SELECT,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ partners })
}

export async function POST(request: NextRequest) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'managePartners')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = partnerInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const temporaryPassword = randomBytes(9).toString('base64url')
  const passwordHash = await hashPassword(temporaryPassword)

  try {
    const created = await prisma.brandPartner.create({
      data: { ...parsed.data, passwordHash, mustChangePassword: true },
      select: PARTNER_SAFE_SELECT,
    })

    return NextResponse.json({ partner: created, temporaryPassword }, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'A brand partner with that email already exists' },
        { status: 409 }
      )
    }
    throw e
  }
}
