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
    const state = nextFailureState(0, null, now)
    expect(state.attempts).toBe(1)
    expect(state.lockedUntil).toBeNull()
  })

  it('does not lock until MAX_ATTEMPTS is reached', () => {
    const state = nextFailureState(MAX_ATTEMPTS - 2, null, now)
    expect(state.attempts).toBe(MAX_ATTEMPTS - 1)
    expect(state.lockedUntil).toBeNull()
  })

  it('locks once the threshold is reached', () => {
    const state = nextFailureState(MAX_ATTEMPTS - 1, null, now)
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

  it('defaults currentLockedUntil to null when omitted', () => {
    const state = nextFailureState(MAX_ATTEMPTS - 1, undefined, now)
    expect(state.attempts).toBe(MAX_ATTEMPTS)
    expect(state.lockedUntil).not.toBeNull()
  })

  describe('when a previous lockout has expired', () => {
    it('resets the count to 0 before incrementing, rather than carrying the stale total', () => {
      const expiredLock = new Date(now.getTime() - 60_000)
      const state = nextFailureState(MAX_ATTEMPTS, expiredLock, now)
      expect(state.attempts).toBe(1)
      expect(state.lockedUntil).toBeNull()
    })

    it('still locks again after MAX_ATTEMPTS fresh failures post-expiry', () => {
      const expiredLock = new Date(now.getTime() - 60_000)
      let attempts = MAX_ATTEMPTS
      let lockedUntil: Date | null = expiredLock

      // first failure after expiry resets to 1
      let state = nextFailureState(attempts, lockedUntil, now)
      expect(state.attempts).toBe(1)
      expect(state.lockedUntil).toBeNull()
      attempts = state.attempts
      lockedUntil = state.lockedUntil

      // four more fresh failures should re-lock at MAX_ATTEMPTS
      for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
        state = nextFailureState(attempts, lockedUntil, now)
        attempts = state.attempts
        lockedUntil = state.lockedUntil
      }

      expect(attempts).toBe(MAX_ATTEMPTS)
      expect(lockedUntil).not.toBeNull()
      expect(lockedUntil!.getTime()).toBe(now.getTime() + LOCKOUT_DURATION_MS)
    })
  })

  describe('when a previous lockout is still active', () => {
    it('does not reset the count (defensive — callers should refuse via isLocked first)', () => {
      const activeLock = new Date(now.getTime() + 60_000)
      const state = nextFailureState(MAX_ATTEMPTS, activeLock, now)
      expect(state.attempts).toBe(MAX_ATTEMPTS + 1)
      expect(state.lockedUntil).not.toBeNull()
    })
  })
})
