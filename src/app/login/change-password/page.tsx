'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: { newPassword: string }) => {
    setError(null)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Could not change password')
      return
    }
    router.push(data.nextStep === 'mfa-enroll' ? '/login/enroll' : '/login/verify')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={4}>Set a new password</Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="newPassword"
            label="New password"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Continue
          </Button>
        </Form>
      </Card>
    </div>
  )
}
