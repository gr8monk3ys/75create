import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppProvider } from '@/components/AppProvider'

export const metadata: Metadata = {
  title: '75 Create — 75 days of creative discipline',
  description:
    'A free, zero-friction tracker for a 75-day creative challenge. Check off daily tasks, keep a streak, and walk away with 75 days of documented work.',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0f0e17',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}
