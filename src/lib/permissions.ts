export const PERMISSION_KEYS = [
  'viewAllAssessments',
  'manageRoles',
  'managePartners',
  'exportData',
  'deleteRecords',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export type PermissionSet = Record<PermissionKey, boolean>

export function hasPermission(
  permissions: Partial<PermissionSet> | null | undefined,
  key: PermissionKey
): boolean {
  return permissions?.[key] === true
}
