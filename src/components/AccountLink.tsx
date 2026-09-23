'use client'

import Link from 'next/link'
import { useApp } from './AppProvider'

/** The landing nav's one action: straight to the grid when signed in. */
export function AccountLink() {
  const { loading, user } = useApp()
  const signedIn = !loading && user !== null
  return (
    <Link href={signedIn ? '/dashboard' : '/signin'} className="btn btn-ghost">
      {signedIn ? 'Your grid' : 'Sign in'}
    </Link>
  )
}
