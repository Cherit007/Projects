import { canvasToJpegBase64, geminiJsonFromImage } from '../lib/geminiVision'
import type { AnswerKey } from './questionBank'

export type PdfQuizOptionKey = 'A' | 'B' | 'C' | 'D'

export type PdfDetectedQuestion = {
  number: number
  stem: string
  stemHi?: string
  options: Partial<Record<PdfQuizOptionKey, string>>
  /** Model guess from printed tick / key on the same page */
  guessedAnswer?: PdfQuizOptionKey
  confidence: number
  sourcePage: number
}

export type PdfDetectedSolution = {
  number: number
  answer: PdfQuizOptionKey
  explanation?: string
  confidence: number
  solutionPage: number
}

export type PdfQuizQuestion = {
  number: number
  stem: string
  stemHi?: string
  options: Partial<Record<PdfQuizOptionKey, string>>
  answer?: PdfQuizOptionKey
  explanation?: string
  sourcePage: number
  solutionPage?: number
  confidence: number
  updatedAt: string
}

export type PdfQuizDocStore = {
  docId: string
  title: string
  questions: Record<string, PdfQuizQuestion> // key = String(number)
  updatedAt: string
}

export type PdfPageExtractCache = {
  id: string // `${docId}:${page}:${kind}`
  docId: string
  page: number
  kind: 'questions' | 'solutions'
  payload: PdfDetectedQuestion[] | PdfDetectedSolution[]
  extractedAt: string
}

export type PdfQuizSession = {
  id: string
  docId: string
  questionNumbers: number[]
  index: number
  answers: Record<string, PdfQuizOptionKey | null>
  startedAt: string
  /** per-question seconds budget; 0 = no limit */
  perQuestionSec: number
  /** total seconds; 0 = no limit */
  totalSec: number
  status: 'in_progress' | 'submitted'
  submittedAt?: string
}

const Q_PROMPT = `You are extracting MCQ questions from an Indian competitive-exam practice PDF page (often multi-column, English + Hindi, math).

Return ONLY JSON:
{
  "pageKind": "questions" | "solutions" | "mixed" | "other",
  "questions": [
    {
      "number": 1,
      "stem": "English question text without options",
      "stemHi": "Hindi if present else empty string",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "guessedAnswer": "A"|"B"|"C"|"D"|null,
      "confidence": 0.0
    }
  ]
}

Rules:
- Detect EVERY distinct MCQ on the page (all columns).
- Prefer English stem; put Hindi in stemHi.
- Options must map to A B C D (from (a)(b)(c)(d) or 1)2)3)4)).
- If a green tick / checkmark / underlined key marks an option, set guessedAnswer.
- If this page is mostly solutions/answer key (not full stems), return questions:[ ] and pageKind "solutions".
- confidence 0-1 for extraction quality.
- Keep math as plain text (e.g. 8^(2k)+5^(2k)).`

const S_PROMPT = `You are reading a SOLUTIONS / ANSWER KEY page from an Indian exam practice PDF.

Return ONLY JSON:
{
  "solutions": [
    {
      "number": 1,
      "answer": "A"|"B"|"C"|"D",
      "explanation": "short reason if present else empty string",
      "confidence": 0.0
    }
  ]
}

Rules:
- Extract every numbered answer you can find.
- answer is the correct option letter.
- Ignore ads/watermarks.`

function asLetter(v: unknown): PdfQuizOptionKey | undefined {
  if (typeof v !== 'string') return undefined
  const L = v.trim().toUpperCase().replace(/[^A-D]/g, '')
  if (L === 'A' || L === 'B' || L === 'C' || L === 'D') return L
  return undefined
}

function asNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

export function normalizeQuestions(
  raw: unknown,
  sourcePage: number,
): PdfDetectedQuestion[] {
  const root = raw as { questions?: unknown[] }
  const list = Array.isArray(root?.questions) ? root.questions : []
  const out: PdfDetectedQuestion[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const q = item as Record<string, unknown>
    const number = asNum(q.number)
    if (number == null) continue
    const optsRaw = (q.options || {}) as Record<string, unknown>
    const options: PdfDetectedQuestion['options'] = {}
    for (const k of ['A', 'B', 'C', 'D', 'a', 'b', 'c', 'd'] as const) {
      const letter = k.toUpperCase() as PdfQuizOptionKey
      const val = optsRaw[k] ?? optsRaw[letter]
      if (typeof val === 'string' && val.trim()) options[letter] = val.trim()
    }
    const stem = typeof q.stem === 'string' ? q.stem.trim() : ''
    if (!stem && !Object.keys(options).length) continue
    out.push({
      number,
      stem: stem || `Question ${number}`,
      stemHi: typeof q.stemHi === 'string' ? q.stemHi.trim() : undefined,
      options,
      guessedAnswer: asLetter(q.guessedAnswer),
      confidence:
        typeof q.confidence === 'number'
          ? Math.min(1, Math.max(0, q.confidence))
          : 0.6,
      sourcePage,
    })
  }
  return out.sort((a, b) => a.number - b.number)
}

export function normalizeSolutions(
  raw: unknown,
  solutionPage: number,
): PdfDetectedSolution[] {
  const root = raw as { solutions?: unknown[] }
  const list = Array.isArray(root?.solutions) ? root.solutions : []
  const out: PdfDetectedSolution[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    const number = asNum(s.number)
    const answer = asLetter(s.answer)
    if (number == null || !answer) continue
    out.push({
      number,
      answer,
      explanation:
        typeof s.explanation === 'string' ? s.explanation.trim() : undefined,
      confidence:
        typeof s.confidence === 'number'
          ? Math.min(1, Math.max(0, s.confidence))
          : 0.7,
      solutionPage,
    })
  }
  return out.sort((a, b) => a.number - b.number)
}

export type PdfPageKind = 'questions' | 'solutions' | 'mixed' | 'other'

export type PdfQuestionExtractResult = {
  pageKind: PdfPageKind
  questions: PdfDetectedQuestion[]
}

function asPageKind(v: unknown): PdfPageKind {
  if (v === 'questions' || v === 'solutions' || v === 'mixed' || v === 'other') {
    return v
  }
  return 'other'
}

export async function extractQuestionsFromCanvas(
  canvas: HTMLCanvasElement,
  page: number,
): Promise<PdfQuestionExtractResult> {
  const { base64 } = canvasToJpegBase64(canvas, 0.7)
  const raw = await geminiJsonFromImage({
    prompt: Q_PROMPT,
    imageBase64: base64,
  })
  const root = raw as { pageKind?: unknown }
  const questions = normalizeQuestions(raw, page)
  let pageKind = asPageKind(root?.pageKind)
  if (pageKind === 'other' && questions.length) pageKind = 'questions'
  if (pageKind === 'other' && !questions.length) {
    /* leave as other — host may offer solution mapping */
  }
  return { pageKind, questions }
}

export async function extractSolutionsFromCanvas(
  canvas: HTMLCanvasElement,
  page: number,
): Promise<PdfDetectedSolution[]> {
  const { base64 } = canvasToJpegBase64(canvas, 0.7)
  const raw = await geminiJsonFromImage({
    prompt: S_PROMPT,
    imageBase64: base64,
  })
  return normalizeSolutions(raw, page)
}

export function mergeQuestionsIntoStore(
  store: PdfQuizDocStore,
  detected: PdfDetectedQuestion[],
): PdfQuizDocStore {
  const questions = { ...store.questions }
  const now = new Date().toISOString()
  for (const d of detected) {
    const key = String(d.number)
    const prev = questions[key]
    questions[key] = {
      number: d.number,
      stem: d.stem || prev?.stem || `Question ${d.number}`,
      stemHi: d.stemHi || prev?.stemHi,
      options: { ...prev?.options, ...d.options },
      answer: d.guessedAnswer || prev?.answer,
      explanation: prev?.explanation,
      sourcePage: d.sourcePage,
      solutionPage: prev?.solutionPage,
      confidence: Math.max(prev?.confidence || 0, d.confidence),
      updatedAt: now,
    }
  }
  return {
    ...store,
    questions,
    updatedAt: now,
  }
}

export function mergeSolutionsIntoStore(
  store: PdfQuizDocStore,
  detected: PdfDetectedSolution[],
): PdfQuizDocStore {
  const questions = { ...store.questions }
  const now = new Date().toISOString()
  for (const s of detected) {
    const key = String(s.number)
    const prev = questions[key]
    questions[key] = {
      number: s.number,
      stem: prev?.stem || `Question ${s.number}`,
      stemHi: prev?.stemHi,
      options: prev?.options || {},
      answer: s.answer,
      explanation: s.explanation || prev?.explanation,
      sourcePage: prev?.sourcePage || s.solutionPage,
      solutionPage: s.solutionPage,
      confidence: Math.max(prev?.confidence || 0, s.confidence),
      updatedAt: now,
    }
  }
  return {
    ...store,
    questions,
    updatedAt: now,
  }
}

export function emptyQuizStore(docId: string, title: string): PdfQuizDocStore {
  return {
    docId,
    title,
    questions: {},
    updatedAt: new Date().toISOString(),
  }
}

export function listStoreQuestions(store: PdfQuizDocStore): PdfQuizQuestion[] {
  return Object.values(store.questions).sort((a, b) => a.number - b.number)
}

export function scoreQuiz(
  session: PdfQuizSession,
  store: PdfQuizDocStore,
): {
  correct: number
  wrong: number
  skipped: number
  total: number
} {
  let correct = 0
  let wrong = 0
  let skipped = 0
  for (const n of session.questionNumbers) {
    const q = store.questions[String(n)]
    const choice = session.answers[String(n)]
    if (!choice) {
      skipped += 1
      continue
    }
    if (q?.answer && choice === q.answer) correct += 1
    else if (q?.answer) wrong += 1
    else skipped += 1 // answered but no key to grade
  }
  return {
    correct,
    wrong,
    skipped,
    total: session.questionNumbers.length,
  }
}

export function toAnswerKey(letter: PdfQuizOptionKey): AnswerKey {
  return letter
}
