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

/** The landing's main call to action: starting one, or back to the one running. */
export function StartLink() {
  const { loading, user, challenge } = useApp()
  const running = !loading && user !== null && challenge !== null
  return (
    <Link href={running ? '/dashboard' : '/signin'} className="btn">
      {running ? 'Back to your grid' : 'Start my 75'}
    </Link>
  )
}
