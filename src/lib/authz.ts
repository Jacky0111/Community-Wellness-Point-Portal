import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { hasPermission, type PermissionKey, type PermissionSet } from '@/lib/permissions'
import type { BrandPartner, Role } from '@prisma/client'

export type PartnerWithRole = BrandPartner & { role: Role }

export async function getCurrentPartner(): Promise<PartnerWithRole | null> {
  const session = await getSession()
  if (!session.partnerId) return null

  const partner = await prisma.brandPartner.findUnique({
    where: { id: session.partnerId },
    include: { role: true },
  })

  // A deactivated partner's session cookie must stop working immediately,
  // not just at their next login — otherwise deactivating someone who is
  // currently logged in has no effect until their cookie expires on its own.
  if (!partner || !partner.isActive) return null

  return partner
}

export function requirePermission(
  partner: { role: { permissions: unknown } } | null,
  key: PermissionKey
): boolean {
  if (!partner) return false
  return hasPermission(partner.role.permissions as Partial<PermissionSet>, key)
}
