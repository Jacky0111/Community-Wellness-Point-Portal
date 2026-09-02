import { NextRequest, NextResponse } from 'next/server'
import { generateSecret, generateURI, verify } from 'otplib'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.pendingPartnerId) {
    return NextResponse.json({ error: 'No pending login session' }, { status: 401 })
  }

  const partner = await prisma.brandPartner.findUnique({ where: { id: session.pendingPartnerId } })
  if (!partner || partner.totpEnabledAt) {
    return NextResponse.json({ error: 'Already enrolled' }, { status: 409 })
  }

  const secret = generateSecret()
  const otpauthUrl = generateURI({ issuer: 'Community Wellness Point', label: partner.email, secret })

  session.pendingPartnerId = partner.id
  await session.save()

  // secret is re-derived and persisted only after successful verification (Step 4)
  return NextResponse.json({ secret, otpauthUrl })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.pendingPartnerId) {
    return NextResponse.json({ error: 'No pending login session' }, { status: 401 })
  }

  const { secret, token } = await request.json()
  const { valid } = await verify({ token, secret })
  if (!valid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  await prisma.brandPartner.update({
    where: { id: session.pendingPartnerId },
    data: { totpSecretEnc: secret, totpEnabledAt: new Date() },
  })

  session.partnerId = session.pendingPartnerId
  delete session.pendingPartnerId
  await session.save()

  return NextResponse.json({ nextStep: 'done' })
}
