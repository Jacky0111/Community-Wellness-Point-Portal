export interface AssessmentDateRow {
  createdAt: Date
}

export interface DashboardCounts {
  total: number
  thisWeek: number
  thisMonth: number
}

export function computeDashboardCounts(
  rows: AssessmentDateRow[],
  now: Date = new Date()
): DashboardCounts {
  const startOfWeek = new Date(now)
  startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay())
  startOfWeek.setUTCHours(0, 0, 0, 0)

  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  let thisWeek = 0
  let thisMonth = 0
  for (const row of rows) {
    if (row.createdAt >= startOfWeek) thisWeek++
    if (row.createdAt >= startOfMonth) thisMonth++
  }

  return { total: rows.length, thisWeek, thisMonth }
}
