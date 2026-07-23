import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '75 Create',
    short_name: '75 Create',
    description: '75 days of creative discipline.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0e17',
    theme_color: '#0f0e17',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
