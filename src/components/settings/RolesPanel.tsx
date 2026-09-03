'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Modal, Form, Input, Checkbox, Space, Alert, Tooltip } from 'antd'
import { PERMISSION_KEYS, type PermissionKey } from '@/lib/permissions'
import { redirectIfUnauthorized } from '@/lib/clientAuth'

interface RoleRow {
  id: string
  name: string
  isSystemDefault: boolean
  permissions: Partial<Record<PermissionKey, boolean>>
}

// Source of truth for the permission set stays PERMISSION_KEYS (src/lib/permissions.ts).
// This map only supplies a human-readable label for each key — if a new
// permission is added there without a corresponding entry here, PERMISSION_LABELS[key]
// resolves to `undefined` and TypeScript's `Record<PermissionKey, string>` annotation
// makes that a compile error rather than a silently-shipped raw key like
// "viewAllAssessments" in the checkbox list.
const PERMISSION_LABELS: Record<PermissionKey, string> = {
  viewAllAssessments: 'View all assessments',
  manageRoles: 'Manage roles',
  managePartners: 'Manage brand partners',
  exportData: 'Export data',
  deleteRecords: 'Delete records',
}

export function RolesPanel() {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RoleRow | null>(null)
  const [form] = Form.useForm()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    return fetch('/api/roles')
      .then((res) => {
        if (redirectIfUnauthorized(res, router)) return null
        return res.json()
      })
      .then((data) => data && setRoles(data.roles ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setSubmitError(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (role: RoleRow) => {
    setEditing(role)
    setSubmitError(null)
    form.setFieldsValue({ name: role.name, ...role.permissions })
    setModalOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    const permissions = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Boolean(values[key])]))
    const body = JSON.stringify({ name: values.name, permissions })

    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(editing ? `/api/roles/${editing.id}` : '/api/roles', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (redirectIfUnauthorized(res, router)) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(typeof data.error === 'string' ? data.error : 'Could not save role')
        return
      }
      setModalOpen(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const [deleteError, setDeleteError] = useState<string | null>(null)

  const onDelete = async (role: RoleRow) => {
    setDeleteError(null)
    const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' })
    if (redirectIfUnauthorized(res, router)) return
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setDeleteError(typeof data.error === 'string' ? data.error : 'Could not delete role')
      return
    }
    await load()
  }

  return (
    <div>
      {deleteError && (
        <Alert
          type="error"
          message={deleteError}
          closable
          onClose={() => setDeleteError(null)}
          style={{ marginBottom: 16 }}
        />
      )}
      <Button type="primary" onClick={openCreate} style={{ marginBottom: 16 }}>
        New Role
      </Button>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={roles}
        scroll={{ x: true }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          {
            title: 'Permissions',
            render: (_: unknown, r: RoleRow) =>
              PERMISSION_KEYS.filter((k) => r.permissions[k])
                .map((k) => PERMISSION_LABELS[k])
                .join(', ') || '-',
          },
          {
            title: 'Actions',
            render: (_: unknown, r: RoleRow) => (
              <Space>
                <Tooltip title={r.isSystemDefault ? 'The default role always has full access and cannot be edited' : ''}>
                  <Button size="small" onClick={() => openEdit(r)} disabled={r.isSystemDefault}>
                    Edit
                  </Button>
                </Tooltip>
                <Tooltip title={r.isSystemDefault ? 'The default role cannot be deleted, to prevent a full lockout' : ''}>
                  <Button size="small" danger onClick={() => onDelete(r)} disabled={r.isSystemDefault}>
                    Delete
                  </Button>
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={modalOpen}
        title={editing ? 'Edit Role' : 'New Role'}
        onCancel={() => setModalOpen(false)}
        onOk={onSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        {submitError && (
          <Alert type="error" message={submitError} style={{ marginBottom: 16 }} />
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Role name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Wellness Champion" />
          </Form.Item>
          {PERMISSION_KEYS.map((key) => (
            <Form.Item key={key} name={key} valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>{PERMISSION_LABELS[key]}</Checkbox>
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  )
}
