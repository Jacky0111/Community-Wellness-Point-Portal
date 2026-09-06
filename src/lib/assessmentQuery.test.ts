import { describe, expect, it } from 'vitest'
import { buildAssessmentWhere } from './assessmentQuery'

describe('buildAssessmentWhere', () => {
  it('always excludes soft-deleted rows', () => {
    const where = buildAssessmentWhere({}, { currentPartnerId: 'p1', canViewAll: true })
    expect(where.deletedAt).toBeNull()
  })

  it('scopes to the current partner when canViewAll is false', () => {
    const where = buildAssessmentWhere({}, { currentPartnerId: 'p1', canViewAll: false })
    expect(where.handledByPartnerId).toBe('p1')
  })

  it('ignores the partnerId filter when canViewAll is false', () => {
    const where = buildAssessmentWhere(
      { partnerId: 'p2' },
      { currentPartnerId: 'p1', canViewAll: false }
    )
    expect(where.handledByPartnerId).toBe('p1')
  })

  it('applies the partnerId filter when canViewAll is true', () => {
    const where = buildAssessmentWhere(
      { partnerId: 'p2' },
      { currentPartnerId: 'p1', canViewAll: true }
    )
    expect(where.handledByPartnerId).toBe('p2')
  })

  it('leaves handledByPartnerId unset when canViewAll is true and no partnerId filter given', () => {
    const where = buildAssessmentWhere({}, { currentPartnerId: 'p1', canViewAll: true })
    expect(where.handledByPartnerId).toBeUndefined()
  })

  it('builds a date range filter', () => {
    const where = buildAssessmentWhere(
      { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      { currentPartnerId: 'p1', canViewAll: true }
    )
    expect(where.date).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') })
  })

  it('builds a name/contact search filter', () => {
    const where = buildAssessmentWhere(
      { search: 'jane' },
      { currentPartnerId: 'p1', canViewAll: true }
    )
    expect(where.OR).toEqual([
      { name: { contains: 'jane', mode: 'insensitive' } },
      { contactNumber: { contains: 'jane', mode: 'insensitive' } },
    ])
  })
})
