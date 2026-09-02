'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Steps, Form, Input, InputNumber, DatePicker, Button, Alert, Space } from 'antd'
import dayjs from 'dayjs'
import { steps } from './fieldConfig'

export function AssessmentWizard() {
  const router = useRouter()
  const [current, setCurrent] = useState(0)
  const [form] = Form.useForm()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isLastStep = current === steps.length - 1

  const next = async () => {
    try {
      await form.validateFields(steps[current].fields.map((f) => f.key))
      setCurrent((c) => c + 1)
    } catch {
      // Validation failed: antd has already marked the offending fields on
      // this step, so just stay put instead of letting the rejection go
      // unhandled.
    }
  }

  const prev = () => setCurrent((c) => c - 1)

  const onFinish = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const values = form.getFieldsValue(true)
      const payload = {
        ...values,
        date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : undefined,
      }

      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        setError('Could not save this assessment. Please check the fields and try again.')
        return
      }
      router.push('/health-assessment/result')
    } catch {
      setError('Could not save this assessment. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, width: '100%' }}>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <Steps
          current={current}
          items={steps.map((s) => ({ title: s.title }))}
          responsive
          style={{ minWidth: 640 }}
        />
      </div>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={onFinish}>
        {steps.map((step, index) => (
          <div key={step.title} style={{ display: index === current ? 'block' : 'none' }}>
            {step.fields.map((field) => (
              <Form.Item
                key={field.key}
                name={field.key}
                label={field.label}
                rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
              >
                {field.type === 'number' ? (
                  <InputNumber style={{ width: '100%' }} />
                ) : field.type === 'date' ? (
                  <DatePicker style={{ width: '100%' }} />
                ) : (
                  <Input type={field.type} />
                )}
              </Form.Item>
            ))}
          </div>
        ))}
        <Space>
          {current > 0 && <Button onClick={prev}>Back</Button>}
          {!isLastStep && (
            <Button type="primary" onClick={next}>
              Next
            </Button>
          )}
          {isLastStep && (
            <Button type="primary" htmlType="submit" loading={submitting}>
              Save Assessment
            </Button>
          )}
        </Space>
      </Form>
    </div>
  )
}
