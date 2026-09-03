import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { roleInputSchema } from '@/lib/roleSchema'
import { assertRoleMutable, SystemRoleProtectedError } from '@/lib/roleGuard'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'manageRoles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = await prisma.role.findUnique({ where: { id: params.id } })
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    assertRoleMutable(role)
  } catch (e) {
    if (e instanceof SystemRoleProtectedError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }

  const parsed = roleInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const updated = await prisma.role.update({ where: { id: role.id }, data: parsed.data })
    return NextResponse.json({ role: updated })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'A role with that name already exists' }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'manageRoles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = await prisma.role.findUnique({ where: { id: params.id } })
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    assertRoleMutable(role)
  } catch (e) {
    if (e instanceof SystemRoleProtectedError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }

  try {
    await prisma.role.delete({ where: { id: role.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return NextResponse.json(
        { error: 'This role is still assigned to one or more brand partners and cannot be deleted' },
        { status: 409 }
      )
    }
    throw e
  }
}
