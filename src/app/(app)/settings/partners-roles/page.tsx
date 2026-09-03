import { redirect } from 'next/navigation'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { PartnersRolesTabs } from '@/components/settings/PartnersRolesTabs'

export default async function PartnersRolesPage() {
  const partner = await getCurrentPartner()
  if (!partner) redirect('/login')

  // Determined server-side, same as the nav gate in NavMenu.tsx — the page must
  // not offer a tab whose underlying API route the caller can't use. manageRoles
  // and managePartners are independent permissions, so each tab is gated on its
  // own key rather than either implying the other.
  const canManageRoles = requirePermission(partner, 'manageRoles')
  const canManagePartners = requirePermission(partner, 'managePartners')

  return <PartnersRolesTabs canManageRoles={canManageRoles} canManagePartners={canManagePartners} />
}
