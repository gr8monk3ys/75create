import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="page-message">
      <span className="eyebrow">Nothing here</span>
      <h1 className="font-display">That page doesn’t exist.</h1>
      <p>The link may be old, or the address may have a typo in it.</p>
      <Link href="/" className="btn">
        Back to the start
      </Link>
    </main>
  )
}
