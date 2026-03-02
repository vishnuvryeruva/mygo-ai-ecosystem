import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'

export const metadata: Metadata = {
  title: {
    default: 'YODA — AI-Powered SAP Intelligence',
    template: '%s — YODA',
  },
  description:
    'YODA is an AI-powered knowledge assistant for SAP ecosystems. Document Hub, Code Analysis, Spec Generation, and more.',
  keywords: ['SAP', 'AI', 'YODA', 'MYGO', 'knowledge assistant', 'ABAP', 'document hub'],
  authors: [{ name: 'MYGO Consulting' }],
  openGraph: {
    title: 'YODA — AI-Powered SAP Intelligence',
    description: 'AI-powered knowledge assistant for SAP ecosystems',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
