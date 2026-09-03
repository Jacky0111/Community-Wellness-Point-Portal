'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Modal, Form, Input, Select, Space, Alert, Typography } from 'antd'
import { redirectIfUnauthorized } from '@/lib/clientAuth'

interface RoleOption {
  id: string
  name: string
}

interface PartnerRow {
  id: string
  name: string
  email: string
  isActive: boolean
  role: RoleOption
}

export function PartnersPanel() {
  const router = useRouter()
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  // Holds the newly-invited partner's one-time credential so it can be shown in
  // a modal the admin must explicitly dismiss, rather than a message.success()
  // toast that auto-dismisses in a few seconds — this is a credential someone
  // needs time to write down or copy, not a transient status update.
  const [credential, setCredential] = useState<{ name: string; email: string; temporaryPassword: string } | null>(
    null
  )

  const load = () => {
    setLoading(true)
    return Promise.all([
      fetch('/api/partners')
        .then((res) => {
          if (redirectIfUnauthorized(res, router)) return null
          return res.json()
        })
        .then((data) => data && setPartners(data.partners ?? [])),
      fetch('/api/roles')
        .then((res) => {
          if (redirectIfUnauthorized(res, router)) return null
          return res.json()
        })
        .then((data) => data && setRoles(data.roles ?? [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openInvite = () => {
    setSubmitError(null)
    form.resetFields()
    setModalOpen(true)
  }

  const onInvite = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (redirectIfUnauthorized(res, router)) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(typeof data.error === 'string' ? data.error : 'Could not invite brand partner')
        return
      }
      setModalOpen(false)
      setCredential({ name: values.name, email: values.email, temporaryPassword: data.temporaryPassword })
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (partner: PartnerRow) => {
    setToggleError(null)
    const res = await fetch(`/api/partners/${partner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !partner.isActive }),
    })
    if (redirectIfUnauthorized(res, router)) return
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setToggleError(typeof data.error === 'string' ? data.error : 'Could not update brand partner')
      return
    }
    await load()
  }

  return (
    <div>
      {toggleError && (
        <Alert
          type="error"
          message={toggleError}
          closable
          onClose={() => setToggleError(null)}
          style={{ marginBottom: 16 }}
        />
      )}
      <Button type="primary" onClick={openInvite} style={{ marginBottom: 16 }}>
        Invite Brand Partner
      </Button>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={partners}
        scroll={{ x: true }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Role', render: (_: unknown, r: PartnerRow) => r.role.name },
          { title: 'Active', render: (_: unknown, r: PartnerRow) => (r.isActive ? 'Yes' : 'No') },
          {
            title: 'Actions',
            render: (_: unknown, r: PartnerRow) => (
              <Space>
                <Button size="small" onClick={() => toggleActive(r)}>
                  {r.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={modalOpen}
        title="Invite Brand Partner"
        onCancel={() => setModalOpen(false)}
        onOk={onInvite}
        confirmLoading={submitting}
        destroyOnClose
      >
        {submitError && <Alert type="error" message={submitError} style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roleId" label="Role" rules={[{ required: true }]}>
            <Select options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={credential !== null}
        title="Brand partner invited"
        onOk={() => setCredential(null)}
        onCancel={() => setCredential(null)}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="Done — I've saved this"
        closable={false}
        maskClosable={false}
      >
        {credential && (
          <>
            <Typography.Paragraph>
              <strong>{credential.name}</strong> ({credential.email}) has been invited. Share this
              one-time temporary password with them now — it will not be shown again.
            </Typography.Paragraph>
            <Typography.Paragraph copyable={{ text: credential.temporaryPassword }} code>
              {credential.temporaryPassword}
            </Typography.Paragraph>
          </>
        )}
      </Modal>
    </div>
  )
}
