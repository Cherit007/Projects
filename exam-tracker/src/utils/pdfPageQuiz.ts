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

export type PdfPageKind = 'questions' | 'solutions' | 'mixed' | 'other'

export type PdfQuestionExtractResult = {
  pageKind: PdfPageKind
  questions: PdfDetectedQuestion[]
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
    else skipped += 1
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
