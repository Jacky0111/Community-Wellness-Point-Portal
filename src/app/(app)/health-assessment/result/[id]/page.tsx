'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, Descriptions, Button, Tooltip, Skeleton } from 'antd'
import { BRAND } from '@/lib/theme'

interface AssessmentDetail {
  name: string
  contactNumber: string
  date: string
  height: number | null
  weight: number | null
  bmi: number | null
  bodyFatPercent: number | null
  visceralFatLevel: number | null
  systolicBp: number | null
  diastolicBp: number | null
  bloodGlucose: number | null
  remarks: string | null
  handledByPartner: { name: string }
}

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)

  useEffect(() => {
    fetch(`/api/assessments/${id}`)
      .then((res) => res.json())
      .then((data) => setAssessment(data.assessment))
  }, [id])

  if (!assessment) return <Skeleton active />

  return (
    <Card
      style={{ borderRadius: BRAND.cardRadius }}
      styles={{ body: { padding: 24 } }}
    >
      <div style={{ overflowX: 'auto' }}>
        <Descriptions title={assessment.name} bordered column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Contact">{assessment.contactNumber}</Descriptions.Item>
          <Descriptions.Item label="Date">{assessment.date.slice(0, 10)}</Descriptions.Item>
          <Descriptions.Item label="Height / Weight">
            {assessment.height ?? '-'} cm / {assessment.weight ?? '-'} kg
          </Descriptions.Item>
          <Descriptions.Item label="BMI">{assessment.bmi ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Body Fat / Visceral Fat">
            {assessment.bodyFatPercent ?? '-'}% / {assessment.visceralFatLevel ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Blood Pressure">
            {assessment.systolicBp ?? '-'}/{assessment.diastolicBp ?? '-'} mmHg
          </Descriptions.Item>
          <Descriptions.Item label="Blood Glucose">{assessment.bloodGlucose ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Remarks">{assessment.remarks ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Handled By">{assessment.handledByPartner.name}</Descriptions.Item>
        </Descriptions>
      </div>
      <Tooltip title="PDF report generation is coming soon">
        <Button disabled>Download PDF</Button>
      </Tooltip>
    </Card>
  )
}
