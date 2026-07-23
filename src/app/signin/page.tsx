'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'

export default function SignIn() {
  const { signIn, repo } = useApp()
  const router = useRouter()
  const [email, setEmail] = useState('')

  function enter(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    signIn(value)
    // Route based on whether an account already has a challenge.
    const hasChallenge = repo.getActiveChallenge() !== null
    router.push(hasChallenge ? '/dashboard' : '/setup')
  }

  return (
    <main className="auth">
      <Link href="/" className="wordmark font-display back">
        75 Create
      </Link>

      <div className="auth-card panel">
        <span className="eyebrow">Start or resume</span>
        <h1 className="font-display auth-h1">Sign in with your email</h1>

        <form onSubmit={enter} className="auth-form">
          <label className="field">
            <span className="field-label font-mono">Email</span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="input"
            />
          </label>
          <button type="submit" className="btn">
            Send magic link
          </button>
          <button
            type="button"
            className="btn btn-ghost google"
            onClick={() => {
              if (!email.trim()) setEmail('creative@example.com')
              const value = email.trim() || 'creative@example.com'
              signIn(value)
              router.push(repo.getActiveChallenge() ? '/dashboard' : '/setup')
            }}
          >
            Continue with Google
          </button>
        </form>

        <p className="proto-note font-mono">
          Prototype note: this build runs entirely in your browser. There&apos;s no
          server yet, so the magic link and Google button sign you in instantly and
          your challenge is saved locally on this device.
        </p>
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
          font-size: 1.2rem;
          text-decoration: none;
        }
        .auth-card {
          width: 100%;
          padding: 2rem;
        }
        .auth-h1 {
          font-size: 1.9rem;
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
        .field-label {
          font-size: 0.7rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .input {
          font-family: var(--font-body);
          font-size: 1rem;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
        }
        .input:focus {
          border-color: var(--cobalt);
          outline: none;
        }
        .google {
          border-style: solid;
        }
        .proto-note {
          margin-top: 1.5rem;
          font-size: 0.72rem;
          line-height: 1.6;
          color: var(--muted);
          border-top: 1.5px dashed var(--line);
          padding-top: 1rem;
        }
      `}</style>
    </main>
  )
}
