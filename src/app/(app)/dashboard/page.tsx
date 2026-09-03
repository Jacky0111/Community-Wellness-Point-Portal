'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Alert, Button, Card, Skeleton, Space } from 'antd'
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { StatCards } from '@/components/dashboard/StatCards'
import { RecentActivityList, type RecentAssessment } from '@/components/dashboard/RecentActivityList'

interface DashboardData {
  counts: { total: number; thisWeek: number; thisMonth: number }
  recent: RecentAssessment[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch('/api/dashboard/stats')
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
        const json = (await res.json()) as DashboardData
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Couldn't load dashboard data"
        description="Something went wrong fetching your dashboard stats. Please refresh the page to try again."
      />
    )
  }

  if (loading || !data) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    )
  }

  return (
    <div>
      <StatCards {...data.counts} />

      <Card styles={{ body: { padding: 20 } }} style={{ marginBottom: 24 }}>
        <Space wrap size={12}>
          <Link href="/health-assessment/form">
            <Button type="primary" size="large" icon={<PlusOutlined />}>
              New Health Assessment
            </Button>
          </Link>
          <Link href="/health-assessment/result">
            <Button size="large" icon={<UnorderedListOutlined />}>
              View Results
            </Button>
          </Link>
        </Space>
      </Card>

      <RecentActivityList items={data.recent ?? []} />
    </div>
  )
}
