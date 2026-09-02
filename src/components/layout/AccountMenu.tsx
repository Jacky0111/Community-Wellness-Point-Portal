'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, Dropdown } from 'antd'
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
      {/*
        Deliberately a plain flex div, not AntD's <Space>: Space wraps each child in
        its own `.ant-space-item` div that doesn't inherit `min-width: 0`, so a flex
        item never shrinks below its content's intrinsic width — the ellipsis on the
        label span below would never actually trigger, and the row would instead get
        hard-clipped by the header's outer `overflow: hidden` with no "…" marker. A
        plain div under our own control lets `min-width: 0` reach the label so it
        truncates properly, and the label is fully hidden below 420px so only the
        avatar + chevron remain (still enough to open the dropdown) rather than
        showing an unreadably short fragment of the name.
      */}
      <div
        className="account-menu-trigger"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          overflow: 'hidden',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        <Avatar size="small" style={{ backgroundColor: '#2563EB', flexShrink: 0 }}>
          {initialsFor(partnerName)}
        </Avatar>
        <span
          className="account-menu-label"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: '1 1 auto',
          }}
        >
          Hello, {partnerName}
        </span>
        <DownOutlined style={{ fontSize: 10, flexShrink: 0 }} />
        <style>{`
          @media (max-width: 420px) {
            .account-menu-label {
              display: none;
            }
          }
        `}</style>
      </div>
    </Dropdown>
  )
}
