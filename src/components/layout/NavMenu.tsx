'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Tooltip } from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  ScanOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { PermissionSet } from '@/lib/permissions'

export interface NavMenuProps {
  permissions: Partial<PermissionSet>
  /** Called after any navigable item is clicked — used to close the mobile drawer. */
  onNavigate?: () => void
}

export function NavMenu({ permissions, onNavigate }: NavMenuProps) {
  const pathname = usePathname()

  const items = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: <Link href="/dashboard">Dashboard</Link> },
    {
      key: 'health-assessment',
      icon: <FileTextOutlined />,
      label: 'Health Assessment',
      children: [
        { key: '/health-assessment/form', label: <Link href="/health-assessment/form">Form</Link> },
        { key: '/health-assessment/result', label: <Link href="/health-assessment/result">Result</Link> },
        {
          key: '/health-assessment/measurement',
          label: <Link href="/health-assessment/measurement">Measurement</Link>,
        },
      ],
    },
    {
      key: 'skin-analysis',
      icon: <ScanOutlined />,
      disabled: true,
      label: (
        <Tooltip title="Coming soon">
          <span>Skin Analysis</span>
        </Tooltip>
      ),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      children: [
        { key: '/settings/profile', label: <Link href="/settings/profile">My Profile</Link> },
        ...(permissions.manageRoles || permissions.managePartners
          ? [
              {
                key: '/settings/partners-roles',
                label: <Link href="/settings/partners-roles">Brand Partners &amp; Roles</Link>,
              },
            ]
          : []),
      ],
    },
  ]

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[pathname]}
      defaultOpenKeys={['health-assessment', 'settings']}
      items={items}
      onClick={() => onNavigate?.()}
      style={{ background: 'transparent', borderInlineEnd: 'none' }}
    />
  )
}
