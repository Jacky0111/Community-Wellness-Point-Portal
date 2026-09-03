'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Card, Space, Tooltip } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { ResultsFilters, type ResultsFilterValue } from './ResultsFilters'
import { BRAND } from '@/lib/theme'

interface AssessmentRow {
  id: string
  name: string
  contactNumber: string
  date: string
  bmi: number | null
  systolicBp: number | null
  diastolicBp: number | null
  handledByPartner: { name: string }
}

export interface ResultsTableProps {
  /** Whether the current partner's role has `exportData`. Controls the Export button. */
  canExport: boolean
}

// Keeps typing in the search box from firing a request per keystroke — the raw
// filter state updates immediately (so the input stays responsive), while the
// value used to build the query string trails behind it by this delay.
const SEARCH_DEBOUNCE_MS = 300

export function ResultsTable({ canExport }: ResultsTableProps) {
  const router = useRouter()
  const [rows, setRows] = useState<AssessmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ResultsFilterValue>({ search: '', dateRange: null })
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [filters.search])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (filters.dateRange) {
      params.set('dateFrom', filters.dateRange[0].format('YYYY-MM-DD'))
      params.set('dateTo', filters.dateRange[1].format('YYYY-MM-DD'))
    }
    return params.toString()
  }, [debouncedSearch, filters.dateRange])

  useEffect(() => {
    // Guards against out-of-order responses: if the filters change again before
    // this request resolves, `ignore` is flipped in the cleanup so the stale
    // response can no longer overwrite state with results for filters that no
    // longer apply. Loading is only cleared by the request that actually wins.
    let ignore = false
    setLoading(true)
    fetch(`/api/assessments?${queryString}`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setRows(data.assessments ?? [])
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [queryString])

  const exportButton = (
    <Button icon={<DownloadOutlined />} href={`/api/assessments/export?${queryString}`} disabled={!canExport}>
      Export to Excel
    </Button>
  )

  return (
    <Card
      style={{ borderRadius: BRAND.cardRadius }}
      styles={{ body: { padding: 24 } }}
    >
      <Space
        style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}
        wrap
      >
        <ResultsFilters value={filters} onChange={setFilters} />
        {canExport ? (
          exportButton
        ) : (
          <Tooltip title="You don't have permission to export data">{exportButton}</Tooltip>
        )}
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: true }}
        onRow={(record) => ({
          onClick: () => router.push(`/health-assessment/result/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Contact', dataIndex: 'contactNumber' },
          { title: 'Date', dataIndex: 'date', render: (d: string) => d.slice(0, 10) },
          { title: 'BMI', dataIndex: 'bmi' },
          {
            title: 'BP',
            render: (_: unknown, r: AssessmentRow) =>
              r.systolicBp && r.diastolicBp ? `${r.systolicBp}/${r.diastolicBp}` : '-',
          },
          { title: 'Handled By', dataIndex: ['handledByPartner', 'name'] },
        ]}
      />
    </Card>
  )
}
