'use client'

import { Card, Tabs, Empty } from 'antd'
import { RolesPanel } from './RolesPanel'
import { PartnersPanel } from './PartnersPanel'
import { BRAND } from '@/lib/theme'

export interface PartnersRolesTabsProps {
  canManageRoles: boolean
  canManagePartners: boolean
}

export function PartnersRolesTabs({ canManageRoles, canManagePartners }: PartnersRolesTabsProps) {
  if (!canManageRoles && !canManagePartners) {
    return (
      <Card style={{ borderRadius: BRAND.cardRadius }}>
        <Empty description="You don't have permission to manage brand partners or roles. Ask an admin to grant you access." />
      </Card>
    )
  }

  const items = [
    ...(canManagePartners
      ? [{ key: 'partners', label: 'Brand Partners', children: <PartnersPanel /> }]
      : []),
    ...(canManageRoles ? [{ key: 'roles', label: 'Roles', children: <RolesPanel /> }] : []),
  ]

  return (
    <Card style={{ borderRadius: BRAND.cardRadius }} styles={{ body: { padding: 24 } }}>
      <Tabs items={items} />
    </Card>
  )
}
