'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'

export default function SignIn() {
  const { signIn, signInWithGoogle, supabaseEnabled, loading, user, challenge } = useApp()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Signed in (just now, or already, or by a magic link opened in this tab):
  // there's nothing to do here. Go where the account's challenge is.
  useEffect(() => {
    if (!loading && user) router.replace(challenge ? '/dashboard' : '/setup')
  }, [loading, user, challenge, router])

  async function enter(e: React.FormEvent) {
    e.preventDefault()
    // Addresses are case-insensitive: Me@x.com and me@x.com are one account.
    const value = email.trim().toLowerCase()
    if (!value || busy || loading) return
    setBusy(true)
    setError('')
    try {
      const mode = await signIn(value)
      if (mode === 'magic-link-sent') setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    await signInWithGoogle() // redirects to Google
  }

  return (
    <main className="auth">
      <Link href="/" className="wordmark font-display back">
        75 Create
      </Link>

      <div className="auth-card panel">
        <h1 className="font-display auth-h1">
          {sent ? 'Check your email' : 'Sign in with your email'}
        </h1>

        {sent ? (
          <p className="sent-note">
            A magic link is on its way to <strong>{email.trim()}</strong>. Open it
            on this device to sign in — you can close this tab.
          </p>
        ) : (
          <form onSubmit={enter} className="auth-form">
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className="field-input input"
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn"
              // Stays focusable while sending, so focus never drops to the page.
              aria-disabled={busy || loading}
            >
              {supabaseEnabled
                ? busy
                  ? 'Sending…'
                  : 'Send magic link'
                : 'Continue on this device'}
            </button>
            {/* Only offered where it's real: without a backend there is no
                Google sign-in to continue with. */}
            {supabaseEnabled && (
              <button
                type="button"
                className="btn btn-ghost google"
                onClick={() => !busy && google()}
                aria-disabled={busy}
              >
                Continue with Google
              </button>
            )}
          </form>
        )}

        {supabaseEnabled ? (
          <p className="proto-note font-mono">
            Your challenge syncs across devices. Your artifacts stay private to
            your account.
          </p>
        ) : (
          <p className="proto-note font-mono">
            This build runs entirely in your browser: your email just names your
            challenge on this device, and everything is saved here. No account,
            no server, nothing sent anywhere.
          </p>
        )}
      </div>

      <style jsx>{`
        .auth {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          max-width: 480px;
        }
        .back {
          font-size: 1.25rem;
          text-decoration: none;
        }
        .auth-card {
          width: 100%;
          padding: min(2rem, 6vw);
        }
        .auth-h1 {
          font-size: 2rem;
          margin: 0.5rem 0 1.5rem;
        }
        .auth-error {
          margin: 0;
          color: var(--coral-ink);
          font-size: 0.875rem;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .input {
          padding: 0.8rem 1rem;
        }
        .google {
          border-style: solid;
        }
        .proto-note {
          margin-top: 1.5rem;
          font-size: 0.8rem;
          line-height: 1.6;
          color: var(--muted);
          border-top: 1.5px dashed var(--line);
          padding-top: 1rem;
        }
        .sent-note {
          color: var(--ink-soft);
          line-height: 1.6;
          margin: 0;
        }
      `}</style>
    </main>
  )
}
