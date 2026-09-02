import { describe, expect, it } from 'vitest'
import { assessmentInputSchema } from './assessmentSchema'

describe('assessmentInputSchema', () => {
  it('accepts a valid minimal submission', () => {
    const result = assessmentInputSchema.safeParse({
      date: '2026-09-03',
      name: 'Jane Doe',
      contactNumber: '+60123456789',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a submission missing the required name', () => {
    const result = assessmentInputSchema.safeParse({
      date: '2026-09-03',
      contactNumber: '+60123456789',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a submission missing the required date', () => {
    const result = assessmentInputSchema.safeParse({
      name: 'Jane Doe',
      contactNumber: '+60123456789',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional numeric fields when present', () => {
    const result = assessmentInputSchema.safeParse({
      date: '2026-09-03',
      name: 'Jane Doe',
      contactNumber: '+60123456789',
      height: 170,
      weight: 70,
      systolicBp: 118,
      diastolicBp: 76,
    })
    expect(result.success).toBe(true)
  })
})
