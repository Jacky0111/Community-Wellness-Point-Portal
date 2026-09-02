'use client'

import { useEffect, useState } from 'react'
import { Layout, Grid, Drawer, Button } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { NavMenu } from './NavMenu'
import type { PermissionSet } from '@/lib/permissions'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

export interface AppShellProps {
  partnerName: string
  permissions: Partial<PermissionSet>
  children: React.ReactNode
}

export function AppShell({ partnerName, permissions, children }: AppShellProps) {
  const screens = useBreakpoint()

  // `useBreakpoint` reports all-false on the very first render (server and the
  // pre-hydration client render alike). Deciding mobile-vs-desktop from that
  // first render would either show the wrong nav briefly or mismatch between
  // server and client markup. Gate on a `mounted` flag: render neither the
  // Sider nor the Drawer until the real breakpoint is known (a very brief,
  // harmless gap with no nav), then swap in the correct one — no flash of an
  // incorrectly-sized nav, no hydration warning.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isMobile = !screens.md
  const [drawerOpen, setDrawerOpen] = useState(false)

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {mounted && isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={closeDrawer}
          styles={{ body: { padding: 0 } }}
        >
          <NavMenu permissions={permissions} onNavigate={closeDrawer} />
        </Drawer>
      )}
      {mounted && !isMobile && (
        <Sider width={240}>
          <NavMenu permissions={permissions} />
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fff',
            gap: 12,
            paddingInline: 16,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {mounted && isMobile && (
              <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} aria-label="Open navigation" />
            )}
            <span
              style={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Community Wellness Point
            </span>
          </span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '40%',
              flexShrink: 0,
            }}
          >
            {partnerName}
          </span>
        </Header>
        <Content style={{ padding: 24, overflowX: 'auto', minWidth: 0 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}
