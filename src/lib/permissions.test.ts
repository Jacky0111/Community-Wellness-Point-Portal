import { describe, expect, it } from 'vitest'
import { hasPermission } from './permissions'

describe('hasPermission', () => {
  it('returns true when the permission is explicitly true', () => {
    expect(hasPermission({ viewAllAssessments: true }, 'viewAllAssessments')).toBe(true)
  })

  it('returns false when the permission is explicitly false', () => {
    expect(hasPermission({ viewAllAssessments: false }, 'viewAllAssessments')).toBe(false)
  })

  it('returns false when the permission key is missing', () => {
    expect(hasPermission({}, 'manageRoles')).toBe(false)
  })

  it('returns false when permissions is null or undefined', () => {
    expect(hasPermission(null, 'manageRoles')).toBe(false)
    expect(hasPermission(undefined, 'manageRoles')).toBe(false)
  })
})
