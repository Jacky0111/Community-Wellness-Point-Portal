import { describe, expect, it } from 'vitest'
import { roleInputSchema } from './roleSchema'

describe('roleInputSchema', () => {
  it('accepts a valid role', () => {
    const result = roleInputSchema.safeParse({
      name: 'Wellness Champion',
      permissions: { viewAllAssessments: true, manageRoles: false, managePartners: false, exportData: true, deleteRecords: false },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = roleInputSchema.safeParse({ name: '', permissions: {} })
    expect(result.success).toBe(false)
  })
})
