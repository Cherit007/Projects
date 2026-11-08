import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuestionBank } from '../hooks/useQuestionBank'
import {
  ANSWER_KEYS,
  emptyAttemptState,
  formatClock,
  scoreAttempt,
  type AnswerKey,
  type BankQuestion,
  type PracticeAttempt,
  type QuestionAttemptState,
} from '../utils/questionBank'

type Mode = 'loading' | 'exam' | 'result' | 'review' | 'missing'

export function PracticeExamPage() {
  const { attemptId = '' } = useParams()
  const navigate = useNavigate()
  const { loadAttemptBundle, saveAttempt } = useQuestionBank()

  const [mode, setMode] = useState<Mode>('loading')
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null)
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [confirmSubmit, setConfirmSubmit] = useState(false)

  const tickRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(Date.now())
  const indexRef = useRef(0)
  const attemptRef = useRef<PracticeAttempt | null>(null)
  const savingRef = useRef(false)

  indexRef.current = index
  attemptRef.current = attempt

  const qMap = useMemo(() => {
    const m = new Map<string, BankQuestion>()
    for (const q of questions) m.set(q.id, q)
    return m
  }, [questions])

  const currentId = attempt?.questionIds[index] ?? null
  const currentQ = currentId ? qMap.get(currentId) ?? null : null
  const currentState: QuestionAttemptState =
    (currentId && attempt?.answers[currentId]) || emptyAttemptState()

  const remainingMs = attempt
    ? Math.max(0, new Date(attempt.endsAt).getTime() - now)
    : 0

  const load = useCallback(async () => {
    if (!attemptId) {
      setMode('missing')
      return
    }
    const bundle = await loadAttemptBundle(attemptId)
    if (!bundle) {
      setMode('missing')
      return
    }
    setAttempt(bundle.attempt)
    setQuestions(bundle.questions)
    // Land on first unanswered if in progress
    if (bundle.attempt.status === 'submitted') {
      setMode('result')
    } else {
      const firstOpen = bundle.attempt.questionIds.findIndex((id) => {
        const st = bundle.attempt.answers[id]
        return !st?.choice
      })
      setIndex(firstOpen >= 0 ? firstOpen : 0)
      setMode('exam')
    }
  }, [attemptId, loadAttemptBundle])

  useEffect(() => {
    void load()
  }, [load])

  // Exam chrome: hide app chrome while taking / reviewing
  useEffect(() => {
    document.documentElement.classList.add('practice-exam-active')
    return () => {
      document.documentElement.classList.remove('practice-exam-active')
    }
  }, [])

  const persist = useCallback(
    async (next: PracticeAttempt) => {
      setAttempt(next)
      if (savingRef.current) return
      savingRef.current = true
      try {
        await saveAttempt(next)
      } finally {
        savingRef.current = false
      }
    },
    [saveAttempt],
  )

  const patchCurrent = useCallback(
    (patch: Partial<QuestionAttemptState>, opts?: { go?: number }) => {
      const cur = attemptRef.current
      const qid = cur?.questionIds[indexRef.current]
      if (!cur || !qid) return
      const prev = cur.answers[qid] ?? emptyAttemptState()
      const next: PracticeAttempt = {
        ...cur,
        answers: {
          ...cur.answers,
          [qid]: { ...prev, visited: true, ...patch },
        },
      }
      void persist(next)
      if (opts?.go != null) {
        setIndex(
          Math.max(0, Math.min(cur.questionIds.length - 1, opts.go)),
        )
      }
    },
    [persist],
  )

  // Per-question dwell timer + wall clock
  useEffect(() => {
    if (mode !== 'exam' || !attempt) return
    lastTickRef.current = Date.now()
    let sinceSave = 0
    tickRef.current = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      const delta = t - lastTickRef.current
      lastTickRef.current = t
      if (document.visibilityState !== 'visible') return
      if (delta <= 0 || delta > 5000) return
      const cur = attemptRef.current
      const qid = cur?.questionIds[indexRef.current]
      if (!cur || !qid || cur.status !== 'in_progress') return
      const prev = cur.answers[qid] ?? emptyAttemptState()
      const next: PracticeAttempt = {
        ...cur,
        answers: {
          ...cur.answers,
          [qid]: {
            ...prev,
            visited: true,
            timeSpentMs: prev.timeSpentMs + delta,
          },
        },
      }
      attemptRef.current = next
      setAttempt(next)
      sinceSave += delta
      if (sinceSave >= 3000) {
        sinceSave = 0
        void saveAttempt(next)
      }
    }, 500)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
      const cur = attemptRef.current
      if (cur) void saveAttempt(cur)
    }
  }, [mode, attempt?.id, index, saveAttempt])

  const submit = useCallback(async () => {
    const cur = attemptRef.current
    if (!cur) return
    const next: PracticeAttempt = {
      ...cur,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    }
    await persist(next)
    setConfirmSubmit(false)
    setMode('result')
  }, [persist])

  // Auto-submit on time up
  useEffect(() => {
    if (mode !== 'exam' || !attempt) return
    if (remainingMs > 0) return
    void submit()
  }, [mode, attempt, remainingMs, submit])

  const score = useMemo(() => {
    if (!attempt || attempt.status !== 'submitted') return null
    return scoreAttempt(attempt, questions)
  }, [attempt, questions])

  if (mode === 'loading') {
    return (
      <div className="pex-shell">
        <p className="lede">Opening exam window…</p>
      </div>
    )
  }

  if (mode === 'missing' || !attempt) {
    return (
      <div className="pex-shell">
        <p className="lede">Attempt not found.</p>
        <Link className="btn primary" to="/practice">
          Back to practice bank
        </Link>
      </div>
    )
  }

  if (mode === 'result' && score) {
    return (
      <div className="pex-shell pex-result">
        <header className="pex-result-head">
          <div>
            <p className="pex-kicker">Drill complete</p>
            <h1>{attempt.topicTitle}</h1>
            <p className="lede">
              {attempt.config.questionCount} questions ·{' '}
              {formatClock(attempt.config.durationSec, 'sec')} limit
            </p>
          </div>
          <div className="pex-score-hero">
            <strong>
              {score.marks}
              <span> / {score.maxMarks}</span>
            </strong>
            <em>{score.accuracy}% accuracy</em>
          </div>
        </header>

        <div className="pex-stat-grid">
          <div>
            <em>Correct</em>
            <strong>{score.correct}</strong>
          </div>
          <div>
            <em>Wrong</em>
            <strong>{score.wrong}</strong>
          </div>
          <div>
            <em>Skipped</em>
            <strong>{score.skipped}</strong>
          </div>
          <div>
            <em>Marked</em>
            <strong>{score.marked}</strong>
          </div>
          <div>
            <em>Total time</em>
            <strong>{formatClock(score.totalTimeMs)}</strong>
          </div>
          <div>
            <em>Avg / Q</em>
            <strong>{formatClock(score.avgTimeMs)}</strong>
          </div>
        </div>

        <div className="pex-result-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setIndex(0)
              setMode('review')
            }}
          >
            Review solutions
          </button>
          <button
            type="button"
            className="btn ghost-btn"
            onClick={() => navigate('/practice')}
          >
            Back to bank
          </button>
        </div>

        <table className="pex-time-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Result</th>
              <th>Your</th>
              <th>Key</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {score.perQuestion.map((row, i) => (
              <tr key={row.questionId}>
                <td>{i + 1}</td>
                <td>
                  <span
                    className={`pex-pill ${
                      row.isSkipped
                        ? 'skip'
                        : row.isCorrect
                          ? 'ok'
                          : 'bad'
                    }`}
                  >
                    {row.isSkipped
                      ? 'Skipped'
                      : row.isCorrect
                        ? 'Correct'
                        : 'Wrong'}
                  </span>
                </td>
                <td>{row.choice ?? '—'}</td>
                <td>{row.correctKey}</td>
                <td>{formatClock(row.timeSpentMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const isReview = mode === 'review'
  const total = attempt.questionIds.length
  const answered = attempt.questionIds.filter(
    (id) => attempt.answers[id]?.choice != null,
  ).length
  const marked = attempt.questionIds.filter(
    (id) => attempt.answers[id]?.markedForReview,
  ).length

  const reviewRow = isReview && currentId && score
    ? score.perQuestion.find((p) => p.questionId === currentId)
    : null

  return (
    <div className={`pex-shell pex-exam${isReview ? ' is-review' : ''}`}>
      <header className="pex-topbar">
        <div className="pex-top-left">
          <button
            type="button"
            className="ghost pex-exit"
            onClick={() => navigate('/practice')}
          >
            Exit
          </button>
          <div>
            <strong>{attempt.topicTitle}</strong>
            <span>
              Q {index + 1}/{total}
              {!isReview && ` · Answered ${answered} · Marked ${marked}`}
            </span>
          </div>
        </div>
        {!isReview ? (
          <div
            className={`pex-timer${remainingMs < 60_000 ? ' urgent' : ''}`}
            aria-live="polite"
          >
            {formatClock(remainingMs)}
          </div>
        ) : (
          <div className="pex-timer review">Review</div>
        )}
        <div className="pex-top-right">
          {!isReview ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => setConfirmSubmit(true)}
            >
              Submit
            </button>
          ) : (
            <button
              type="button"
              className="btn primary"
              onClick={() => setMode('result')}
            >
              Scorecard
            </button>
          )}
        </div>
      </header>

      <div className="pex-body">
        <aside className="pex-palette" aria-label="Question palette">
          <p className="pex-palette-legend">
            <span className="ans" /> Answered
            <span className="na" /> Not answered
            <span className="mark" /> Marked
            {isReview && (
              <>
                <span className="ok" /> Correct
                <span className="bad" /> Wrong
              </>
            )}
          </p>
          <div className="pex-palette-grid">
            {attempt.questionIds.map((qid, i) => {
              const st = attempt.answers[qid] ?? emptyAttemptState()
              const row = score?.perQuestion[i]
              let cls = 'pex-pal'
              if (isReview && row) {
                cls += row.isSkipped
                  ? ' skip'
                  : row.isCorrect
                    ? ' ok'
                    : ' bad'
              } else {
                if (st.choice) cls += ' ans'
                else if (st.visited) cls += ' visit'
                if (st.markedForReview) cls += ' mark'
              }
              if (i === index) cls += ' current'
              return (
                <button
                  key={qid}
                  type="button"
                  className={cls}
                  onClick={() => setIndex(i)}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </aside>

        <main className="pex-main">
          {currentQ ? (
            <>
              <div className="pex-q-meta">
                <span>Time on this Q: {formatClock(currentState.timeSpentMs)}</span>
                {currentQ.prompt && <span>{currentQ.prompt}</span>}
                {isReview && reviewRow && (
                  <span
                    className={`pex-pill ${
                      reviewRow.isSkipped
                        ? 'skip'
                        : reviewRow.isCorrect
                          ? 'ok'
                          : 'bad'
                    }`}
                  >
                    {reviewRow.isSkipped
                      ? 'Skipped'
                      : reviewRow.isCorrect
                        ? 'Correct'
                        : 'Wrong'}{' '}
                    · Key {reviewRow.correctKey}
                    {reviewRow.choice ? ` · You ${reviewRow.choice}` : ''}
                  </span>
                )}
              </div>

              <div className="pex-image-wrap">
                <img
                  src={currentQ.imageDataUrl}
                  alt={`Question ${index + 1}`}
                />
              </div>

              {!isReview ? (
                <div className="pex-options" role="radiogroup" aria-label="Options">
                  {ANSWER_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={currentState.choice === key}
                      className={
                        currentState.choice === key ? 'active' : undefined
                      }
                      onClick={() => patchCurrent({ choice: key as AnswerKey })}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="pex-review-block">
                  <p>
                    Correct answer: <strong>{currentQ.answerKey}</strong>
                    {currentState.choice
                      ? ` · Your answer: ${currentState.choice}`
                      : ' · Not attempted'}
                  </p>
                  {currentQ.explanation && <p>{currentQ.explanation}</p>}
                  {currentQ.solutionImageDataUrl && (
                    <div className="pex-image-wrap solution">
                      <img
                        src={currentQ.solutionImageDataUrl}
                        alt="Solution"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pex-actions">
                <button
                  type="button"
                  className="yt-action"
                  disabled={index <= 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  Previous
                </button>
                {!isReview && (
                  <>
                    <button
                      type="button"
                      className="yt-action"
                      onClick={() =>
                        patchCurrent({
                          markedForReview: !currentState.markedForReview,
                        })
                      }
                    >
                      {currentState.markedForReview
                        ? 'Unmark'
                        : 'Mark for review'}
                    </button>
                    <button
                      type="button"
                      className="yt-action"
                      onClick={() => patchCurrent({ choice: null })}
                    >
                      Clear
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="yt-action solid"
                  disabled={index >= total - 1}
                  onClick={() =>
                    setIndex((i) => Math.min(total - 1, i + 1))
                  }
                >
                  {isReview ? 'Next' : 'Save & next'}
                </button>
              </div>
            </>
          ) : (
            <p className="lede">Question image missing from bank.</p>
          )}
        </main>
      </div>

      {confirmSubmit && (
        <div className="pex-modal" role="dialog" aria-modal="true">
          <div className="pex-modal-card">
            <h2>Submit drill?</h2>
            <p>
              Answered {answered}/{total}. Marked {marked}. Timer left{' '}
              {formatClock(remainingMs)}.
            </p>
            <div className="pex-result-actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => void submit()}
              >
                Submit now
              </button>
              <button
                type="button"
                className="btn ghost-btn"
                onClick={() => setConfirmSubmit(false)}
              >
                Keep solving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
