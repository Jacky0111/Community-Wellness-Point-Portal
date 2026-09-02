import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { resolveNextLoginStep } from '@/lib/authFlow'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const partner = await prisma.brandPartner.findUnique({ where: { email } })
  if (!partner || !partner.isActive || !(await verifyPassword(password, partner.passwordHash))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const session = await getSession()
  session.pendingPartnerId = partner.id
  delete session.partnerId
  await session.save()

  const nextStep = resolveNextLoginStep(partner)
  return NextResponse.json({ nextStep })
}
