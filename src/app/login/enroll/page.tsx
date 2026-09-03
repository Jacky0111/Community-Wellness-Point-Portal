'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'
import { QRCodeSVG } from 'qrcode.react'

export default function EnrollPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    fetch('/api/auth/mfa/enroll')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Could not start MFA enrollment')
          setLoadFailed(true)
          return
        }
        setSecret(data.secret)
        setOtpauthUrl(data.otpauthUrl)
      })
      .catch(() => {
        setError('Could not reach the server. Check your connection and try again.')
        setLoadFailed(true)
      })
  }, [])

  const onFinish = async (values: { token: string }) => {
    setError(null)
    setSubmitting(true)
    try {
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
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '10vh 16px 0' }}>
      <Card style={{ width: 400, maxWidth: '100%' }}>
        <Typography.Title level={4}>Set up two-factor authentication</Typography.Title>
        {!loadFailed && (
          <>
            <Typography.Paragraph>
              Scan this into an authenticator app, or enter the secret manually:
            </Typography.Paragraph>
            {otpauthUrl && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                <div style={{ padding: 16, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                  <QRCodeSVG value={otpauthUrl} size={200} />
                </div>
              </div>
            )}
            <Typography.Text code>{secret}</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ wordBreak: 'break-all', marginTop: 8 }}>
              {otpauthUrl}
            </Typography.Paragraph>
          </>
        )}
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        {!loadFailed && (
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="token" label="6-digit code" rules={[{ required: true, len: 6 }]}>
              <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Verify and finish
            </Button>
          </Form>
        )}
      </Card>
    </div>
  )
}
