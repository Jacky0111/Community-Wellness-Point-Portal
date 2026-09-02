import { describe, expect, it } from 'vitest'
import { calculateBmi } from './bmi'

describe('calculateBmi', () => {
  it('computes BMI from height (cm) and weight (kg)', () => {
    expect(calculateBmi(170, 70)).toBeCloseTo(24.2, 1)
  })

  it('returns null when height is missing', () => {
    expect(calculateBmi(null, 70)).toBeNull()
  })

  it('returns null when weight is missing', () => {
    expect(calculateBmi(170, undefined)).toBeNull()
  })

  it('returns null for non-positive values', () => {
    expect(calculateBmi(0, 70)).toBeNull()
    expect(calculateBmi(170, -5)).toBeNull()
  })
})
