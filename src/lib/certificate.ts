// Renders a shareable Day-75 certificate to a PNG on a canvas. No artifacts are
// drawn unless the owner opts in (design spec §6, F7).

import { DayState } from './types'
import { stampRotation } from './stamp'

export interface CertData {
  dayStates: DayState[]
  /** The headline, e.g. "75 days, made." (worded by the caller, true to the policy). */
  title: string
  longest: number
  completedDays: number
  /** Days with a written log. */
  logsWritten: number
  /** Images and links kept. */
  artifactsKept: number
  medium: string
  /** Already formatted for reading, e.g. "23 Sep 2026". */
  startDate: string
}

// The light printing of the tokens in globals.css: a certificate is paper.
const PALETTE = {
  paper: '#efe9dc',
  ink: '#1b1a17',
  sub: '#625b4e',
  line: '#d6ccb8',
  cobalt: '#2340d8',
  marigold: '#e0910f',
  onMarigold: '#1b1a17',
  missed: '#7d7463',
}

/** The page's own families (next/font), resolved from the CSS tokens. */
function families() {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    display: read('--font-display', 'sans-serif'),
    body: read('--font-body', 'sans-serif'),
    mono: read('--font-mono', 'monospace'),
  }
}

const COLS = 15
const CELL = 44
const GAP = 8
const GRID_TOP = 400
const MARGIN = 70

export async function generateCertificate(data: CertData): Promise<Blob> {
  const f = families()
  const fonts = {
    title: `800 88px ${f.display}`,
    stat: `800 64px ${f.display}`,
    sub: `400 26px ${f.body}`,
    label: `700 17px ${f.mono}`,
    mark: `700 28px ${f.mono}`,
    brand: `800 26px ${f.display}`,
  }
  // Draw only once the brand faces are in; a fallback face would be baked
  // into the image for good.
  if (document.fonts) {
    await Promise.all(Object.values(fonts).map((font) => document.fonts.load(font).catch(() => [])))
  }

  const rows = Math.ceil(data.dayStates.length / COLS)
  const W = 1200
  // The grid decides the height: an Extend challenge past 90 days still fits.
  const H = GRID_TOP + rows * (CELL + GAP) - GAP + 120
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = PALETTE.paper
  ctx.fillRect(0, 0, W, H)

  // The sketchbook dot grid.
  ctx.fillStyle = PALETTE.line
  for (let y = 22; y < H; y += 26) {
    for (let x = 22; x < W; x += 26) {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.strokeStyle = PALETTE.ink
  ctx.lineWidth = 3
  ctx.strokeRect(30, 30, W - 60, H - 60)

  // The title leads; no label line above it.
  ctx.fillStyle = PALETTE.ink
  ctx.font = fonts.title
  ctx.fillText(data.title, MARGIN - 2, 150)

  ctx.fillStyle = PALETTE.sub
  ctx.font = fonts.sub
  ctx.fillText(`A ${data.dayStates.length}-day ${data.medium} challenge, started ${data.startDate}.`, MARGIN, 200)

  // Only what was recorded: the app never measures time, so no minutes.
  const stats: [string, string][] = [
    [String(data.completedDays), 'days made'],
    [String(data.longest), 'longest streak'],
    [String(data.logsWritten), 'logs written'],
    [String(data.artifactsKept), 'pieces kept'],
  ]
  stats.forEach(([big, label], i) => {
    const sx = MARGIN + i * 265
    ctx.fillStyle = PALETTE.cobalt
    ctx.font = fonts.stat
    ctx.fillText(big, sx, 300)
    ctx.fillStyle = PALETTE.sub
    ctx.font = fonts.label
    ctx.fillText(label.toUpperCase(), sx, 332)
  })

  // The grid, in the app's own marks: rotated cobalt stamps, marigold skips
  // with a dash, a neutral hatch with a × for a miss, dotted days to come.
  const gridW = COLS * CELL + (COLS - 1) * GAP
  const gx = (W - gridW) / 2
  data.dayStates.forEach((state, i) => {
    const x = gx + (i % COLS) * (CELL + GAP)
    const y = GRID_TOP + Math.floor(i / COLS) * (CELL + GAP)
    ctx.save()
    ctx.translate(x + CELL / 2, y + CELL / 2)
    if (state === 'complete' || state === 'skipped') {
      ctx.rotate((stampRotation(i + 1) * Math.PI) / 180)
      ctx.fillStyle = state === 'complete' ? PALETTE.cobalt : PALETTE.marigold
      roundRect(ctx, -CELL / 2, -CELL / 2, CELL, CELL, 6)
      ctx.fill()
      if (state === 'skipped') mark(ctx, '–', PALETTE.onMarigold, fonts.mark)
    } else if (state === 'missed') {
      roundRect(ctx, -CELL / 2, -CELL / 2, CELL, CELL, 6)
      ctx.save()
      ctx.clip()
      ctx.strokeStyle = PALETTE.missed
      ctx.lineWidth = 2
      for (let d = -CELL; d < CELL * 2; d += 6) {
        ctx.beginPath()
        ctx.moveTo(-CELL / 2 + d, -CELL / 2)
        ctx.lineTo(-CELL / 2 + d - CELL, CELL / 2)
        ctx.stroke()
      }
      ctx.restore()
      ctx.strokeStyle = PALETTE.missed
      ctx.lineWidth = 2
      roundRect(ctx, -CELL / 2, -CELL / 2, CELL, CELL, 6)
      ctx.stroke()
      ctx.fillStyle = PALETTE.paper
      ctx.fillRect(-9, -11, 18, 22)
      mark(ctx, '×', PALETTE.ink, fonts.mark)
    } else {
      ctx.setLineDash([2, 3])
      ctx.strokeStyle = PALETTE.missed
      ctx.lineWidth = 1.5
      roundRect(ctx, -CELL / 2, -CELL / 2, CELL, CELL, 6)
      ctx.stroke()
    }
    ctx.restore()
  })

  // Signed at the foot, in the wordmark's face.
  ctx.fillStyle = PALETTE.ink
  ctx.font = fonts.brand
  ctx.textAlign = 'right'
  ctx.fillText('75 Create', W - MARGIN, H - 62)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not render certificate.'))),
      'image/png',
    )
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function mark(ctx: CanvasRenderingContext2D, glyph: string, color: string, font: string) {
  ctx.fillStyle = color
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, 0, 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
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
