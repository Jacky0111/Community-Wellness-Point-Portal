import { redirect } from 'next/navigation'
import { getCurrentPartner } from '@/lib/authz'
import { AppShell } from '@/components/layout/AppShell'
import type { PermissionSet } from '@/lib/permissions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const partner = await getCurrentPartner()
  if (!partner) redirect('/login')

  return (
    <AppShell
      partnerName={partner.name}
      permissions={partner.role.permissions as Partial<PermissionSet>}
    >
      {children}
    </AppShell>
  )
}
