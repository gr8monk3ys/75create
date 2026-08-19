import { describe, it, expect } from 'bun:test'
import {
  bytesToBase64Url,
  importVapidKey,
  vapidToken,
} from '../supabase/functions/_shared/vapid'

/** A VAPID key pair in the shape `npx web-push generate-vapid-keys` emits. */
async function generateKeys(): Promise<{
  publicKey: string
  privateKey: string
  verifyKey: CryptoKey
}> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return {
    publicKey: bytesToBase64Url(raw),
    privateKey: jwk.d!,
    verifyKey: pair.publicKey,
  }
}

function decodeSegment(segment: string): Record<string, unknown> {
  const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4)
  return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
}

describe('VAPID signing', () => {
  it('produces a token the push service can verify with the public key', async () => {
    const { publicKey, privateKey, verifyKey } = await generateKeys()
    const key = await importVapidKey(privateKey, publicKey)
    const token = await vapidToken(
      'https://fcm.googleapis.com',
      'mailto:hi@75create.app',
      key,
    )

    const [header, claims, signature] = token.split('.')
    expect(decodeSegment(header)).toEqual({ typ: 'JWT', alg: 'ES256' })

    const padded = signature + '='.repeat((4 - (signature.length % 4)) % 4)
    const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    const sigBytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) sigBytes[i] = binary.charCodeAt(i)
    // ES256 is a raw r||s pair, 64 bytes — not a DER-wrapped signature.
    expect(sigBytes.length).toBe(64)

    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      sigBytes,
      new TextEncoder().encode(`${header}.${claims}`),
    )
    expect(valid).toBe(true)
  })

  it('claims the push origin as the audience and expires within 24h', async () => {
    const { publicKey, privateKey } = await generateKeys()
    const key = await importVapidKey(privateKey, publicKey)
    const token = await vapidToken(
      'https://updates.push.services.mozilla.com',
      'mailto:hi@75create.app',
      key,
    )

    const claims = decodeSegment(token.split('.')[1])
    expect(claims.aud).toBe('https://updates.push.services.mozilla.com')
    expect(claims.sub).toBe('mailto:hi@75create.app')
    // RFC 8292 caps the lifetime at 24 hours; anything longer is rejected.
    const ttl = (claims.exp as number) - Math.floor(Date.now() / 1000)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(24 * 60 * 60)
  })

  it('rejects a public key that is not an uncompressed P-256 point', async () => {
    const { privateKey } = await generateKeys()
    await expect(importVapidKey(privateKey, 'dG9vLXNob3J0')).rejects.toThrow(
      /uncompressed P-256 point/,
    )
  })
})
