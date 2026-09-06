import type { Prisma } from '@prisma/client'

export interface AssessmentFilters {
  dateFrom?: string
  dateTo?: string
  search?: string
  partnerId?: string
}

export interface QueryContext {
  currentPartnerId: string
  canViewAll: boolean
}

export function buildAssessmentWhere(
  filters: AssessmentFilters,
  ctx: QueryContext
): Prisma.AssessmentWhereInput {
  const where: Prisma.AssessmentWhereInput = { deletedAt: null }

  if (!ctx.canViewAll) {
    where.handledByPartnerId = ctx.currentPartnerId
  } else if (filters.partnerId) {
    where.handledByPartnerId = filters.partnerId
  }

  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    }
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { contactNumber: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  return where
}
