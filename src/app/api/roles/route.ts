import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { roleInputSchema } from '@/lib/roleSchema'

export async function GET() {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'manageRoles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ roles })
}

export async function POST(request: NextRequest) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'manageRoles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = roleInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const role = await prisma.role.create({ data: parsed.data })
    return NextResponse.json({ role }, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'A role with that name already exists' }, { status: 409 })
    }
    throw e
  }
}
