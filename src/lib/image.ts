// Client-side image compression. Keeping artifacts small is a hard requirement
// of the free-forever cost model (design spec §1), so every upload is downscaled
// and re-encoded before it is stored.

const MAX_DIMENSION = 1600
const MAX_BYTES = 5 * 1024 * 1024

export interface CompressResult {
  blob: Blob
  width: number
  height: number
}

export async function compressImage(file: File): Promise<CompressResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file isn’t an image.')
  }
  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Couldn’t process the image.')
  ctx.drawImage(bitmap, 0, 0, width, height)

  // Step quality down until under the size cap.
  let quality = 0.85
  let blob = await toBlob(canvas, quality)
  while (blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.15
    blob = await toBlob(canvas, quality)
  }
  if (blob.size > MAX_BYTES) {
    throw new Error('That image is too large even after compression (5 MB max).')
  }
  return { blob, width, height }
}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Couldn’t read that image.'))
    img.src = URL.createObjectURL(file)
  })
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Encoding failed.'))),
      'image/jpeg',
      quality,
    )
  })
}
