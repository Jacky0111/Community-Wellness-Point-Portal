import { Card, Col, Row } from 'antd'
import { FileTextOutlined, CalendarOutlined, RiseOutlined } from '@ant-design/icons'
import { BRAND } from '@/lib/theme'

export interface StatCardsProps {
  total: number
  thisWeek: number
  thisMonth: number
}

interface StatItem {
  key: string
  caption: string
  value: number
  icon: React.ReactNode
}

/**
 * Rounded icon tile in a soft brand-tinted square, per the owner's mockup —
 * paired with a large figure and a muted caption underneath.
 */
function IconTile({ icon }: { icon: React.ReactNode }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: `${BRAND.primary}1A`,
        color: BRAND.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
  )
}

export function StatCards({ total, thisWeek, thisMonth }: StatCardsProps) {
  const items: StatItem[] = [
    {
      key: 'total',
      caption: 'Total Assessments',
      value: total,
      icon: <FileTextOutlined />,
    },
    {
      key: 'thisWeek',
      caption: 'This Week',
      value: thisWeek,
      icon: <CalendarOutlined />,
    },
    {
      key: 'thisMonth',
      caption: 'This Month',
      value: thisMonth,
      icon: <RiseOutlined />,
    },
  ]

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {items.map((item) => (
        <Col xs={24} sm={8} key={item.key}>
          <Card styles={{ body: { padding: 20 } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <IconTile icon={item.icon} />
              <div>
                <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}>{item.value}</div>
                <div style={{ color: 'rgba(0, 0, 0, 0.45)', fontSize: 13 }}>{item.caption}</div>
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  )
}
