/** Rebuild readable page text from pdf.js TextContent (multi-column safe). */

export type PdfTextItem = {
  str: string
  x: number
  y: number
  w: number
  h: number
}

function itemGeom(it: {
  str?: string
  transform?: number[]
  width?: number
  height?: number
}): PdfTextItem | null {
  const str = typeof it.str === 'string' ? it.str : ''
  if (!str || !Array.isArray(it.transform) || it.transform.length < 6) return null
  const x = Number(it.transform[4]) || 0
  const y = Number(it.transform[5]) || 0
  const h = Math.abs(Number(it.transform[3]) || it.height || 10) || 10
  const w =
    typeof it.width === 'number' && it.width > 0
      ? it.width
      : Math.max(4, str.length * h * 0.45)
  return { str, x, y, w, h }
}

function collectItems(textContent: { items: unknown[] }): PdfTextItem[] {
  const items: PdfTextItem[] = []
  for (const raw of textContent.items || []) {
    if (!raw || typeof raw !== 'object') continue
    const g = itemGeom(
      raw as {
        str?: string
        transform?: number[]
        width?: number
        height?: number
      },
    )
    if (g && g.str.trim()) items.push(g)
  }
  return items
}

function joinLine(parts: PdfTextItem[], medianH: number): string {
  let text = ''
  for (let i = 0; i < parts.length; i += 1) {
    const cur = parts[i].str
    if (!cur) continue
    if (!text) {
      text = cur
      continue
    }
    const prev = text[text.length - 1] || ''
    const next = cur[0] || ''
    const prevItem = parts[i - 1]
    const gap = parts[i].x - (prevItem.x + prevItem.w)
    const tight =
      gap < Math.max(1.2, medianH * 0.2) ||
      /[√∛^_(\[{\\/×÷+\-=]$/.test(prev) ||
      /^[√∛^_)\]}\/×÷+\-=]/.test(next) ||
      (/\d$/.test(prev) && /^\d/.test(next)) ||
      (/[A-Za-z]$/.test(prev) &&
        /^[A-Za-z]/.test(next) &&
        gap < medianH * 0.4)
    text += tight ? cur : ` ${cur}`
  }
  return text.replace(/[ \t]+/g, ' ').trim()
}

function itemsToLines(items: PdfTextItem[]): string[] {
  if (!items.length) return []
  const byY = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const heights = byY.map((it) => it.h).sort((a, b) => a - b)
  const medianH = heights[Math.floor(heights.length / 2)] || 10
  const lineTol = Math.max(3.5, medianH * 0.6)

  const lines: Array<{ y: number; items: PdfTextItem[] }> = []
  for (const it of byY) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= lineTol)
    if (line) {
      line.items.push(it)
      line.y = (line.y * (line.items.length - 1) + it.y) / line.items.length
    } else {
      lines.push({ y: it.y, items: [it] })
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => joinLine(line.items.sort((a, b) => a.x - b.x), medianH))
    .filter(Boolean)
}

/** Equal-width column bands (best for Champion 2/3-col layouts). */
function splitByBands(items: PdfTextItem[], colCount: number): PdfTextItem[][] {
  if (colCount <= 1 || items.length < 8) return [items]
  const minX = Math.min(...items.map((i) => i.x))
  const maxX = Math.max(...items.map((i) => i.x + i.w))
  const span = Math.max(1, maxX - minX)
  const band = span / colCount
  const cols: PdfTextItem[][] = Array.from({ length: colCount }, () => [])
  for (const it of items) {
    const cx = it.x + it.w * 0.35
    let idx = Math.floor((cx - minX) / band)
    if (idx < 0) idx = 0
    if (idx >= colCount) idx = colCount - 1
    cols[idx].push(it)
  }
  return cols.filter((c) => c.length >= 3)
}

/** Gap-based column cuts. */
function splitByGaps(items: PdfTextItem[]): PdfTextItem[][] {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => a.x - b.x || b.y - a.y)
  const gaps: Array<{ i: number; gap: number }> = []
  for (let i = 1; i < sorted.length; i += 1) {
    gaps.push({
      i,
      gap: sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w),
    })
  }
  const widths = sorted.map((it) => it.w).filter((w) => w > 0).sort((a, b) => a - b)
  const medianW = widths[Math.floor(widths.length / 2)] || 8
  const threshold = Math.max(22, medianW * 1.8)
  const cuts = gaps
    .filter((g) => g.gap >= threshold)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)
    .map((g) => g.i)
    .sort((a, b) => a - b)
  if (!cuts.length) return [sorted]
  const cols: PdfTextItem[][] = []
  let start = 0
  for (const cut of cuts) {
    cols.push(sorted.slice(start, cut))
    start = cut
  }
  cols.push(sorted.slice(start))
  return cols.filter((c) => c.length)
}

function colsToText(cols: PdfTextItem[][]): string {
  return cols
    .map((col) => itemsToLines(col).join('\n'))
    .filter(Boolean)
    .join('\n\n')
}

function flatRowText(items: PdfTextItem[]): string {
  return itemsToLines(items).join('\n')
}

function rawJoinText(items: PdfTextItem[]): string {
  return items
    .slice()
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((i) => i.str)
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export type PageTextVariants = {
  /** Best-effort primary (3-band columns) */
  primary: string
  variants: string[]
  itemCount: number
  charCount: number
}

/** Build several reading-order variants; caller parses each and merges. */
export function textContentToVariants(textContent: {
  items: unknown[]
}): PageTextVariants {
  const items = collectItems(textContent)
  if (!items.length) {
    return { primary: '', variants: [], itemCount: 0, charCount: 0 }
  }

  const variants: string[] = []
  const push = (t: string) => {
    const s = t.trim()
    if (s.length >= 40 && !variants.includes(s)) variants.push(s)
  }

  push(colsToText(splitByBands(items, 3)))
  push(colsToText(splitByBands(items, 2)))
  push(colsToText(splitByGaps(items)))
  push(flatRowText(items))
  push(rawJoinText(items))

  const primary =
    variants.find((v) => /\n\s*\d{1,2}\s*[.)]/.test(v) || /\(\s*[a-dA-D]\s*\)/.test(v)) ||
    variants[0] ||
    ''

  return {
    primary,
    variants: variants.length ? variants : primary ? [primary] : [],
    itemCount: items.length,
    charCount: primary.length,
  }
}

export function textContentToPageText(textContent: {
  items: unknown[]
}): string {
  return textContentToVariants(textContent).primary
}
