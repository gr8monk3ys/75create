import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '75 Create',
    short_name: '75 Create',
    description: '75 days of creative discipline.',
    orientation: 'portrait',
    categories: ['productivity', 'lifestyle'],
    start_url: '/',
    display: 'standalone',
    // Must match the app's paper ground (globals.css --paper) and the
    // viewport themeColor, or the install splash flashes a different colour.
    background_color: '#efe9dc',
    theme_color: '#efe9dc',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
