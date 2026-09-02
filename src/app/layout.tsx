import type { ReactNode } from 'react'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { BRAND } from '@/lib/theme'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: BRAND.pageBg }}>
        <AntdRegistry>
          <ThemeProvider>{children}</ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
