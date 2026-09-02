import { describe, expect, it } from 'vitest'
import { resolveNextLoginStep } from './authFlow'

describe('resolveNextLoginStep', () => {
  it('requires a password change first if mustChangePassword is true', () => {
    expect(resolveNextLoginStep({ mustChangePassword: true, totpEnabledAt: null })).toBe('change-password')
  })

  it('requires MFA enrollment when password is set but TOTP is not enabled', () => {
    expect(resolveNextLoginStep({ mustChangePassword: false, totpEnabledAt: null })).toBe('mfa-enroll')
  })

  it('requires MFA verification when both password and TOTP are set up', () => {
    expect(
      resolveNextLoginStep({ mustChangePassword: false, totpEnabledAt: new Date() })
    ).toBe('mfa-verify')
  })

  it('prioritizes password change over MFA state', () => {
    expect(
      resolveNextLoginStep({ mustChangePassword: true, totpEnabledAt: new Date() })
    ).toBe('change-password')
  })
})
