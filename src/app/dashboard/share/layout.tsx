import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Share your grid' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
