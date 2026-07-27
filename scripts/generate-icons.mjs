// Rasterizes public/icon.svg into the PWA icon set. Runs automatically before
// `next build` (prebuild), so deploys never depend on committed binaries.
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const svg = readFileSync(join(publicDir, 'icon.svg'), 'utf8')
// Maskable and apple-touch icons must fill the whole canvas (no transparent
// rounded corners) — the platform applies its own mask.
const fullBleed = svg.replace('rx="12"', 'rx="0"')

const jobs = [
  { src: svg, size: 192, out: 'icon-192.png' },
  { src: svg, size: 512, out: 'icon-512.png' },
  { src: fullBleed, size: 512, out: 'icon-maskable-512.png' },
  { src: fullBleed, size: 180, out: 'apple-touch-icon.png' },
]

for (const { src, size, out } of jobs) {
  await sharp(Buffer.from(src), { density: (72 * size) / 64 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, out))
  console.log(`icons: wrote ${out} (${size}x${size})`)
}
