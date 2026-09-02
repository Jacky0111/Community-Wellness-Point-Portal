'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'

export default function EnrollPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/mfa/enroll')
      .then((res) => res.json())
      .then((data) => {
        setSecret(data.secret)
        setOtpauthUrl(data.otpauthUrl)
      })
  }, [])

  const onFinish = async (values: { token: string }) => {
    setError(null)
    const res = await fetch('/api/auth/mfa/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, token: values.token }),
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
      <Card style={{ width: 400 }}>
        <Typography.Title level={4}>Set up two-factor authentication</Typography.Title>
        <Typography.Paragraph>
          Scan this into an authenticator app, or enter the secret manually:
        </Typography.Paragraph>
        <Typography.Text code>{secret}</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ wordBreak: 'break-all', marginTop: 8 }}>
          {otpauthUrl}
        </Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="token" label="6-digit code" rules={[{ required: true, len: 6 }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Verify and finish
          </Button>
        </Form>
      </Card>
    </div>
  )
}
