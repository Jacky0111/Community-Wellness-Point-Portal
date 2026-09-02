'use client'

import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { theme } from '@/lib/theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={theme}>{children}</ConfigProvider>
}
