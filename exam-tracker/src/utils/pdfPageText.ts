/** Rebuild readable page text from pdf.js TextContent (multi-column safe). */

export type PdfTextItem = {
  str: string
  x: number
  y: number
  w: number
  h: number
}

export type PdfTextLine = {
  text: string
  x: number
  y: number
  xMax: number
}

function itemGeom(it: {
  str?: string
  transform?: number[]
  width?: number
  height?: number
}): PdfTextItem | null {
  const str = typeof it.str === 'string' ? it.str : ''
  if (!str || !Array.isArray(it.transform) || it.transform.length < 6) return null
  const x = it.transform[4]
  const y = it.transform[5]
  const h = Math.abs(it.transform[3] || it.height || 10)
  const w = typeof it.width === 'number' ? it.width : str.length * h * 0.5
  return { str, x, y, w, h }
}

/** Cluster X positions into columns using large gaps. */
function splitColumns(items: PdfTextItem[]): PdfTextItem[][] {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => a.x - b.x || b.y - a.y)
  const gaps: Array<{ i: number; gap: number }> = []
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w)
    gaps.push({ i, gap })
  }
  const widths = sorted.map((it) => it.w).filter((w) => w > 0)
  const medianW =
    widths.sort((a, b) => a - b)[Math.floor(widths.length / 2)] || 8
  const threshold = Math.max(28, medianW * 2.2)

  const cuts = gaps
    .filter((g) => g.gap >= threshold)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3) // up to 4 columns
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

function itemsToLines(items: PdfTextItem[]): PdfTextLine[] {
  if (!items.length) return []
  const byY = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const heights = byY.map((it) => it.h).sort((a, b) => a - b)
  const medianH = heights[Math.floor(heights.length / 2)] || 10
  const lineTol = Math.max(3, medianH * 0.55)

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
    .map((line) => {
      const parts = line.items.sort((a, b) => a.x - b.x)
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
          gap < Math.max(1.2, medianH * 0.18) ||
          /[√∛^_(\[{\\/×÷+\-=]$/.test(prev) ||
          /^[√∛^_)\]}\/×÷+\-=]/.test(next) ||
          (/\d$/.test(prev) && /^\d/.test(next)) ||
          (/[A-Za-z]$/.test(prev) && /^[A-Za-z]/.test(next) && gap < medianH * 0.35)
        text += tight ? cur : ` ${cur}`
      }
      const x = parts[0]?.x ?? 0
      const xMax = parts.reduce((m, p) => Math.max(m, p.x + p.w), x)
      return { text: text.replace(/[ \t]+/g, ' ').trim(), x, y: line.y, xMax }
    })
    .filter((l) => l.text)
}

/**
 * Extract page text in reading order: left→right columns, top→bottom lines.
 * Returns newline-separated lines suitable for MCQ parsing.
 */
export function textContentToPageText(textContent: {
  items: unknown[]
}): string {
  const items: PdfTextItem[] = []
  for (const raw of textContent.items || []) {
    if (!raw || typeof raw !== 'object') continue
    const g = itemGeom(raw as { str?: string; transform?: number[]; width?: number; height?: number })
    if (g && g.str.trim()) items.push(g)
  }
  if (!items.length) return ''

  const cols = splitColumns(items)
  // Sort columns left→right by median x
  cols.sort((a, b) => {
    const ax = a.reduce((s, it) => s + it.x, 0) / a.length
    const bx = b.reduce((s, it) => s + it.x, 0) / b.length
    return ax - bx
  })

  const blocks = cols.map((col) => itemsToLines(col).map((l) => l.text).join('\n'))
  // Separate columns with blank lines so question regex sees clear starts
  return blocks.filter(Boolean).join('\n\n')
}
