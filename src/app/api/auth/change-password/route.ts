import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { resolveNextLoginStep } from '@/lib/authFlow'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.pendingPartnerId) {
    return NextResponse.json({ error: 'No pending login session' }, { status: 401 })
  }

  const partner = await prisma.brandPartner.findUnique({ where: { id: session.pendingPartnerId } })
  if (!partner || !partner.mustChangePassword) {
    return NextResponse.json({ error: 'Password change is not required' }, { status: 409 })
  }

  const { newPassword } = await request.json()
  const passwordHash = await hashPassword(newPassword)

  const updated = await prisma.brandPartner.update({
    where: { id: partner.id },
    data: { passwordHash, mustChangePassword: false },
  })

  return NextResponse.json({ nextStep: resolveNextLoginStep(updated) })
}
