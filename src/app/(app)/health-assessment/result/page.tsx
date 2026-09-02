import { redirect } from 'next/navigation'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { ResultsTable } from '@/components/results/ResultsTable'

export default async function ResultPage() {
  const partner = await getCurrentPartner()
  if (!partner) redirect('/login')

  const canExport = requirePermission(partner, 'exportData')

  return <ResultsTable canExport={canExport} />
}
