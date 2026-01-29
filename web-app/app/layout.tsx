import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MYGO SAP AI Assistant',
  description: 'AI-Powered SAP Intelligence',
}

import { ThemeProvider } from '@/context/ThemeContext'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

