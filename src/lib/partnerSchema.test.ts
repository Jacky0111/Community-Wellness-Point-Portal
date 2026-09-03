import { describe, expect, it } from 'vitest'
import { partnerInputSchema } from './partnerSchema'

describe('partnerInputSchema', () => {
  it('accepts a valid partner invite', () => {
    const result = partnerInputSchema.safeParse({
      name: 'Alex Tan',
      email: 'alex@example.com',
      roleId: 'role_123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = partnerInputSchema.safeParse({
      name: 'Alex Tan',
      email: 'not-an-email',
      roleId: 'role_123',
    })
    expect(result.success).toBe(false)
  })
})
