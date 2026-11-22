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

function flatRowText(items: PdfTextItem[]): string {
  return itemsToLines(items).join('\n')
}

function withoutDevanagari(items: PdfTextItem[]): PdfTextItem[] {
  return items.filter((it) => {
    const s = it.str.trim()
    if (!s) return false
    const dev = (s.match(/[\u0900-\u097F]/g) || []).length
    return dev / s.length < 0.15
  })
}

/**
 * Score how "English MCQ" a column looks.
 * Hindi (Devanagari or Latin mojibake) scores low.
 */
export function englishMcqScore(text: string): number {
  if (!text || text.length < 20) return -100
  const cues = (
    text.match(
      /\b(?:The|If|In|Find|What|How|Then|Their|Numbers?|LCM|HCF|Sum|Product|Difference|Between|Times|Digits?|Positive|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Which|Among|Equal|Ratio|Average|Given|When|After|While|Using|Division|Quotient|Divisor)\b/g,
    ) || []
  ).length
  const opts = (text.match(/\(\s*[a-dA-D]\s*\)/g) || []).length
  const qNums = (text.match(/(?:^|\n)\s*\d{1,2}\s*[.)]\s+/g) || []).length
  const dev = (text.match(/[\u0900-\u097F]/g) || []).length
  const tokens = text.split(/\s+/).filter(Boolean)
  const shortJunk = tokens.filter(
    (t) =>
      /^[A-Za-z]{1,3}$/.test(t) &&
      !/^(a|an|the|of|or|to|is|in|if|on|at|by|as|be|it|no|so|do|we|he|me|my|up|its|for|and|are|was|has|had|not|but|one|two|sum|lcm|hcf|x|y)$/i.test(
        t,
      ),
  ).length
  return (
    cues * 8 +
    Math.min(opts, 16) * 5 +
    Math.min(qNums, 12) * 6 -
    dev * 2 -
    shortJunk * 3
  )
}

/** Split page into vertical columns using large X gaps. */
function columnsByGaps(items: PdfTextItem[]): PdfTextItem[][] {
  if (!items.length) return []
  if (items.length < 8) return [items]
  const sorted = [...items].sort((a, b) => a.x - b.x || b.y - a.y)
  const widths = sorted.map((it) => it.w).filter((w) => w > 0).sort((a, b) => a - b)
  const medianW = widths[Math.floor(widths.length / 2)] || 8
  const minX = sorted[0].x
  const maxX = Math.max(...sorted.map((i) => i.x + i.w))
  const pageSpan = Math.max(1, maxX - minX)
  const threshold = Math.max(18, medianW * 1.6, pageSpan * 0.04)

  const gaps: Array<{ i: number; gap: number }> = []
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w)
    if (gap >= threshold) gaps.push({ i, gap })
  }
  gaps.sort((a, b) => b.gap - a.gap)
  const cuts = gaps
    .slice(0, 4)
    .map((g) => g.i)
    .sort((a, b) => a - b)

  if (!cuts.length) {
    // Equal bands fallback (2 then 3)
    return equalBands(items, 2)
  }

  const cols: PdfTextItem[][] = []
  let start = 0
  for (const cut of cuts) {
    const slice = sorted.slice(start, cut)
    if (slice.length >= 4) cols.push(slice)
    start = cut
  }
  const last = sorted.slice(start)
  if (last.length >= 4) cols.push(last)
  return cols.length ? cols : [items]
}

function equalBands(items: PdfTextItem[], colCount: number): PdfTextItem[][] {
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
  return cols.filter((c) => c.length >= 4)
}

/** Leftmost fraction of the page (Champion English is almost always left). */
function leftFraction(items: PdfTextItem[], frac: number): PdfTextItem[] {
  if (!items.length) return []
  const minX = Math.min(...items.map((i) => i.x))
  const maxX = Math.max(...items.map((i) => i.x + i.w))
  const cut = minX + Math.max(1, maxX - minX) * frac
  return items.filter((it) => it.x + it.w * 0.35 <= cut)
}

export type PageTextVariants = {
  primary: string
  variants: string[]
  itemCount: number
  charCount: number
}

/**
 * Build English-only column variants.
 * Never concatenates adjacent columns (that mixes Qs / Hindi bleed).
 */
export function textContentToVariants(textContent: {
  items: unknown[]
}): PageTextVariants {
  const items = collectItems(textContent)
  if (!items.length) {
    return { primary: '', variants: [], itemCount: 0, charCount: 0 }
  }

  const latin = withoutDevanagari(items)
  const base = latin.length >= 8 ? latin : items

  const scoredCols: Array<{ t: string; s: number }> = []
  const seen = new Set<string>()
  const addCol = (colItems: PdfTextItem[]) => {
    if (colItems.length < 4) return
    const t = flatRowText(colItems).trim()
    if (t.length < 40 || seen.has(t)) return
    seen.add(t)
    scoredCols.push({ t, s: englishMcqScore(t) })
  }

  for (const col of columnsByGaps(base)) addCol(col)
  for (const col of equalBands(base, 2)) addCol(col)
  for (const col of equalBands(base, 3)) addCol(col)
  addCol(leftFraction(base, 0.42))
  addCol(leftFraction(base, 0.5))
  addCol(leftFraction(base, 0.55))

  scoredCols.sort((a, b) => b.s - a.s)

  // Keep only columns that look like English MCQs
  const englishish = scoredCols.filter((c) => c.s > 0)
  const pool = englishish.length ? englishish : scoredCols.slice(0, 2)

  const variants = pool.map((c) => c.t)
  const primary = pool[0]?.t || flatRowText(leftFraction(base, 0.5)) || ''

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
