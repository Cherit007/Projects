/** Personal PDF study desk — files, ink, notes, layers, library meta. */

export type PdfTool =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'hand'
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'note'

export type PdfFitMode = 'width' | 'page' | 'actual'
export type PdfPaperTheme = 'day' | 'sepia' | 'night'
export type PdfShape = 'freehand' | 'rect' | 'ellipse' | 'line' | 'textHighlight'

export type PdfPoint = { x: number; y: number } // normalized 0–1

export type PdfLayer = {
  id: string
  name: string
  visible: boolean
  createdAt: string
}

export type PdfStroke = {
  id: string
  page: number // 1-based
  tool: 'pen' | 'highlighter' | 'eraser' | PdfShape
  color: string
  /** Stroke width as fraction of page width */
  width: number
  points: PdfPoint[]
  layerId?: string
  shape?: PdfShape
}

export type PdfBookmark = {
  id: string
  name: string
  page: number
  note?: string
  kind?: 'normal' | 'doubt'
  topicId?: string
  createdAt: string
}

export type PdfStickyNote = {
  id: string
  page: number
  x: number
  y: number
  text: string
  createdAt: string
}

export type PdfDocMeta = {
  id: string
  name: string
  sizeBytes: number
  pageCount: number | null
  lastPage: number
  zoom: number
  spread?: 'single' | 'double'
  folder?: string
  tags?: string[]
  theme?: PdfPaperTheme
  fitMode?: PdfFitMode
  /** 1-based pages the reader has opened */
  visitedPages?: number[]
  coverDataUrl?: string
  layers?: PdfLayer[]
  activeLayerId?: string
  createdAt: string
  updatedAt: string
}

export type PdfDocBundle = {
  meta: PdfDocMeta
  blob: Blob
  strokes: PdfStroke[]
  bookmarks: PdfBookmark[]
  notes: PdfStickyNote[]
}

export const PDF_FOLDERS = [
  'Mocks',
  'Notes',
  'PYQ',
  'Current affairs',
  'Unfiled',
] as const

export const DEFAULT_LAYER_ID = 'layer_main'

export function defaultLayers(now = new Date().toISOString()): PdfLayer[] {
  return [
    { id: DEFAULT_LAYER_ID, name: 'Main', visible: true, createdAt: now },
    {
      id: 'layer_revise',
      name: 'Revise',
      visible: true,
      createdAt: now,
    },
    {
      id: 'layer_final',
      name: 'Final',
      visible: true,
      createdAt: now,
    },
  ]
}

export function normalizeMeta(meta: PdfDocMeta): PdfDocMeta {
  const layers =
    meta.layers && meta.layers.length > 0 ? meta.layers : defaultLayers()
  return {
    ...meta,
    folder: meta.folder || 'Unfiled',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    theme: meta.theme || 'day',
    fitMode: meta.fitMode || 'width',
    visitedPages: Array.isArray(meta.visitedPages) ? meta.visitedPages : [],
    layers,
    activeLayerId: meta.activeLayerId || layers[0]?.id || DEFAULT_LAYER_ID,
  }
}

export function progressPct(meta: PdfDocMeta): number {
  const total = meta.pageCount || 0
  if (!total) return 0
  const seen = new Set(meta.visitedPages || []).size
  return Math.min(100, Math.round((seen / total) * 100))
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

function drawShapePath(
  ctx: CanvasRenderingContext2D,
  stroke: PdfStroke,
  widthPx: number,
  heightPx: number,
) {
  const shape = stroke.shape || 'freehand'
  const pts = stroke.points
  if (pts.length < 1) return

  if (shape === 'rect' || shape === 'textHighlight') {
    const a = pts[0]
    const b = pts[pts.length - 1]
    const x = Math.min(a.x, b.x) * widthPx
    const y = Math.min(a.y, b.y) * heightPx
    const w = Math.abs(b.x - a.x) * widthPx
    const h = Math.abs(b.y - a.y) * heightPx
    if (shape === 'textHighlight' || stroke.tool === 'highlighter') {
      ctx.fillStyle = stroke.color
      ctx.fillRect(x, y, Math.max(w, 2), Math.max(h, 8))
    } else {
      ctx.strokeRect(x, y, Math.max(w, 2), Math.max(h, 2))
    }
    return
  }

  if (shape === 'ellipse') {
    const a = pts[0]
    const b = pts[pts.length - 1]
    const cx = ((a.x + b.x) / 2) * widthPx
    const cy = ((a.y + b.y) / 2) * heightPx
    const rx = (Math.abs(b.x - a.x) / 2) * widthPx
    const ry = (Math.abs(b.y - a.y) / 2) * heightPx
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
    ctx.stroke()
    return
  }

  if (shape === 'line') {
    const a = pts[0]
    const b = pts[pts.length - 1]
    ctx.beginPath()
    ctx.moveTo(a.x * widthPx, a.y * heightPx)
    ctx.lineTo(b.x * widthPx, b.y * heightPx)
    ctx.stroke()
    return
  }

  // freehand
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x * widthPx, pts[0].y * heightPx)
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x * widthPx, pts[i].y * heightPx)
  }
  ctx.stroke()
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: PdfStroke,
  widthPx: number,
  heightPx: number,
) {
  if (stroke.points.length < 1) return
  ctx.save()
  const shape = stroke.shape || 'freehand'
  if (stroke.tool === 'highlighter' || shape === 'textHighlight') {
    ctx.globalCompositeOperation = 'multiply'
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
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
  drawShapePath(ctx, stroke, widthPx, heightPx)
  ctx.restore()
}
