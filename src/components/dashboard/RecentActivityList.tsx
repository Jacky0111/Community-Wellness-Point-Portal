'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, List, Empty } from 'antd'

export interface RecentAssessment {
  id: string
  name: string
  date: string
  handledByPartner: { name: string }
}

/**
 * Assessment dates are stored as UTC midnight. Slicing the raw ISO string
 * avoids any local-timezone shift that `new Date(d)` / `toLocaleDateString()`
 * would introduce for users west of UTC.
 */
function formatAssessmentDate(isoDate: string) {
  return isoDate.slice(0, 10)
}

export function RecentActivityList({ items }: { items: RecentAssessment[] }) {
  const router = useRouter()

  return (
    <Card
      title="Recent Activity"
      extra={
        <Link href="/health-assessment/result" style={{ fontSize: 13 }}>
          View all &rarr;
        </Link>
      }
    >
      {items.length === 0 ? (
        <Empty description="No assessments recorded yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={items}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/health-assessment/result/${item.id}`)}
            >
              <List.Item.Meta
                title={item.name}
                description={`${formatAssessmentDate(item.date)} — handled by ${item.handledByPartner.name}`}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}
