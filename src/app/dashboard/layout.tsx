import type { Metadata } from 'next'

// Sets its own template too, so child routes (Share) keep the site suffix.
export const metadata: Metadata = { title: { default: 'Today', template: '%s · 75 Create' } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
