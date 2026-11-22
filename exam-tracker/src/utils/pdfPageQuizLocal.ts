import { tidyMathPlain } from './formatQuizMath'
import type {
  PdfDetectedQuestion,
  PdfDetectedSolution,
  PdfPageKind,
  PdfQuestionExtractResult,
  PdfQuizOptionKey,
} from './pdfPageQuiz'

const DEVANAGARI = /[\u0900-\u097F]/
const EXAM_HEADER =
  /^(?:SSC|IBPS|RRB|SBI|UPSC|BANK|RAILWAY|CHSL|CGL|MTS|GD|STENO|TIER[- ]?[IVX0-9]+|MAINS?|PRE(?:LIM(?:S|INARY)?)?|SHIFT|SEPT?|OCT|NOV|DEC|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG)\b/i

/** Normalize pdf.js / OCR text into a single parseable string. */
export function normalizePageText(raw: string): string {
  return raw
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
    // Drop pure exam meta lines like "SSC CGL MAINS 2018 {12 Sept. 2019}"
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

  // Also split inline: English then Hindi in one blob
  let stem = tidyMathPlain(en.join(' ').replace(/\s+/g, ' ').trim())
  let stemHi = hi.length
    ? hi.join(' ').replace(/\s+/g, ' ').trim()
    : undefined

  if (!stem && raw) {
    const m = raw.match(/^([\x00-\x7F\u0080-\u02FF\s\d.,;:!?()[\]{}+\-×÷=√^\/]+)(.*)$/u)
    if (m) {
      stem = tidyMathPlain(m[1])
      const rest = m[2]?.trim()
      if (rest && DEVANAGARI.test(rest)) stemHi = rest
    }
  }

  // Cut stem before Hindi starts mid-string
  if (stem && !stemHi) {
    const hiAt = stem.search(DEVANAGARI)
    if (hiAt > 12) {
      stemHi = stem.slice(hiAt).trim()
      stem = tidyMathPlain(stem.slice(0, hiAt))
    }
  }

  return { stem: stem || tidyMathPlain(raw).slice(0, 500), stemHi }
}

function cleanOptionText(raw: string): string {
  let t = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => Boolean(l) && (!DEVANAGARI.test(l) || /[0-9A-Za-z(]/.test(l)))
    .join(' ')
  // Drop trailing Hindi from option
  const hiAt = t.search(DEVANAGARI)
  if (hiAt > 0) t = t.slice(0, hiAt)
  return tidyMathPlain(t).slice(0, 400)
}

function findOptionHits(
  body: string,
): Array<{ letter: PdfQuizOptionKey; at: number; len: number }> {
  // (a) / (a) / a) / (1) — allow tight packing from multi-col extract
  const optRe =
    /(?:^|[\n\s])[\(\[]?\s*([a-dA-D])\s*[\)\].:]\s*/g
  const optHits: Array<{ letter: PdfQuizOptionKey; at: number; len: number }> =
    []
  let om: RegExpExecArray | null
  while ((om = optRe.exec(body)) != null) {
    const letter = letterOf(om[1])
    if (!letter) continue
    if (optHits.some((h) => h.letter === letter)) continue
    // Skip false positives like "a)" inside words — require boundary
    const before = body[om.index]
    if (before && /[A-Za-z0-9]/.test(before) && om[0].length < 3) continue
    optHits.push({ letter, at: om.index, len: om[0].length })
    if (optHits.length >= 4) break
  }
  return optHits.sort((a, b) => a.at - b.at)
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

  // Peel answer-key strip if present on same page
  const keySplit = text.split(/\n(?=ANSWER\s*KEY\b)/i)
  const questionRegion = keySplit[0] || text
  const keyRegion = keySplit.slice(1).join('\n')

  // Question starts: "1." "1)" "Q.1" — also mid-line after column join noise
  const qSplit =
    /(?:^|\n)\s*(?:Q(?:ues(?:tion)?)?[\s.]*)?(\d{1,3})\s*[.)]\s+(?=[A-Za-z(\u0900-\u097F]|SSC|The|If|Find|What|How|LCM|HCF|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\()/gi

  const starts: Array<{ index: number; number: number }> = []
  let m: RegExpExecArray | null
  const seenAt = new Set<number>()
  while ((m = qSplit.exec(questionRegion)) != null) {
    const number = Number(m[1])
    if (!Number.isFinite(number) || number <= 0 || number > 300) continue
    const idx = m.index + (m[0].startsWith('\n') ? 1 : 0)
    // Avoid duplicate close matches
    if ([...seenAt].some((s) => Math.abs(s - idx) < 3)) continue
    seenAt.add(idx)
    starts.push({ index: idx, number })
  }

  // Fallback: looser pattern if few hits (broken columns)
  if (starts.length < 2) {
    const loose =
      /(?:^|\n|(?<=\s{2,})|(?<=[|;•]))\s*(?:Q(?:ues(?:tion)?)?[\s.]*)?(\d{1,2})\s*[.)]\s+/gi
    starts.length = 0
    seenAt.clear()
    while ((m = loose.exec(questionRegion)) != null) {
      const number = Number(m[1])
      if (!Number.isFinite(number) || number <= 0 || number > 80) continue
      const idx = m.index
      if ([...seenAt].some((s) => Math.abs(s - idx) < 3)) continue
      // Skip mid-sentence values like "is 48. The numbers"
      const prev = questionRegion.slice(Math.max(0, idx - 16), idx)
      if (/[A-Za-z0-9]\s*$/.test(prev) && !/(?:^|\n)\s*$/.test(prev)) continue
      const window = questionRegion.slice(idx, idx + 700)
      if (!/\([a-dA-D]\)/.test(window) && !/\b[a-dA-D]\)/.test(window)) continue
      seenAt.add(idx)
      starts.push({ index: idx, number })
    }
    starts.sort((a, b) => a.index - b.index)
  }

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

    usedNumbers.add(cur.number)
    questions.push({
      number: cur.number,
      stem: stem || `Question ${cur.number}`,
      stemHi,
      options,
      confidence: Object.keys(options).length >= 4 ? 0.7 : Object.keys(options).length >= 2 ? 0.55 : 0.35,
      sourcePage,
    })
  }

  // Same-page answer key → attach guessedAnswer
  const sols = extractSolutionsFromPageText(
    keyRegion || text,
    sourcePage,
  )
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

function questionScore(q: PdfDetectedQuestion): number {
  const opts = Object.keys(q.options).length
  const stem = (q.stem || '').trim().length
  return opts * 12 + Math.min(stem, 280) / 10 + (q.guessedAnswer ? 8 : 0)
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
    const kindScore =
      withOpts * 10 +
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

  const questions = [...byNum.values()].sort((a, b) => a.number - b.number)
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

  // Compact key strip: 1. (d) 2. (d) 3. (c)
  const compact =
    /(\d{1,3})\s*[.)]\s*[\(\[]?\s*([a-dA-D])\s*[\)\]]?/g
  let m: RegExpExecArray | null
  const region = /ANSWER\s*KEY/i.test(text)
    ? text.slice(text.search(/ANSWER\s*KEY/i))
    : text

  // Prefer matches in answer-key region / short contexts
  while ((m = compact.exec(region)) != null) {
    const number = Number(m[1])
    const answer = letterOf(m[2])
    if (!answer || number <= 0) continue
    const after = region.slice(m.index + m[0].length, m.index + m[0].length + 28)
    // Skip question stems: long English after the letter
    if (/^\s*[A-Za-z]{8,}/.test(after) && !/^\s*\d/.test(after)) continue
    push(number, answer, /ANSWER\s*KEY/i.test(text) ? 0.85 : 0.55)
  }

  // "Ans. A" / "Answer: B" forms
  const ansRe =
    /(?:^|\n|\s)(?:Q(?:ues(?:tion)?)?[\s.]*)?(\d{1,3})\s*(?:[.)]|[-–—:])\s*(?:Ans(?:wer)?\s*[.:-]?\s*)[\(\[]?\s*([a-dA-D])\s*[\)\]]?/gi
  while ((m = ansRe.exec(text)) != null) {
    const number = Number(m[1])
    const answer = letterOf(m[2])
    if (answer) push(number, answer, 0.8)
  }

  return out.sort((a, b) => a.number - b.number)
}
