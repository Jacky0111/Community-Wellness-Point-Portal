export type LoginStep = 'change-password' | 'mfa-enroll' | 'mfa-verify'

export interface PartnerLoginState {
  mustChangePassword: boolean
  totpEnabledAt: Date | null
}

export function resolveNextLoginStep(partner: PartnerLoginState): LoginStep {
  if (partner.mustChangePassword) return 'change-password'
  if (!partner.totpEnabledAt) return 'mfa-enroll'
  return 'mfa-verify'
}
