// Artifact links are typed by the user and later rendered as anchors. Anything
// that isn't a plain web URL — `javascript:`, `data:`, `vbscript:` — executes or
// renders in the page when clicked, so links are normalized through here before
// they are stored, and validated again before they are rendered.

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Normalize user input into a safe absolute http(s) URL, or null if it can't be
 * one. A bare `example.com/thing` is treated as https, which is what someone
 * pasting a link means.
 */
export function normalizeArtifactUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  const candidates = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw)
    ? [raw]
    : [`https://${raw}`]

  for (const candidate of candidates) {
    let parsed: URL
    try {
      parsed = new URL(candidate)
    } catch {
      continue
    }
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null
    if (!parsed.hostname) return null
    return parsed.toString()
  }
  return null
}

/**
 * Guard for rendering: returns the URL only if it is still safe to put in an
 * href. Applies to data stored before validation existed, and to rows synced
 * from another device.
 */
export function safeHref(url: string | undefined): string | null {
  if (!url) return null
  try {
    return ALLOWED_PROTOCOLS.has(new URL(url).protocol) ? url : null
  } catch {
    return null
  }
}
