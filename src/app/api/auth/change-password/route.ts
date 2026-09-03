import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { resolveNextLoginStep } from '@/lib/authFlow'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const session = await getSession()

  // A pending (mid-login, pre-MFA) session and a fully-authenticated session are
  // both valid callers of this route: the login flow forces a password change
  // before MFA, and an already-logged-in partner can change their password
  // voluntarily from My Profile. Neither id present means the caller isn't
  // authenticated at all.
  const targetId = session.pendingPartnerId ?? session.partnerId
  if (!targetId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const partner = await prisma.brandPartner.findUnique({ where: { id: targetId } })
  if (!partner) {
    return NextResponse.json({ error: 'Password change is not required' }, { status: 409 })
  }

  // The "must actually be required" guard only applies to the pending-login
  // flow (Task 8's original behaviour: a partner who already completed their
  // forced change can't re-hit this step). A fully-authenticated partner
  // changing their password voluntarily has no such precondition — gating it
  // on `mustChangePassword` would block ordinary password changes for anyone
  // whose forced change already happened.
  if (session.pendingPartnerId && !partner.mustChangePassword) {
    return NextResponse.json({ error: 'Password change is not required' }, { status: 409 })
  }

  const { newPassword } = await request.json()
  const passwordHash = await hashPassword(newPassword)

  // Uses targetId, not partner.id, to update the partner whose password is
  // actually being changed — this route never touches session.partnerId or
  // session.pendingPartnerId itself, so a pending session is never promoted to
  // a full session here.
  const updated = await prisma.brandPartner.update({
    where: { id: targetId },
    data: { passwordHash, mustChangePassword: false },
  })

  return NextResponse.json({ nextStep: resolveNextLoginStep(updated) })
}
