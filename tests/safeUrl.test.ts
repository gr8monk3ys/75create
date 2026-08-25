import { describe, it, expect } from 'bun:test'
import { normalizeArtifactUrl, safeHref } from '@/lib/safeUrl'

describe('normalizeArtifactUrl', () => {
  it('accepts http and https links', () => {
    expect(normalizeArtifactUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(normalizeArtifactUrl('http://example.com/a')).toBe('http://example.com/a')
  })

  it('treats a bare host as https, which is what a pasted link means', () => {
    expect(normalizeArtifactUrl('example.com/work.png')).toBe(
      'https://example.com/work.png',
    )
  })

  it('rejects script-bearing schemes', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)  ',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(normalizeArtifactUrl(bad)).toBeNull()
    }
  })

  it('rejects empty and hostless input', () => {
    expect(normalizeArtifactUrl('')).toBeNull()
    expect(normalizeArtifactUrl('   ')).toBeNull()
    expect(normalizeArtifactUrl('https://')).toBeNull()
  })
})

describe('safeHref', () => {
  it('passes through links that are still safe', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com')
  })

  it('blocks unsafe values that were stored before validation existed', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('not a url')).toBeNull()
    expect(safeHref(undefined)).toBeNull()
  })
})

describe('decodeVapidKey', () => {
  it('decodes a base64url application server key to 65 bytes', async () => {
    const { decodeVapidKey } = await import('@/lib/push')
    const pair = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    let binary = ''
    for (const b of raw) binary += String.fromCharCode(b)
    const base64Url = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const decoded = decodeVapidKey(base64Url)
    expect(decoded.length).toBe(65)
    expect(decoded[0]).toBe(0x04)
    expect(Array.from(decoded)).toEqual(Array.from(raw))
  })
})
