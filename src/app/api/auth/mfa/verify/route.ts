import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'otplib'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.pendingPartnerId) {
    return NextResponse.json({ error: 'No pending login session' }, { status: 401 })
  }

  const partner = await prisma.brandPartner.findUnique({ where: { id: session.pendingPartnerId } })
  if (!partner || !partner.totpSecretEnc) {
    return NextResponse.json({ error: 'MFA not enrolled' }, { status: 409 })
  }

  const { token } = await request.json()
  const { valid } = await verify({ token, secret: partner.totpSecretEnc })
  if (!valid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  session.partnerId = partner.id
  delete session.pendingPartnerId
  await session.save()

  return NextResponse.json({ nextStep: 'done' })
}
