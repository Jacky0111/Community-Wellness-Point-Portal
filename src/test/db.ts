import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import type { PermissionSet } from '@/lib/permissions'

const ALL_FALSE_PERMISSIONS: PermissionSet = {
  viewAllAssessments: false,
  manageRoles: false,
  managePartners: false,
  exportData: false,
  deleteRecords: false,
}

/**
 * Truncates every table between tests so each test starts from an empty,
 * known state regardless of execution order. CASCADE handles FK ordering
 * (Assessment -> BrandPartner -> Role) for us.
 */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Assessment", "BrandPartner", "Role" RESTART IDENTITY CASCADE'
  )
}

let counter = 0
function unique(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}`
}

export async function createRole(overrides: {
  name?: string
  permissions?: Partial<PermissionSet>
  isSystemDefault?: boolean
} = {}) {
  return prisma.role.create({
    data: {
      name: overrides.name ?? unique('role'),
      permissions: { ...ALL_FALSE_PERMISSIONS, ...overrides.permissions },
      isSystemDefault: overrides.isSystemDefault ?? false,
    },
  })
}

export async function createPartner(overrides: {
  roleId: string
  name?: string
  email?: string
  password?: string
  isActive?: boolean
  mustChangePassword?: boolean
  totpSecretEnc?: string | null
  totpEnabledAt?: Date | null
  failedPasswordAttempts?: number
  passwordLockedUntil?: Date | null
  failedTotpAttempts?: number
  totpLockedUntil?: Date | null
}) {
  const passwordHash = await hashPassword(overrides.password ?? 'correct-horse-battery-staple')
  return prisma.brandPartner.create({
    data: {
      name: overrides.name ?? unique('Partner'),
      email: overrides.email ?? `${unique('partner')}@example.com`,
      passwordHash,
      roleId: overrides.roleId,
      isActive: overrides.isActive ?? true,
      mustChangePassword: overrides.mustChangePassword ?? false,
      totpSecretEnc: overrides.totpSecretEnc ?? null,
      totpEnabledAt: overrides.totpEnabledAt ?? null,
      failedPasswordAttempts: overrides.failedPasswordAttempts ?? 0,
      passwordLockedUntil: overrides.passwordLockedUntil ?? null,
      failedTotpAttempts: overrides.failedTotpAttempts ?? 0,
      totpLockedUntil: overrides.totpLockedUntil ?? null,
    },
  })
}

export async function createAssessment(overrides: {
  handledByPartnerId: string
  name?: string
  contactNumber?: string
  date?: Date
  [key: string]: unknown
}) {
  const { handledByPartnerId, ...rest } = overrides
  return prisma.assessment.create({
    data: {
      name: (rest.name as string) ?? unique('Client'),
      contactNumber: (rest.contactNumber as string) ?? '0123456789',
      date: (rest.date as Date) ?? new Date('2026-01-01T00:00:00Z'),
      handledByPartnerId,
      ...rest,
    },
  })
}
