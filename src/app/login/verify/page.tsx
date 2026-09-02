'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'

export default function VerifyPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: { token: string }) => {
    setError(null)
    const res = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Invalid code')
      return
    }
    router.push('/dashboard')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={4}>Enter your authenticator code</Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="token" label="6-digit code" rules={[{ required: true, len: 6 }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Log in
          </Button>
        </Form>
      </Card>
    </div>
  )
}
