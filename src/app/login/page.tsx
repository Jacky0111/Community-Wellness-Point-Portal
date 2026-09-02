'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: { email: string; password: string }) => {
    setError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Login failed')
      return
    }
    const routes: Record<string, string> = {
      'change-password': '/login/change-password',
      'mfa-enroll': '/login/enroll',
      'mfa-verify': '/login/verify',
    }
    router.push(routes[data.nextStep] ?? '/dashboard')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3}>Community Wellness Point</Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Log in
          </Button>
        </Form>
      </Card>
    </div>
  )
}
