import { describe, expect, it } from 'vitest'
import { computeDashboardCounts } from './dashboardStats'

describe('computeDashboardCounts', () => {
  const now = new Date('2026-09-03T12:00:00Z') // a Thursday

  it('counts total rows', () => {
    const rows = [{ createdAt: new Date('2026-01-01') }, { createdAt: new Date('2026-09-01') }]
    expect(computeDashboardCounts(rows, now).total).toBe(2)
  })

  it('counts rows within the current calendar week', () => {
    const rows = [
      { createdAt: new Date('2026-09-01T00:00:00Z') }, // Tuesday this week
      { createdAt: new Date('2026-08-20T00:00:00Z') }, // earlier
    ]
    expect(computeDashboardCounts(rows, now).thisWeek).toBe(1)
  })

  it('counts rows within the current calendar month', () => {
    const rows = [
      { createdAt: new Date('2026-09-01T00:00:00Z') },
      { createdAt: new Date('2026-08-31T23:59:59Z') },
    ]
    expect(computeDashboardCounts(rows, now).thisMonth).toBe(1)
  })

  it('returns zeros for an empty list', () => {
    expect(computeDashboardCounts([], now)).toEqual({ total: 0, thisWeek: 0, thisMonth: 0 })
  })
})
