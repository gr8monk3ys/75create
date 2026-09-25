import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <main className="page-message">
      <h1 className="font-display">That page doesn’t exist.</h1>
      <p>The link may be old, or the address may have a typo in it.</p>
      <Link href="/" className="btn">
        Back to the start
      </Link>
    </main>
  )
}
