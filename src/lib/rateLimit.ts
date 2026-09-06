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

/**
 * Computes the next failure-count state after another bad attempt.
 *
 * `currentLockedUntil` is the lock the previous attempt (if any) set. If
 * that lock has already expired by `now`, the attempt count is treated as
 * reset to 0 before incrementing — otherwise a user who genuinely forgot
 * their password would re-lock on their very first attempt after every
 * lockout window, forever. A lock that is still active is not reachable
 * here in practice (callers check `isLocked` first and refuse the attempt
 * outright), but is handled the same way for safety.
 */
export function nextFailureState(
  currentAttempts: number,
  currentLockedUntil: Date | null = null,
  now: Date = new Date()
): FailureState {
  const lockHasExpired = currentLockedUntil !== null && !isLocked(currentLockedUntil, now)
  const baseAttempts = lockHasExpired ? 0 : currentAttempts
  const attempts = baseAttempts + 1
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null
  return { attempts, lockedUntil }
}
