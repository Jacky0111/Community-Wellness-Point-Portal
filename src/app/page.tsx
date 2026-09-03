import { redirect } from 'next/navigation'
import { getCurrentPartner } from '@/lib/authz'

export default async function RootPage() {
  const partner = await getCurrentPartner()
  redirect(partner ? '/dashboard' : '/login')
}
