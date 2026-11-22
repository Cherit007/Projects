/** Client-side OCR — English column crop for bilingual exam pages. */

type TessWorker = {
  recognize: (
    image: HTMLCanvasElement | HTMLImageElement | string,
  ) => Promise<{ data: { text: string } }>
  terminate: () => Promise<void>
}

let workerPromise: Promise<TessWorker> | null = null

async function getWorker(onProgress?: (pct: number) => void): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            onProgress?.(Math.round(m.progress * 100))
          }
        },
      })
      return worker as unknown as TessWorker
    })()
  }
  return workerPromise
}

/** Crop the left English column (Champion bilingual layout). */
export function cropEnglishColumn(
  canvas: HTMLCanvasElement,
  fraction = 0.48,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(canvas.width * Math.min(0.7, Math.max(0.35, fraction))))
  const h = canvas.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(canvas, 0, 0, w, h, 0, 0, w, h)
  }
  return out
}

export async function ocrCanvasToText(
  canvas: HTMLCanvasElement,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const maxW = 1400
  const scale = Math.min(1, maxW / Math.max(1, canvas.width))
  let source = canvas
  if (scale < 0.95) {
    const off = document.createElement('canvas')
    off.width = Math.max(1, Math.round(canvas.width * scale))
    off.height = Math.max(1, Math.round(canvas.height * scale))
    const ctx = off.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, off.width, off.height)
      ctx.drawImage(canvas, 0, 0, off.width, off.height)
      source = off
    }
  }

  onProgress?.(5)
  const worker = await getWorker(onProgress)
  const result = await worker.recognize(source)
  onProgress?.(100)
  return (result.data?.text || '').replace(/\r/g, '').trim()
}

/** Accurate path: OCR only the English (left) column of a rendered page. */
export async function ocrEnglishColumn(
  pageCanvas: HTMLCanvasElement,
  onProgress?: (pct: number) => void,
  fraction = 0.48,
): Promise<string> {
  const crop = cropEnglishColumn(pageCanvas, fraction)
  return ocrCanvasToText(crop, onProgress)
}
