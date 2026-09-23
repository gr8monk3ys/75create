import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Instrument_Sans, Space_Mono } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/components/AppProvider'
import StyledJsxRegistry from '@/components/StyledJsxRegistry'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import { ReminderScheduler } from '@/components/ReminderScheduler'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
})
const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
})
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

// Absolute base for Open Graph / Twitter image URLs. Without it Next falls
// back to http://localhost:3000 and every shared link previews a dead image.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: '75 Create — 75 days of creative discipline',
    // Each route names itself, so tabs, history and screen readers can tell
    // the pages apart.
    template: '%s · 75 Create',
  },
  description:
    'A free, zero-friction tracker for a 75-day creative challenge. One mark a day. Keep the streak, log the work, and walk away with 75 days of proof.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '75 Create',
  },
  openGraph: {
    title: '75 Create — 75 days of creative discipline',
    description:
      'A free, zero-friction tracker for a 75-day creative challenge. One mark a day. Keep the streak, log the work, and walk away with 75 days of proof.',
    siteName: '75 Create',
    type: 'website',
    images: [{ url: '/icon-512.png', width: 512, height: 512 }],
  },
}

export const viewport: Viewport = {
  // The browser chrome follows the page's own paper in both themes.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#efe9dc' },
    { media: '(prefers-color-scheme: dark)', color: '#15140f' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} ${spaceMono.variable}`}
    >
      <body>
        <StyledJsxRegistry>
          <AppProvider>
            {children}
            <ReminderScheduler />
          </AppProvider>
        </StyledJsxRegistry>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
