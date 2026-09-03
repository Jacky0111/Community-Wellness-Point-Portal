import { describe, expect, it } from 'vitest'
import { assertRoleMutable, SystemRoleProtectedError } from './roleGuard'

describe('assertRoleMutable', () => {
  it('does not throw for a non-system role', () => {
    expect(() => assertRoleMutable({ isSystemDefault: false })).not.toThrow()
  })

  it('throws SystemRoleProtectedError for the system default role', () => {
    expect(() => assertRoleMutable({ isSystemDefault: true })).toThrow(SystemRoleProtectedError)
  })

  it('instanceof check works for caught error', () => {
    try {
      assertRoleMutable({ isSystemDefault: true })
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e instanceof SystemRoleProtectedError).toBe(true)
      expect((e as Error).name).toBe('SystemRoleProtectedError')
      expect((e as Error).message).toBe('The default system role cannot be modified or deleted.')
    }
  })
})
