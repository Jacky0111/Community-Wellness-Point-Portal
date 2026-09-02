'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, Dropdown, Space } from 'antd'
import { DownOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

export interface AccountMenuProps {
  partnerName: string
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AccountMenu({ partnerName }: AccountMenuProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
    }
  }

  const items: MenuProps['items'] = [
    {
      key: 'profile',
      label: 'My Profile',
      icon: <UserOutlined />,
      onClick: () => router.push('/settings/profile'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: 'Log out',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ]

  return (
    <Dropdown menu={{ items }} trigger={['click']} disabled={loggingOut}>
      <Space
        style={{
          cursor: 'pointer',
          overflow: 'hidden',
          minWidth: 0,
          maxWidth: '100%',
        }}
        align="center"
      >
        <Avatar size="small" style={{ backgroundColor: '#2563EB', flexShrink: 0 }}>
          {initialsFor(partnerName)}
        </Avatar>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          Hello, {partnerName}
        </span>
        <DownOutlined style={{ fontSize: 10, flexShrink: 0 }} />
      </Space>
    </Dropdown>
  )
}
