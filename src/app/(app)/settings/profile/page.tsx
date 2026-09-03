'use client'

import { useState } from 'react'
import { Card, Form, Input, Button, Alert, message } from 'antd'
import { BRAND } from '@/lib/theme'

export default function ProfilePage() {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const onFinish = async (values: { newPassword: string }) => {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not update password')
        return
      }
      message.success('Password updated')
      form.resetFields()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="My Profile" style={{ maxWidth: 420, borderRadius: BRAND.cardRadius }}>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="newPassword" label="New password" rules={[{ required: true, min: 8 }]}>
          <Input.Password />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting}>
          Update password
        </Button>
      </Form>
    </Card>
  )
}
