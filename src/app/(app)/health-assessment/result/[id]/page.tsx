'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Alert, Card, Descriptions, Button, Tooltip, Skeleton } from 'antd'
import { BRAND } from '@/lib/theme'
import { redirectIfUnauthorized } from '@/lib/clientAuth'

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
  const router = useRouter()
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)
  const [error, setError] = useState<'not-found' | 'unknown' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/assessments/${id}`)
        if (redirectIfUnauthorized(res, router)) return
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? 'not-found' : 'unknown')
          return
        }
        const data = await res.json()
        if (!cancelled) setAssessment(data.assessment)
      } catch {
        if (!cancelled) setError('unknown')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, router])

  if (error === 'not-found') {
    return (
      <Alert
        type="error"
        showIcon
        message="Assessment not found"
        description="This record doesn't exist, or you don't have permission to view it."
      />
    )
  }

  if (error === 'unknown') {
    return (
      <Alert
        type="error"
        showIcon
        message="Couldn't load this assessment"
        description="Something went wrong fetching this record. Please refresh the page to try again."
      />
    )
  }

  if (loading || !assessment) return <Skeleton active />

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
