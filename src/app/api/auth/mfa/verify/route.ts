import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'otplib'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { decryptSecret, encryptSecret, isEncrypted } from '@/lib/crypto'
import { isLocked, nextFailureState } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.pendingPartnerId) {
    return NextResponse.json({ error: 'No pending login session' }, { status: 401 })
  }

  const partner = await prisma.brandPartner.findUnique({ where: { id: session.pendingPartnerId } })
  if (!partner || !partner.totpSecretEnc) {
    return NextResponse.json({ error: 'MFA not enrolled' }, { status: 409 })
  }

  if (isLocked(partner.totpLockedUntil)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a few minutes.' },
      { status: 429 }
    )
  }

  const { token } = await request.json()
  const secret = decryptSecret(partner.totpSecretEnc)
  const { valid } = await verify({ token, secret })
  if (!valid) {
    const { attempts, lockedUntil } = nextFailureState(partner.failedTotpAttempts, partner.totpLockedUntil)
    await prisma.brandPartner.update({
      where: { id: partner.id },
      data: { failedTotpAttempts: attempts, totpLockedUntil: lockedUntil },
    })
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  const dataToPersist: {
    failedTotpAttempts: number
    totpLockedUntil: null
    totpSecretEnc?: string
  } = { failedTotpAttempts: 0, totpLockedUntil: null }

  // Lazy migration: legacy accounts stored a raw plaintext secret. Re-encrypt
  // it now that we've confirmed the account owner just proved possession.
  if (!isEncrypted(partner.totpSecretEnc)) {
    dataToPersist.totpSecretEnc = encryptSecret(secret)
  }

  await prisma.brandPartner.update({
    where: { id: partner.id },
    data: dataToPersist,
  })

  session.partnerId = partner.id
  delete session.pendingPartnerId
  await session.save()

  return NextResponse.json({ nextStep: 'done' })
}
