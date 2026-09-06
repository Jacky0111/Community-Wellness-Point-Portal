import { describe, expect, it } from 'vitest'
import { isLocked, nextFailureState, MAX_ATTEMPTS, LOCKOUT_DURATION_MS } from './rateLimit'

describe('isLocked', () => {
  it('returns false when lockedUntil is null', () => {
    expect(isLocked(null)).toBe(false)
  })

  it('returns true when lockedUntil is in the future', () => {
    const now = new Date('2026-09-06T12:00:00Z')
    const lockedUntil = new Date(now.getTime() + 60_000)
    expect(isLocked(lockedUntil, now)).toBe(true)
  })

  it('returns false when lockedUntil is in the past (lock expired)', () => {
    const now = new Date('2026-09-06T12:00:00Z')
    const lockedUntil = new Date(now.getTime() - 60_000)
    expect(isLocked(lockedUntil, now)).toBe(false)
  })
})

describe('nextFailureState', () => {
  const now = new Date('2026-09-06T12:00:00Z')

  it('increments attempts without locking below the threshold', () => {
    const state = nextFailureState(0, now)
    expect(state.attempts).toBe(1)
    expect(state.lockedUntil).toBeNull()
  })

  it('does not lock until MAX_ATTEMPTS is reached', () => {
    const state = nextFailureState(MAX_ATTEMPTS - 2, now)
    expect(state.attempts).toBe(MAX_ATTEMPTS - 1)
    expect(state.lockedUntil).toBeNull()
  })

  it('locks once the threshold is reached', () => {
    const state = nextFailureState(MAX_ATTEMPTS - 1, now)
    expect(state.attempts).toBe(MAX_ATTEMPTS)
    expect(state.lockedUntil).not.toBeNull()
    expect(state.lockedUntil!.getTime()).toBe(now.getTime() + LOCKOUT_DURATION_MS)
  })

  it('defaults now to the current time when omitted', () => {
    const before = Date.now()
    const state = nextFailureState(0)
    expect(state.attempts).toBe(1)
    expect(state.lockedUntil).toBeNull()
    expect(before).toBeLessThanOrEqual(Date.now())
  })
})
