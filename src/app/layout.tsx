import type { ReactNode } from 'react'
import { AntdRegistry } from '@ant-design/nextjs-registry'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  )
}
