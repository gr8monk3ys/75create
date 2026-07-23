import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Instrument_Sans, Space_Mono } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/components/AppProvider'
import StyledJsxRegistry from '@/components/StyledJsxRegistry'

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

export const metadata: Metadata = {
  title: '75 Create — 75 days of creative discipline',
  description:
    'A free, zero-friction tracker for a 75-day creative challenge. One mark a day. Keep the streak, log the work, and walk away with 75 days of proof.',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#efe9dc',
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
          <AppProvider>{children}</AppProvider>
        </StyledJsxRegistry>
      </body>
    </html>
  )
}
