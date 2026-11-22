import { tidyMathPlain } from './formatQuizMath'
import type {
  PdfDetectedQuestion,
  PdfDetectedSolution,
  PdfPageKind,
  PdfQuestionExtractResult,
  PdfQuizOptionKey,
} from './pdfPageQuiz'

const DEVANAGARI = /[\u0900-\u097F]/
const EXAM_TAG =
  /\b(?:SSC|IBPS|RRB|SBI|UPSC|BANK|RAILWAY)\s*(?:CGL|CHSL|PO|Clerk|MTS|GD|STENO|RRB)?\s*(?:MAINS?|PRE(?:LIMS?)?|TIER[- ]?[IVX0-9]+)?\s*(?:\d{4})?/gi
const EXAM_DATE =
  /\{?\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{4}\}?/gi
const EXAM_HEADER =
  /^(?:SSC|IBPS|RRB|SBI|UPSC|BANK|RAILWAY|CHSL|CGL|MTS|GD|STENO|TIER[- ]?[IVX0-9]+|MAINS?|PRE(?:LIM(?:S|INARY)?)?|SHIFT|SEPT?|OCT|NOV|DEC|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG)\b/i

/** Strip bilingual bleed / exam chrome that pollutes stems & options. */
export function scrubExamNoise(raw: string): string {
  return raw
    .replace(/[\u0900-\u097F]+/g, ' ')
    .replace(EXAM_TAG, ' ')
    .replace(EXAM_DATE, ' ')
    .replace(/\bTier[- ]?[IVX0-9]+\b/gi, ' ')
    .replace(/[®©§]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim()
}

/** Normalize pdf.js / OCR text into a single parseable string. */
export function normalizePageText(raw: string): string {
  return scrubExamNoise(raw)
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    // OCR spacing: "( a )" / "1 ." / "Q . 12"
    .replace(/\(\s*([a-dA-D])\s*\)/g, '($1)')
    .replace(/(?:^|\n)\s*(?:Q(?:ues(?:tion)?)?\s*)?(\d{1,3})\s+[.)]\s+/gi, '\n$1. ')
    .replace(/(?:^|\n)\s*Q\s*[.]\s*(\d{1,3})\s*[.)]?\s+/gi, '\n$1. ')
    .split('\n')
    .map((line) => tidyMathPlain(line.replace(/[ \t]+/g, ' ').trim()))
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function letterOf(raw: string): PdfQuizOptionKey | null {
  const c = raw.trim().toUpperCase().replace(/[^A-D1-4]/g, '')
  if (c === 'A' || c === '1') return 'A'
  if (c === 'B' || c === '2') return 'B'
  if (c === 'C' || c === '3') return 'C'
  if (c === 'D' || c === '4') return 'D'
  return null
}

function stripNoiseLines(block: string): string {
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false
      if (/^ANSWER\s*KEY/i.test(l)) return false
      if (/^CHAMPION/i.test(l)) return false
      if (/^Gagan\b/i.test(l)) return false
      if (/^page\s*\d+/i.test(l)) return false
      if (/^LCM\s*&\s*HCF/i.test(l) && l.length < 80) return false
      if (EXAM_HEADER.test(l) && l.length < 90 && !/[?]/.test(l)) return false
      // Drop lines that are almost entirely Devanagari / OCR junk
      const letters = (l.match(/[A-Za-z\u0900-\u097F]/g) || []).length
      const latin = (l.match(/[A-Za-z]/g) || []).length
      if (letters > 8 && latin / Math.max(1, letters) < 0.25) return false
      return true
    })
    .join('\n')
}

/** Prefer English stem; put Hindi into stemHi. */
export function splitBilingualStem(raw: string): {
  stem: string
  stemHi?: string
} {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !EXAM_HEADER.test(l) || DEVANAGARI.test(l) || /[?]/.test(l))

  const en: string[] = []
  const hi: string[] = []
  for (const line of lines) {
    if (
      EXAM_HEADER.test(line) &&
      !/[?]/.test(line) &&
      !DEVANAGARI.test(line) &&
      line.length < 90
    ) {
      continue
    }
    const devRatio =
      (line.match(/[\u0900-\u097F]/g) || []).length / Math.max(1, line.length)
    if (devRatio >= 0.22) hi.push(line)
    else en.push(line)
  }

  let stem = tidyMathPlain(
    scrubExamNoise(en.join(' ')).replace(/\s+/g, ' ').trim(),
  )
  let stemHi = hi.length
    ? hi.join(' ').replace(/\s+/g, ' ').trim()
    : undefined

  if (!stem && raw) {
    const cleaned = scrubExamNoise(raw)
    const m = cleaned.match(
      /^([\x00-\x7F\u0080-\u02FF\s\d.,;:!?()[\]{}+\-×÷=√^\/]+)(.*)$/u,
    )
    if (m) {
      stem = tidyMathPlain(m[1])
      const rest = m[2]?.trim()
      if (rest && DEVANAGARI.test(rest)) stemHi = rest
    } else {
      stem = tidyMathPlain(cleaned).slice(0, 500)
    }
  }

  if (stem && !stemHi) {
    const hiAt = stem.search(DEVANAGARI)
    if (hiAt > 12) {
      stemHi = stem.slice(hiAt).trim()
      stem = tidyMathPlain(stem.slice(0, hiAt))
    }
  }

  // Cut stem if a later question number leaked in
  const leak = stem.search(/\s\d{1,2}\s*[.)]\s+(?:The|If|Find|What|How|LCM|HCF|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b/i)
  if (leak > 24) stem = stem.slice(0, leak).trim()

  return { stem: stem || tidyMathPlain(scrubExamNoise(raw)).slice(0, 500), stemHi }
}

function cleanOptionText(raw: string): string {
  let t = scrubExamNoise(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => Boolean(l) && (!DEVANAGARI.test(l) || /[0-9A-Za-z(]/.test(l)))
    .join(' ')
  // Stop at next question / option bleed
  t = t.split(
    /\s(?=\d{1,2}\s*[.)]\s+(?:The|If|Find|What|How|LCM|HCF|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b)/i,
  )[0]
  t = t.split(/\s(?=[\(\[]?\s*[a-dA-D]\s*[\)\].:])/)[0]
  const hiAt = t.search(DEVANAGARI)
  if (hiAt > 0) t = t.slice(0, hiAt)
  // Maths options are usually short; truncate runaway OCR
  const cleaned = tidyMathPlain(t).trim()
  if (cleaned.length > 80 && /^[\d.,\-\/+×÷√^=\sA-Za-z()]{1,40}/.test(cleaned)) {
    const short = cleaned.match(/^[\d.,\-\/+×÷√^=\s]+|^[A-Za-z0-9][\w.\-\/+×÷√^=\s]{0,36}/)
    if (short) return short[0].trim().slice(0, 60)
  }
  return cleaned.slice(0, 120)
}

function findOptionHits(
  body: string,
): Array<{ letter: PdfQuizOptionKey; at: number; len: number }> {
  // Prefer classic "(a)" markers first (tighter for Champion packs)
  const patterns = [
    /(?:^|[\n\s])(\(\s*[a-dA-D]\s*\))\s*/g,
    /(?:^|[\n\s])([a-dA-D]\s*[\)\].:])\s*/g,
  ]
  const optHits: Array<{ letter: PdfQuizOptionKey; at: number; len: number }> =
    []
  for (const optRe of patterns) {
    let om: RegExpExecArray | null
    while ((om = optRe.exec(body)) != null) {
      const letter = letterOf(om[1])
      if (!letter) continue
      if (optHits.some((h) => h.letter === letter)) continue
      const before = body[om.index]
      if (before && /[A-Za-z0-9]/.test(before) && om[0].length < 3) continue
      optHits.push({ letter, at: om.index, len: om[0].length })
      if (optHits.length >= 4) break
    }
    if (optHits.length >= 4) break
  }
  return optHits.sort((a, b) => a.at - b.at)
}

function collectQuestionStarts(questionRegion: string) {
  const starts: Array<{ index: number; number: number }> = []
  const seenAt = new Set<number>()
  const push = (idx: number, number: number) => {
    if (!Number.isFinite(number) || number <= 0 || number > 300) return
    if ([...seenAt].some((s) => Math.abs(s - idx) < 3)) return
    seenAt.add(idx)
    starts.push({ index: idx, number })
  }

  const qSplit =
    /(?:^|\n)\s*(?:Q(?:ues(?:tion)?)?[\s.]*)?(\d{1,3})\s*[.)]\s+(?=[A-Za-z(\u0900-\u097F]|SSC|The|If|Find|What|How|LCM|HCF|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\()/gi
  let m: RegExpExecArray | null
  while ((m = qSplit.exec(questionRegion)) != null) {
    const idx = m.index + (m[0].startsWith('\n') ? 1 : 0)
    push(idx, Number(m[1]))
  }

  // Also catch mid-line numbered stems after column join (English cue words)
  const mid =
    /(?:^|[\n\s])(?:Q(?:ues(?:tion)?)?[\s.]*)?(\d{1,2})\s*[.)]\s+(?=The|If|Find|What|How|LCM|HCF|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b/gi
  while ((m = mid.exec(questionRegion)) != null) {
    const prev = questionRegion.slice(Math.max(0, m.index - 12), m.index)
    if (/[A-Za-z0-9]\s*$/.test(prev) && !/(?:^|\n)\s*$/.test(prev)) {
      // allow after option close: ") 5. The"
      if (!/[)\]]\s*$/.test(prev)) continue
    }
    push(m.index + (m[0].match(/^\s/) ? 1 : 0), Number(m[1]))
  }

  if (starts.length < 2) {
    const loose =
      /(?:^|\n|(?<=\s{2,})|(?<=[|;•]))\s*(?:Q(?:ues(?:tion)?)?[\s.]*)?(\d{1,2})\s*[.)]\s+/gi
    while ((m = loose.exec(questionRegion)) != null) {
      const number = Number(m[1])
      if (number <= 0 || number > 80) continue
      const idx = m.index
      const prev = questionRegion.slice(Math.max(0, idx - 16), idx)
      if (/[A-Za-z0-9]\s*$/.test(prev) && !/(?:^|\n)\s*$/.test(prev)) continue
      const window = questionRegion.slice(idx, idx + 700)
      if (!/\([a-dA-D]\)/.test(window) && !/\b[a-dA-D]\)/.test(window)) continue
      push(idx, number)
    }
  }

  return starts.sort((a, b) => a.index - b.index)
}

/**
 * Offline MCQ parse — SSC/banking multi-column bilingual pages.
 */
export function extractQuestionsFromPageText(
  pageText: string,
  sourcePage: number,
): PdfQuestionExtractResult {
  const text = normalizePageText(pageText)
  if (!text || text.length < 20) {
    return { pageKind: 'other', questions: [] }
  }

  const keySplit = text.split(/\n(?=ANSWER\s*KEY\b)/i)
  const questionRegion = keySplit[0] || text
  const keyRegion = keySplit.slice(1).join('\n')

  const starts = collectQuestionStarts(questionRegion)
  const questions: PdfDetectedQuestion[] = []
  const usedNumbers = new Set<number>()

  for (let i = 0; i < starts.length; i += 1) {
    const cur = starts[i]
    if (usedNumbers.has(cur.number)) continue
    const end = i + 1 < starts.length ? starts[i + 1].index : questionRegion.length
    const chunkHead = questionRegion.slice(cur.index, end)
    const headMatch = chunkHead.match(
      /^(?:Q(?:ues(?:tion)?)?[\s.]*)?\d{1,3}\s*[.)]\s+/i,
    )
    let body = stripNoiseLines(
      chunkHead.slice(headMatch ? headMatch[0].length : 0).trim(),
    )
    if (!body) continue

    const optHits = findOptionHits(body)
    const options: Partial<Record<PdfQuizOptionKey, string>> = {}
    let stemRaw = body

    if (optHits.length >= 2) {
      stemRaw = body.slice(0, Math.max(0, optHits[0].at)).trim()
      for (let j = 0; j < optHits.length; j += 1) {
        const hit = optHits[j]
        const nextAt =
          j + 1 < optHits.length ? optHits[j + 1].at : body.length
        const optText = cleanOptionText(body.slice(hit.at + hit.len, nextAt))
        if (optText) options[hit.letter] = optText
      }
    }

    const { stem, stemHi } = splitBilingualStem(stemRaw)
    if (!stem && Object.keys(options).length < 2) continue
    // Reject hopeless OCR mashups
    if (garbageScore(stem, options) > 55 && Object.keys(options).length < 3) {
      continue
    }

    usedNumbers.add(cur.number)
    questions.push({
      number: cur.number,
      stem: stem || `Question ${cur.number}`,
      stemHi,
      options,
      confidence:
        Object.keys(options).length >= 4
          ? 0.7
          : Object.keys(options).length >= 2
            ? 0.55
            : 0.35,
      sourcePage,
    })
  }

  const sols = extractSolutionsFromPageText(keyRegion || text, sourcePage)
  if (sols.length) {
    const byNum = new Map(sols.map((s) => [s.number, s]))
    for (const q of questions) {
      const s = byNum.get(q.number)
      if (s) q.guessedAnswer = s.answer
    }
  }

  let pageKind: PdfPageKind = 'other'
  if (questions.some((q) => Object.keys(q.options).length >= 2)) {
    pageKind = sols.length ? 'mixed' : 'questions'
  } else if (sols.length) {
    pageKind = 'solutions'
  }

  return {
    pageKind,
    questions: questions.sort((a, b) => a.number - b.number),
  }
}

function garbageScore(
  stem: string,
  options: Partial<Record<PdfQuizOptionKey, string>>,
): number {
  let g = 0
  if (DEVANAGARI.test(stem)) g += 35
  if (/SSC|IBPS|CGL|MAINS|Tier/i.test(stem)) g += 20
  if ((stem.match(/[®©#@$§]/g) || []).length) g += 15
  if (stem.length > 320) g += 12
  for (const t of Object.values(options)) {
    if (!t) continue
    if (t.length > 70) g += 12
    if (/\d{1,2}\s*[.)]\s+(?:The|If|Find|LCM|HCF)\b/i.test(t)) g += 18
    if (DEVANAGARI.test(t)) g += 10
  }
  return g
}

function questionScore(q: PdfDetectedQuestion): number {
  const opts = Object.keys(q.options).length
  const stem = (q.stem || '').trim()
  const cleanOpts = Object.values(q.options).filter(
    (t) => t && t.length <= 48 && !DEVANAGARI.test(t) && !/\d{1,2}\s*[.)]\s+[A-Z]/.test(t),
  ).length
  // Prefer readable English stems — long OCR mashups must lose
  const readable =
    /\b(?:the|and|their|of|is|are|find|what|how|if|two|numbers|lcm|hcf)\b/i.test(
      stem,
    ) && !/\b(?:ops|Te fm|sd wd|HCE|www)\b/.test(stem)
  const nonsenseTokens = (stem.match(/\b[A-Za-z]{1,2}\b/g) || []).length
  return (
    opts * 14 +
    cleanOpts * 18 +
    Math.min(stem.length, 160) / 20 +
    (readable ? 25 : 0) +
    (q.guessedAnswer ? 8 : 0) -
    nonsenseTokens * 2 -
    garbageScore(stem, q.options)
  )
}

/**
 * Parse several reading-order / OCR text variants and keep the strongest
 * question per number (best for 2/3-column Champion pages).
 */
export function pickBestQuestionsFromTexts(
  texts: string[],
  sourcePage: number,
): PdfQuestionExtractResult {
  const byNum = new Map<number, PdfDetectedQuestion>()
  let bestKind: PdfPageKind = 'other'
  let bestKindScore = -1

  for (const raw of texts) {
    if (!raw || raw.trim().length < 20) continue
    const local = extractQuestionsFromPageText(raw, sourcePage)
    const withOpts = local.questions.filter(
      (q) => Object.keys(q.options).length >= 2,
    ).length
    const cleanCount = local.questions.filter(
      (q) => questionScore(q) > 20,
    ).length
    const kindScore =
      withOpts * 10 +
      cleanCount * 8 +
      local.questions.length +
      (local.pageKind === 'questions' || local.pageKind === 'mixed' ? 5 : 0)
    if (kindScore > bestKindScore) {
      bestKindScore = kindScore
      bestKind = local.pageKind
    }
    for (const q of local.questions) {
      const prev = byNum.get(q.number)
      if (!prev || questionScore(q) > questionScore(prev)) {
        byNum.set(q.number, q)
      }
    }
  }

  const questions = [...byNum.values()]
    .filter((q) => questionScore(q) > 8 || Object.keys(q.options).length >= 3)
    .sort((a, b) => a.number - b.number)
  if (questions.some((q) => Object.keys(q.options).length >= 2)) {
    if (bestKind === 'other') bestKind = 'questions'
  } else if (!questions.length && bestKind === 'other') {
    bestKind = 'other'
  }

  return { pageKind: bestKind, questions }
}

/** Merge answer keys found across text variants. */
export function pickBestSolutionsFromTexts(
  texts: string[],
  solutionPage: number,
): PdfDetectedSolution[] {
  const byNum = new Map<number, PdfDetectedSolution>()
  for (const raw of texts) {
    if (!raw || raw.trim().length < 8) continue
    for (const s of extractSolutionsFromPageText(raw, solutionPage)) {
      const prev = byNum.get(s.number)
      if (!prev || s.confidence > prev.confidence) byNum.set(s.number, s)
    }
  }
  return [...byNum.values()].sort((a, b) => a.number - b.number)
}

/** Offline answer-key parse including footer strips: "1. (d) 2. (d) 3. (c)" */
export function extractSolutionsFromPageText(
  pageText: string,
  solutionPage: number,
): PdfDetectedSolution[] {
  const text = normalizePageText(pageText)
  if (!text) return []

  const out: PdfDetectedSolution[] = []
  const seen = new Set<number>()

  const push = (number: number, answer: PdfQuizOptionKey, conf: number) => {
    if (!number || seen.has(number)) return
    seen.add(number)
    out.push({ number, answer, confidence: conf, solutionPage })
  }

  const compact =
    /(\d{1,3})\s*[.)]\s*[\(\[]?\s*([a-dA-D])\s*[\)\]]?/g
  let m: RegExpExecArray | null
  const region = /ANSWER\s*KEY/i.test(text)
    ? text.slice(text.search(/ANSWER\s*KEY/i))
    : text

  while ((m = compact.exec(region)) != null) {
    const number = Number(m[1])
    const answer = letterOf(m[2])
    if (!answer || number <= 0) continue
    const after = region.slice(m.index + m[0].length, m.index + m[0].length + 28)
    if (/^\s*[A-Za-z]{8,}/.test(after) && !/^\s*\d/.test(after)) continue
    push(number, answer, /ANSWER\s*KEY/i.test(text) ? 0.85 : 0.55)
  }

  const ansRe =
    /(?:^|\n|\s)(?:Q(?:ues(?:tion)?)?[\s.]*)?(\d{1,3})\s*(?:[.)]|[-–—:])\s*(?:Ans(?:wer)?\s*[.:-]?\s*)[\(\[]?\s*([a-dA-D])\s*[\)\]]?/gi
  while ((m = ansRe.exec(text)) != null) {
    const number = Number(m[1])
    const answer = letterOf(m[2])
    if (answer) push(number, answer, 0.8)
  }

  return out.sort((a, b) => a.number - b.number)
}
