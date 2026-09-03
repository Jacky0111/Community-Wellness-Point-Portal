'use client'

import { Card, List, Typography } from 'antd'
import { MEASUREMENT_RANGES } from '@/lib/measurementRanges'

export default function MeasurementPage() {
  return (
    <Card title="Normal Measurement Ranges">
      <List
        dataSource={MEASUREMENT_RANGES}
        renderItem={(item) => (
          <List.Item>
            <Typography.Text strong>{item.label}</Typography.Text>
            <Typography.Text style={{ marginLeft: 8 }}>{item.normalRange}</Typography.Text>
          </List.Item>
        )}
      />
    </Card>
  )
}
