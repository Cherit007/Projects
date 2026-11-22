import { tidyMathPlain } from './formatQuizMath'
import type {
  PdfDetectedQuestion,
  PdfDetectedSolution,
  PdfPageKind,
  PdfQuestionExtractResult,
  PdfQuizOptionKey,
} from './pdfPageQuiz'

/** Normalize pdf.js text into a single parseable string. */
export function normalizePageText(raw: string): string {
  // Soft math tidy per line so question breaks stay intact
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => tidyMathPlain(line))
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

/**
 * Offline MCQ parse from embedded PDF text.
 * Handles common SSC/banking layouts: "12." stems and (a)/(b)/(c)/(d) options.
 */
export function extractQuestionsFromPageText(
  pageText: string,
  sourcePage: number,
): PdfQuestionExtractResult {
  const text = normalizePageText(pageText)
  if (!text || text.length < 20) {
    return { pageKind: 'other', questions: [] }
  }

  // Split on question numbers at line starts: "12." "12)" "Q.12" "Q 12."
  const qSplit =
    /(?:^|\n)\s*(?:Q(?:ues(?:tion)?)?[\s.]*)?(\d{1,3})[.)]\s+/gi
  const starts: Array<{ index: number; number: number }> = []
  let m: RegExpExecArray | null
  while ((m = qSplit.exec(text)) != null) {
    const number = Number(m[1])
    if (!Number.isFinite(number) || number <= 0) continue
    starts.push({ index: m.index + (m[0].startsWith('\n') ? 1 : 0), number })
  }

  const questions: PdfDetectedQuestion[] = []
  for (let i = 0; i < starts.length; i += 1) {
    const cur = starts[i]
    const end = i + 1 < starts.length ? starts[i + 1].index : text.length
    // Find the actual start after the number marker
    const chunkHead = text.slice(cur.index, end)
    const headMatch = chunkHead.match(
      /^(?:Q(?:ues(?:tion)?)?[\s.]*)?\d{1,3}[.)]\s+/i,
    )
    const body = chunkHead.slice(headMatch ? headMatch[0].length : 0).trim()
    if (!body) continue

    const options: Partial<Record<PdfQuizOptionKey, string>> = {}
    // Options: (a) text  or  a) text  or  (1) text
    const optRe =
      /(?:^|\n|\s)[\(\[]?\s*([a-dA-D1-4])\s*[\)\].:]\s*/g
    const optHits: Array<{ letter: PdfQuizOptionKey; at: number; len: number }> =
      []
    let om: RegExpExecArray | null
    while ((om = optRe.exec(body)) != null) {
      const letter = letterOf(om[1])
      if (!letter) continue
      // Prefer first occurrence of each letter
      if (optHits.some((h) => h.letter === letter)) continue
      optHits.push({ letter, at: om.index, len: om[0].length })
      if (optHits.length >= 4) break
    }

    let stem = body
    if (optHits.length >= 2) {
      optHits.sort((a, b) => a.at - b.at)
      stem = body.slice(0, optHits[0].at).trim()
      for (let j = 0; j < optHits.length; j += 1) {
        const hit = optHits[j]
        const nextAt =
          j + 1 < optHits.length ? optHits[j + 1].at : body.length
        const optText = tidyMathPlain(
          body.slice(hit.at + hit.len, nextAt),
        ).slice(0, 400)
        if (optText) options[hit.letter] = optText
      }
    }

    stem = tidyMathPlain(stem)
    if (!stem && !Object.keys(options).length) continue

    questions.push({
      number: cur.number,
      stem: stem || `Question ${cur.number}`,
      options,
      confidence: Object.keys(options).length >= 2 ? 0.55 : 0.35,
      sourcePage,
    })
  }

  // Answer-key-ish page: many "12. (a)" / "12 - A" with little stem
  const solish = extractSolutionsFromPageText(text, sourcePage)
  let pageKind: PdfPageKind = 'other'
  if (questions.length && questions.some((q) => Object.keys(q.options).length >= 2)) {
    pageKind = solish.length > questions.length ? 'mixed' : 'questions'
  } else if (solish.length) {
    pageKind = 'solutions'
  }

  return {
    pageKind,
    questions: questions.sort((a, b) => a.number - b.number),
  }
}

/** Offline answer-key parse: "12. (a)", "12) A", "Q12 - B", "12. Ans. C" */
export function extractSolutionsFromPageText(
  pageText: string,
  solutionPage: number,
): PdfDetectedSolution[] {
  const text = normalizePageText(pageText)
  if (!text) return []

  const re =
    /(?:^|\n|\s)(?:Q(?:ues(?:tion)?)?[\s.]*)?(\d{1,3})\s*(?:[.)]|[-–—:])\s*(?:Ans(?:wer)?\s*[.:-]?\s*)?[\(\[]?\s*([a-dA-D])\s*[\)\]]?/gi

  const out: PdfDetectedSolution[] = []
  const seen = new Set<number>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) != null) {
    const number = Number(m[1])
    const answer = letterOf(m[2])
    if (!number || !answer || seen.has(number)) continue
    // Skip if this looks like a full option line with long text after (likely question page)
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40)
    if (/[a-zA-Z]{12,}/.test(after) && !/^\s*(?:Ans|Explanation|Sol)/i.test(after)) {
      // Could still be answer key with short labels — keep if answer token was tight
      if (after.trim().length > 24) continue
    }
    seen.add(number)
    out.push({
      number,
      answer,
      confidence: 0.5,
      solutionPage,
    })
  }
  return out.sort((a, b) => a.number - b.number)
}
