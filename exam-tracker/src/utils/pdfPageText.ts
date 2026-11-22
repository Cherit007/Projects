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

/** Drop real Devanagari glyphs (when the PDF encodes Hindi correctly). */
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
 * Hindi columns in these books are often wrong-encoded Latin mojibake —
 * they score low on real English cue words.
 */
function englishMcqScore(text: string): number {
  if (!text || text.length < 20) return -100
  const cues = (
    text.match(
      /\b(?:The|If|Find|What|How|Then|Their|Numbers?|LCM|HCF|Sum|Product|Difference|Between|Times|Digits?|Positive|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Which|Among|Equal|Ratio|Average)\b/g,
    ) || []
  ).length
  const opts = (text.match(/\(\s*[a-dA-D]\s*\)/g) || []).length
  const qNums = (text.match(/(?:^|\n)\s*\d{1,2}\s*[.)]\s+/g) || []).length
  const dev = (text.match(/[\u0900-\u097F]/g) || []).length
  // Mojibake Hindi often has many 1–3 letter "words"
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

function leftRightSplit(items: PdfTextItem[]): {
  left: PdfTextItem[]
  right: PdfTextItem[]
} {
  if (items.length < 8) return { left: items, right: [] }
  const xs = items.map((i) => i.x + i.w * 0.35).sort((a, b) => a - b)
  const mid = xs[Math.floor(xs.length / 2)]
  // Prefer a gap near the middle if one exists
  const sorted = [...items].sort((a, b) => a.x - b.x)
  let bestCut = mid
  let bestGap = 0
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w)
    const cutX = (sorted[i].x + sorted[i - 1].x + sorted[i - 1].w) / 2
    const nearMid = Math.abs(cutX - mid) < (xs[xs.length - 1] - xs[0]) * 0.28
    if (nearMid && gap > bestGap) {
      bestGap = gap
      bestCut = cutX
    }
  }
  const left: PdfTextItem[] = []
  const right: PdfTextItem[] = []
  for (const it of items) {
    const cx = it.x + it.w * 0.35
    if (cx <= bestCut) left.push(it)
    else right.push(it)
  }
  return { left, right }
}

export type PageTextVariants = {
  primary: string
  variants: string[]
  itemCount: number
  charCount: number
}

/** Build English-only reading variants — never keep the Hindi column. */
export function textContentToVariants(textContent: {
  items: unknown[]
}): PageTextVariants {
  const items = collectItems(textContent)
  if (!items.length) {
    return { primary: '', variants: [], itemCount: 0, charCount: 0 }
  }

  const latin = withoutDevanagari(items)
  const base = latin.length >= 8 ? latin : items
  const { left, right } = leftRightSplit(base)
  const leftText = flatRowText(left)
  const rightText = flatRowText(right)
  const leftScore = englishMcqScore(leftText)
  const rightScore = englishMcqScore(rightText)

  // Champion LCM/HCF pages: English left, Hindi right (mojibake or Devanagari)
  const englishCol =
    leftScore >= rightScore ? left : right.length >= 8 ? right : left
  const englishText = flatRowText(englishCol)

  const variants: string[] = []
  const push = (t: string) => {
    const s = t.trim()
    if (s.length >= 40 && !variants.includes(s)) variants.push(s)
  }

  push(englishText)
  push(colsToText(splitByBands(englishCol, 2)))
  push(colsToText(splitByGaps(englishCol)))
  // Also try pure left half (most Champion layouts)
  if (left !== englishCol) push(leftText)
  // 2-band of full latin page, then keep only the better-scoring band text
  const bands2 = splitByBands(base, 2)
  if (bands2.length >= 2) {
    const scored = bands2
      .map((col) => {
        const t = flatRowText(col)
        return { t, s: englishMcqScore(t) }
      })
      .sort((a, b) => b.s - a.s)
    push(scored[0].t)
  }
  const bands3 = splitByBands(base, 3)
  if (bands3.length >= 2) {
    const scored = bands3
      .map((col) => {
        const t = flatRowText(col)
        return { t, s: englishMcqScore(t) }
      })
      .sort((a, b) => b.s - a.s)
    // Top-scoring band only (skip Hindi bands)
    push(scored[0].t)
    if (scored[1] && scored[1].s > 20 && scored[1].s > scored[0].s * 0.7) {
      push(`${scored[0].t}\n\n${scored[1].t}`)
    }
  }

  const looksLikeMcq = (v: string) =>
    /\d{1,2}\s*[.)]/.test(v) && /\(\s*[a-dA-D]\s*\)/.test(v)

  const primary =
    [...variants].sort((a, b) => englishMcqScore(b) - englishMcqScore(a))[0] ||
    variants.find(looksLikeMcq) ||
    englishText ||
    variants[0] ||
    ''

  // Deduped list with primary first
  const ordered = [primary, ...variants.filter((v) => v !== primary)]

  return {
    primary,
    variants: ordered.filter(Boolean),
    itemCount: items.length,
    charCount: primary.length,
  }
}

export function textContentToPageText(textContent: {
  items: unknown[]
}): string {
  return textContentToVariants(textContent).primary
}

export { englishMcqScore }
