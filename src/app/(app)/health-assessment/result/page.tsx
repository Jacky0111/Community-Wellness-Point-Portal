import { redirect } from 'next/navigation'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { ResultsTable } from '@/components/results/ResultsTable'

export default async function ResultPage() {
  const partner = await getCurrentPartner()
  if (!partner) redirect('/login')

  const canExport = requirePermission(partner, 'exportData')
  const canDelete = requirePermission(partner, 'deleteRecords')

  return <ResultsTable canExport={canExport} canDelete={canDelete} />
}
