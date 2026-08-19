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
