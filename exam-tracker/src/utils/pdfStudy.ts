/** Personal PDF study desk — files, ink, and named bookmarks (device-local). */

export type PdfTool = 'pen' | 'highlighter' | 'eraser' | 'hand'

export type PdfPoint = { x: number; y: number } // normalized 0–1

export type PdfStroke = {
  id: string
  page: number // 1-based
  tool: 'pen' | 'highlighter' | 'eraser'
  color: string
  /** Stroke width as fraction of page width */
  width: number
  points: PdfPoint[]
}

export type PdfBookmark = {
  id: string
  name: string
  page: number
  note?: string
  createdAt: string
}

export type PdfDocMeta = {
  id: string
  name: string
  sizeBytes: number
  pageCount: number | null
  lastPage: number
  zoom: number
  createdAt: string
  updatedAt: string
}

export type PdfDocBundle = {
  meta: PdfDocMeta
  blob: Blob
  strokes: PdfStroke[]
  bookmarks: PdfBookmark[]
}

export const PDF_PEN_COLORS = [
  '#0d6b5c',
  '#1d4ed8',
  '#b45309',
  '#9f1239',
  '#111827',
] as const

export const PDF_HIGHLIGHT_COLORS = [
  'rgba(250, 204, 21, 0.45)',
  'rgba(52, 211, 153, 0.4)',
  'rgba(96, 165, 250, 0.4)',
  'rgba(251, 113, 133, 0.4)',
] as const

export function newPdfId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: PdfStroke,
  widthPx: number,
  heightPx: number,
) {
  if (stroke.points.length < 2) return
  ctx.save()
  if (stroke.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply'
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = Math.max(8, stroke.width * widthPx)
    ctx.lineCap = 'square'
    ctx.lineJoin = 'round'
  } else if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = Math.max(12, stroke.width * widthPx)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = Math.max(1.5, stroke.width * widthPx)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
  ctx.beginPath()
  const first = stroke.points[0]
  ctx.moveTo(first.x * widthPx, first.y * heightPx)
  for (let i = 1; i < stroke.points.length; i += 1) {
    const p = stroke.points[i]
    ctx.lineTo(p.x * widthPx, p.y * heightPx)
  }
  ctx.stroke()
  ctx.restore()
}
