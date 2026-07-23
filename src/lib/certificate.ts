// Renders a shareable Day-75 certificate to a PNG on a canvas. No artifacts are
// drawn unless the owner opts in (design spec §6, F7).

import { DayState } from './types'

export interface CertData {
  dayStates: DayState[]
  longest: number
  completedDays: number
  totalMinutes: number
  medium: string
  startDate: string
}

const COLORS: Record<string, { paper: string; ink: string; sub: string; line: string; cobalt: string; coral: string; marigold: string; missed: string }> = {
  light: {
    paper: '#efe9dc',
    ink: '#1b1a17',
    sub: '#8a8274',
    line: '#d6ccb8',
    cobalt: '#2340d8',
    coral: '#f5462d',
    marigold: '#e0910f',
    missed: '#cdbfa6',
  },
}

export function generateCertificate(data: CertData): Promise<Blob> {
  const W = 1200
  const H = 750
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const c = COLORS.light

  // background
  ctx.fillStyle = c.paper
  ctx.fillRect(0, 0, W, H)

  // dotted texture
  ctx.fillStyle = c.line
  for (let y = 22; y < H; y += 26) {
    for (let x = 22; x < W; x += 26) {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // border
  ctx.strokeStyle = c.ink
  ctx.lineWidth = 3
  ctx.strokeRect(30, 30, W - 60, H - 60)

  // eyebrow
  ctx.fillStyle = c.sub
  ctx.font = '600 20px monospace'
  ctx.fillText('75 CREATE · CERTIFICATE OF COMPLETION', 70, 100)

  // title
  ctx.fillStyle = c.ink
  ctx.font = '800 88px sans-serif'
  ctx.fillText('75 days, made.', 68, 190)

  // subtitle
  ctx.fillStyle = c.sub
  ctx.font = '400 26px sans-serif'
  ctx.fillText(
    `A 75-day ${data.medium} challenge, started ${data.startDate}.`,
    70,
    236,
  )

  // stats
  const stats: [string, string][] = [
    [String(data.completedDays), 'days completed'],
    [String(data.longest), 'longest streak'],
    [`${data.totalMinutes.toLocaleString()}+`, 'minutes created'],
  ]
  let sx = 70
  stats.forEach(([big, label]) => {
    ctx.fillStyle = c.cobalt
    ctx.font = '800 64px sans-serif'
    ctx.fillText(big, sx, 340)
    ctx.fillStyle = c.sub
    ctx.font = '600 18px monospace'
    ctx.fillText(label.toUpperCase(), sx, 372)
    sx += 320
  })

  // the grid mosaic
  const cols = 15
  const gap = 6
  const cell = 44
  const gridW = cols * cell + (cols - 1) * gap
  const gx = (W - gridW) / 2
  const gy = 420
  data.dayStates.forEach((state, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = gx + col * (cell + gap)
    const y = gy + row * (cell + gap)
    if (state === 'complete') {
      ctx.fillStyle = c.cobalt
      ctx.fillRect(x, y, cell, cell)
    } else if (state === 'skipped') {
      ctx.fillStyle = c.marigold
      ctx.fillRect(x, y, cell, cell)
    } else if (state === 'missed') {
      ctx.fillStyle = c.missed
      ctx.fillRect(x, y, cell, cell)
    } else {
      ctx.strokeStyle = c.line
      ctx.lineWidth = 1.5
      ctx.strokeRect(x, y, cell, cell)
    }
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not render certificate.'))),
      'image/png',
    )
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
