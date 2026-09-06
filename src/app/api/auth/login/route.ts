import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { resolveNextLoginStep } from '@/lib/authFlow'
import { getSession } from '@/lib/session'
import { isLocked, nextFailureState } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const partner = await prisma.brandPartner.findUnique({ where: { email } })
  if (!partner || !partner.isActive) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (isLocked(partner.passwordLockedUntil)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a few minutes.' },
      { status: 429 }
    )
  }

  if (!(await verifyPassword(password, partner.passwordHash))) {
    const { attempts, lockedUntil } = nextFailureState(partner.failedPasswordAttempts)
    await prisma.brandPartner.update({
      where: { id: partner.id },
      data: { failedPasswordAttempts: attempts, passwordLockedUntil: lockedUntil },
    })
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (partner.failedPasswordAttempts !== 0 || partner.passwordLockedUntil !== null) {
    await prisma.brandPartner.update({
      where: { id: partner.id },
      data: { failedPasswordAttempts: 0, passwordLockedUntil: null },
    })
  }

  const session = await getSession()
  session.pendingPartnerId = partner.id
  delete session.partnerId
  await session.save()

  const nextStep = resolveNextLoginStep(partner)
  return NextResponse.json({ nextStep })
}
