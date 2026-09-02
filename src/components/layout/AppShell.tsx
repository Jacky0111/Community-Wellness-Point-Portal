'use client'

import { useEffect, useState } from 'react'
import { Layout, Grid, Drawer, Button } from 'antd'
import { MenuOutlined, HeartFilled, CloseOutlined } from '@ant-design/icons'
import { NavMenu } from './NavMenu'
import { AccountMenu } from './AccountMenu'
import { BRAND } from '@/lib/theme'
import type { PermissionSet } from '@/lib/permissions'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

export interface AppShellProps {
  partnerName: string
  permissions: Partial<PermissionSet>
  children: React.ReactNode
}

const sidebarGradient = `linear-gradient(180deg, ${BRAND.sidebarFrom} 0%, ${BRAND.sidebarTo} 100%)`

/**
 * Shared sidebar contents (logo lockup, nav menu, bottom tagline card) so the
 * desktop `Sider` and mobile `Drawer` branches stay visually identical instead
 * of drifting when only one gets updated.
 */
function SidebarContent({
  permissions,
  onNavigate,
}: {
  permissions: Partial<PermissionSet>
  onNavigate?: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 16px' }}>
        <div
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HeartFilled style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <span
          style={{
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Community Wellness Point
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <NavMenu permissions={permissions} onNavigate={onNavigate} />
      </div>

      <div style={{ padding: 16 }}>
        <div
          style={{
            borderRadius: BRAND.cardRadius,
            background: 'rgba(255, 255, 255, 0.12)',
            padding: 12,
            color: '#fff',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>Community Wellness Point</div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.75)', marginTop: 2 }}>
            Your Health, Our Priority
          </div>
        </div>
      </div>
    </div>
  )
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
          width={272}
          closeIcon={<CloseOutlined style={{ color: '#fff' }} />}
          styles={{
            body: { padding: 0, background: sidebarGradient },
            header: { background: sidebarGradient, borderBottom: 'none' },
            content: { background: sidebarGradient },
          }}
        >
          <SidebarContent permissions={permissions} onNavigate={closeDrawer} />
        </Drawer>
      )}
      {mounted && !isMobile && (
        <Sider width={240} style={{ background: sidebarGradient }}>
          <SidebarContent permissions={permissions} />
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fff',
            borderBottom: '1px solid #F0F0F0',
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
          <div
            style={{
              display: 'flex',
              overflow: 'hidden',
              maxWidth: '40%',
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            <AccountMenu partnerName={partnerName} />
          </div>
        </Header>
        <Content style={{ padding: 24, overflowX: 'auto', minWidth: 0 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}
