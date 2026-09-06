// Shared mock for `@/lib/session`, the one seam these integration tests mock
// (see src/test/README below / api-tests-report.md for rationale). Import
// this module's setters from a test file after calling
// `vi.mock('@/lib/session', () => import('@/test/sessionMock'))` at the top
// of that file.
import { vi } from 'vitest'

interface MockSessionState {
  partnerId?: string
  pendingPartnerId?: string
  pendingTotpSecret?: string
}

// A single mutable object, not a `let` binding that gets reassigned — route
// code does `session.partnerId = x; delete session.pendingPartnerId; await
// session.save()` on the object returned by getSession(), and we want those
// mutations to be visible to a *subsequent* getSession() call within the same
// test (e.g. login -> mfa/verify chains), the same way the real iron-session
// cookie would carry them across requests.
let state: MockSessionState = {}

export function setSessionPartner(partnerId: string): void {
  state = { partnerId }
}

export function setSessionPending(pendingPartnerId: string): void {
  state = { pendingPartnerId }
}

export function clearSession(): void {
  state = {}
}

export const getSession = vi.fn(async () => {
  const session = state as MockSessionState & { save: () => Promise<void>; destroy: () => void }
  session.save = async () => {}
  session.destroy = () => {
    delete state.partnerId
    delete state.pendingPartnerId
    delete state.pendingTotpSecret
  }
  return session
})
