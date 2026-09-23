'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'

export default function SignIn() {
  const { signIn, signInWithGoogle, supabaseEnabled, repo } = useApp()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function enter(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      const mode = await signIn(value)
      if (mode === 'magic-link-sent') {
        setSent(true)
        return
      }
      // Local mode: route based on whether an account already has a challenge.
      const hasChallenge = repo.getActiveChallenge() !== null
      router.push(hasChallenge ? '/dashboard' : '/setup')
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
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className="field-input input"
              />
            </label>
            <button type="submit" className="btn" disabled={busy}>
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
                onClick={google}
                disabled={busy}
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
          padding: 2rem;
        }
        .auth-h1 {
          font-size: 2rem;
          margin: 0.5rem 0 1.5rem;
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
