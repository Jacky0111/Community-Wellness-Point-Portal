/**
 * Pure, DB-free rate-limiting logic for per-account lockout of login
 * password and TOTP attempts. Deliberately has no Prisma or session
 * imports so it can be unit-tested without a database; callers persist
 * the returned state.
 */

export const MAX_ATTEMPTS = 5
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export interface FailureState {
  attempts: number
  lockedUntil: Date | null
}

export function isLocked(lockedUntil: Date | null, now: Date = new Date()): boolean {
  if (!lockedUntil) return false
  return lockedUntil.getTime() > now.getTime()
}

export function nextFailureState(currentAttempts: number, now: Date = new Date()): FailureState {
  const attempts = currentAttempts + 1
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null
  return { attempts, lockedUntil }
}
