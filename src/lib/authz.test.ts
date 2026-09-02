import { describe, expect, it } from 'vitest'
import { requirePermission } from './authz'

describe('requirePermission', () => {
  it('returns false when partner is null', () => {
    expect(requirePermission(null, 'manageRoles')).toBe(false)
  })

  it('returns true when the role JSON has the permission set', () => {
    const partner = { role: { permissions: { manageRoles: true } } }
    expect(requirePermission(partner, 'manageRoles')).toBe(true)
  })

  it('returns false when the role JSON does not have the permission set', () => {
    const partner = { role: { permissions: { manageRoles: false } } }
    expect(requirePermission(partner, 'manageRoles')).toBe(false)
  })
})
