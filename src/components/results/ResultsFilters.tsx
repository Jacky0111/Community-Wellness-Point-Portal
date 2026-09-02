'use client'

import { DatePicker, Input, Space } from 'antd'
import type { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

export interface ResultsFilterValue {
  search: string
  dateRange: [Dayjs, Dayjs] | null
}

export interface ResultsFiltersProps {
  value: ResultsFilterValue
  onChange: (value: ResultsFilterValue) => void
}

export function ResultsFilters({ value, onChange }: ResultsFiltersProps) {
  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Input.Search
        placeholder="Search name or contact number"
        allowClear
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        style={{ width: 260 }}
      />
      <RangePicker
        value={value.dateRange}
        onChange={(dates) => onChange({ ...value, dateRange: dates as [Dayjs, Dayjs] | null })}
      />
    </Space>
  )
}
