/** @type {import('next').NextConfig} */

// Everything the app talks to, so the CSP can be closed down to exactly that.
// Supabase is optional: when its URL isn't configured, the connect-src stays
// same-origin only.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null
const supabaseWs = supabaseOrigin ? supabaseOrigin.replace(/^https/, 'wss') : null
const errorEndpoint = process.env.NEXT_PUBLIC_ERROR_ENDPOINT

const connectSrc = ["'self'", supabaseOrigin, supabaseWs, errorEndpoint].filter(Boolean)

// script-src carries 'unsafe-inline' because every route here is statically
// prerendered: a nonce would require per-request rendering through middleware,
// which would cost the static export and the offline shell that depends on it.
// Fonts are self-hosted by next/font, so no external font or style host is
// needed, and the app makes no third-party requests at all.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self'",
  `connect-src ${connectSrc.join(' ')}`,
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // The app needs none of these; deny them rather than leave them ambient.
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
]

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // The worker must never be served stale, or a deploy can't roll out.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
