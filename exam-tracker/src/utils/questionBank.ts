/** Topic-wise photo question bank + timed practice attempts (Testbook-style). */

export type AnswerKey = 'A' | 'B' | 'C' | 'D' | 'E'

export type BankQuestion = {
  id: string
  topicId: string
  /** Compressed JPEG data URL of the question photo */
  imageDataUrl: string
  /** Correct option */
  answerKey: AnswerKey
  /** Optional short text prompt / note shown above the image */
  prompt?: string
  /** Optional explanation text shown in review */
  explanation?: string
  /** Optional solution photo */
  solutionImageDataUrl?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  createdAt: string
  updatedAt: string
}

export type PracticeConfig = {
  questionCount: number
  /** Total exam duration in seconds */
  durationSec: number
  marksCorrect: number
  marksWrong: number
  shuffle: boolean
}

export type QuestionAttemptState = {
  choice: AnswerKey | null
  /** Accumulated active time on this question (ms) */
  timeSpentMs: number
  markedForReview: boolean
  visited: boolean
}

export type PracticeAttempt = {
  id: string
  topicId: string
  topicTitle: string
  config: PracticeConfig
  questionIds: string[]
  answers: Record<string, QuestionAttemptState>
  startedAt: string
  /** Wall-clock deadline = startedAt + durationSec */
  endsAt: string
  submittedAt?: string
  status: 'in_progress' | 'submitted'
}

export type AttemptScore = {
  correct: number
  wrong: number
  skipped: number
  marked: number
  marks: number
  maxMarks: number
  accuracy: number
  totalTimeMs: number
  avgTimeMs: number
  perQuestion: Array<{
    questionId: string
    choice: AnswerKey | null
    correctKey: AnswerKey
    isCorrect: boolean
    isSkipped: boolean
    timeSpentMs: number
    markedForReview: boolean
  }>
}

export const DEFAULT_PRACTICE_CONFIG: PracticeConfig = {
  questionCount: 15,
  durationSec: 20 * 60,
  marksCorrect: 1,
  marksWrong: 0.25,
  shuffle: true,
}

export const ANSWER_KEYS: AnswerKey[] = ['A', 'B', 'C', 'D', 'E']

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

export function emptyAttemptState(): QuestionAttemptState {
  return {
    choice: null,
    timeSpentMs: 0,
    markedForReview: false,
    visited: false,
  }
}

export function formatClock(msOrSec: number, unit: 'ms' | 'sec' = 'ms'): string {
  const total = Math.max(0, Math.floor(unit === 'ms' ? msOrSec / 1000 : msOrSec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function pickQuestions(
  pool: BankQuestion[],
  count: number,
  shuffle: boolean,
): BankQuestion[] {
  const list = [...pool]
  if (shuffle) shuffleInPlace(list)
  return list.slice(0, Math.max(0, Math.min(count, list.length)))
}

export function scoreAttempt(
  attempt: PracticeAttempt,
  questions: BankQuestion[],
): AttemptScore {
  const byId = new Map(questions.map((q) => [q.id, q]))
  let correct = 0
  let wrong = 0
  let skipped = 0
  let marked = 0
  let totalTimeMs = 0
  const perQuestion = attempt.questionIds.map((qid) => {
    const q = byId.get(qid)
    const st = attempt.answers[qid] ?? emptyAttemptState()
    totalTimeMs += st.timeSpentMs
    if (st.markedForReview) marked += 1
    const correctKey = q?.answerKey ?? 'A'
    const isSkipped = st.choice == null
    const isCorrect = !isSkipped && st.choice === correctKey
    if (isSkipped) skipped += 1
    else if (isCorrect) correct += 1
    else wrong += 1
    return {
      questionId: qid,
      choice: st.choice,
      correctKey,
      isCorrect,
      isSkipped,
      timeSpentMs: st.timeSpentMs,
      markedForReview: st.markedForReview,
    }
  })
  const marks =
    correct * attempt.config.marksCorrect - wrong * attempt.config.marksWrong
  const maxMarks = attempt.questionIds.length * attempt.config.marksCorrect
  const attempted = correct + wrong
  return {
    correct,
    wrong,
    skipped,
    marked,
    marks: Math.round(marks * 100) / 100,
    maxMarks,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    totalTimeMs,
    avgTimeMs: attempt.questionIds.length
      ? Math.round(totalTimeMs / attempt.questionIds.length)
      : 0,
    perQuestion,
  }
}

/** Resize + JPEG-compress a photo for local storage. */
export async function compressQuestionImage(
  file: File,
  maxWidth = 1280,
  quality = 0.72,
): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

export function isAnswerKey(v: unknown): v is AnswerKey {
  return typeof v === 'string' && ANSWER_KEYS.includes(v as AnswerKey)
}
