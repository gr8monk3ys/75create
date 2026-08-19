// VAPID (RFC 8292) request signing for Web Push, on WebCrypto only.
//
// Kept out of the function body so it can be unit-tested with `bun test`:
// getting the JWT wrong means every push is rejected, and that is not
// something you want to discover from a silent absence of reminders.

// ---------- encoding ----------

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function textToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

// ---------- VAPID ----------

/**
 * Import the raw P-256 private scalar as an ECDSA signing key. WebCrypto only
 * takes JWK or PKCS#8 for private keys, so the scalar is paired with the public
 * point into a JWK.
 */
export async function importVapidKey(
  privateKey: string,
  publicKey: string,
): Promise<CryptoKey> {
  const pub = base64UrlToBytes(publicKey)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point')
  }
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: privateKey,
    x: bytesToBase64Url(pub.slice(1, 33)),
    y: bytesToBase64Url(pub.slice(33, 65)),
    ext: true,
    key_ops: ['sign'],
  }
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

/** A VAPID JWT for one push origin, valid for 12 hours (the spec's maximum). */
export async function vapidToken(
  audience: string,
  subject: string,
  key: CryptoKey,
): Promise<string> {
  const header = textToBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const claims = textToBase64Url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: subject,
    }),
  )
  const signingInput = new TextEncoder().encode(`${header}.${claims}`)
  // WebCrypto returns the raw r||s pair, which is exactly what JWS ES256 wants.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signingInput,
  )
  return `${header}.${claims}.${bytesToBase64Url(new Uint8Array(signature))}`
}
