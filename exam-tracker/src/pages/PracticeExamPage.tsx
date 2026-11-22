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

type Mode = 'loading' | 'instructions' | 'exam' | 'result' | 'review' | 'missing'

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
  const [paletteOpen, setPaletteOpen] = useState(true)

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
    if (bundle.attempt.status === 'submitted') {
      setMode('result')
    } else {
      // Fresh or resume → instructions first if not visited any
      const anyVisited = Object.values(bundle.attempt.answers).some(
        (a) => a?.visited || a?.choice,
      )
      if (anyVisited) {
        const firstOpen = bundle.attempt.questionIds.findIndex((id) => {
          const st = bundle.attempt.answers[id]
          return !st?.choice
        })
        setIndex(firstOpen >= 0 ? firstOpen : 0)
        setMode('exam')
      } else {
        setMode('instructions')
      }
    }
  }, [attemptId, loadAttemptBundle])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    document.documentElement.classList.add('practice-exam-active')
    document.title = attempt?.topicTitle
      ? `${attempt.topicTitle} · ExamPulse`
      : 'ExamPulse drill'
    return () => {
      document.documentElement.classList.remove('practice-exam-active')
      document.title = 'ExamPulse'
    }
  }, [attempt?.topicTitle])

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

  useEffect(() => {
    if (mode !== 'exam' || !attempt) return
    if (remainingMs > 0) return
    void submit()
  }, [mode, attempt, remainingMs, submit])

  const score = useMemo(() => {
    if (!attempt || attempt.status !== 'submitted') return null
    return scoreAttempt(attempt, questions)
  }, [attempt, questions])

  const startExam = () => {
    setIndex(0)
    setMode('exam')
    const cur = attemptRef.current
    if (!cur) return
    const qid = cur.questionIds[0]
    if (!qid) return
    const prev = cur.answers[qid] ?? emptyAttemptState()
    void persist({
      ...cur,
      answers: {
        ...cur.answers,
        [qid]: { ...prev, visited: true },
      },
    })
  }

  if (mode === 'loading') {
    return (
      <div className="ob-shell">
        <p className="lede">Opening exam window…</p>
      </div>
    )
  }

  if (mode === 'missing' || !attempt) {
    return (
      <div className="ob-shell">
        <p className="lede">Attempt not found.</p>
        <Link className="btn primary" to="/practice">
          Back to practice bank
        </Link>
      </div>
    )
  }

  const total = attempt.questionIds.length
  const answered = attempt.questionIds.filter(
    (id) => attempt.answers[id]?.choice != null,
  ).length
  const marked = attempt.questionIds.filter(
    (id) => attempt.answers[id]?.markedForReview,
  ).length
  const notVisited = attempt.questionIds.filter(
    (id) => !attempt.answers[id]?.visited && !attempt.answers[id]?.choice,
  ).length
  const notAnswered = total - answered

  if (mode === 'instructions') {
    return (
      <div className="ob-shell ob-instructions">
        <header className="ob-header">
          <strong>{attempt.topicTitle}</strong>
          <span className="ob-brand">ExamPulse</span>
        </header>
        <div className="ob-instr-layout">
          <main className="ob-instr-main">
            <h1>Please read the following instructions carefully</h1>
            <p>
              Total Number of Questions: <strong>{total}</strong>
              <br />
              Total Time Available:{' '}
              <strong>
                {Math.round(attempt.config.durationSec / 60)} Mins
              </strong>
            </p>
            <table className="ob-instr-table">
              <thead>
                <tr>
                  <th>Section #</th>
                  <th>Section Name</th>
                  <th>Questions</th>
                  <th>Max Score</th>
                  <th>+ve</th>
                  <th>−ve</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>Sectional</td>
                  <td>{total}</td>
                  <td>{total * attempt.config.marksCorrect}</td>
                  <td>{attempt.config.marksCorrect}</td>
                  <td>{attempt.config.marksWrong}</td>
                </tr>
              </tbody>
            </table>

            <h2>Question status legend</h2>
            <ul className="ob-legend-list">
              <li>
                <i className="ob-leg grey" /> Not visited
              </li>
              <li>
                <i className="ob-leg orange" /> Not answered
              </li>
              <li>
                <i className="ob-leg green" /> Answered
              </li>
              <li>
                <i className="ob-leg purple" /> Marked for review
              </li>
              <li>
                <i className="ob-leg purple-check" /> Answered &amp; marked
              </li>
            </ul>

            <ol className="ob-instr-steps">
              <li>
                Total of {Math.round(attempt.config.durationSec / 60)} mins
                duration will be given to attempt all the questions.
              </li>
              <li>
                Each correct answer awards {attempt.config.marksCorrect} mark
                {attempt.config.marksCorrect === 1 ? '' : 's'}; wrong answers
                deduct {attempt.config.marksWrong}.
              </li>
              <li>
                Use <em>Mark for Review &amp; Next</em> to flag a question and
                move on. You can return via the palette.
              </li>
              <li>English only — Hindi text from books is not shown.</li>
            </ol>
          </main>
          <aside className="ob-instr-side">
            <div className="ob-photo-ph" aria-hidden="true" />
            <p>Your photo appears here</p>
          </aside>
        </div>
        <footer className="ob-instr-foot">
          <label>
            Language
            <select defaultValue="en" aria-label="Language">
              <option value="en">English</option>
            </select>
          </label>
          <button type="button" className="ob-start-btn" onClick={startExam}>
            Start Test in Sectional Tests Interface
          </button>
        </footer>
      </div>
    )
  }

  if (mode === 'result' && score) {
    return (
      <div className="ob-shell ob-result">
        <header className="ob-header">
          <strong>{attempt.topicTitle}</strong>
          <span className="ob-brand">ExamPulse</span>
        </header>
        <div className="ob-result-body">
          <h1>Drill complete</h1>
          <p className="lede">
            {score.marks} / {score.maxMarks} · {score.accuracy}% accuracy
          </p>
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
              onClick={() => {
                if (window.opener) window.close()
                else navigate('/practice')
              }}
            >
              Close window
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isReview = mode === 'review'
  const reviewRow =
    isReview && currentId && score
      ? score.perQuestion.find((p) => p.questionId === currentId)
      : null

  const saveAndNext = () => {
    if (index >= total - 1) {
      setConfirmSubmit(true)
      return
    }
    patchCurrent({}, { go: index + 1 })
  }

  const markReviewAndNext = () => {
    const nextIdx = Math.min(total - 1, index + 1)
    patchCurrent({ markedForReview: true }, { go: nextIdx })
  }

  const optionKeys: AnswerKey[] =
    currentQ?.options && Object.keys(currentQ.options).length
      ? ANSWER_KEYS.filter((k) => Boolean(currentQ.options?.[k]))
      : (['A', 'B', 'C', 'D'] as AnswerKey[])

  return (
    <div className={`ob-shell ob-exam${isReview ? ' is-review' : ''}`}>
      <header className="ob-header">
        <strong>{attempt.topicTitle}</strong>
        <span className="ob-brand">ExamPulse</span>
      </header>

      <div className="ob-subhead">
        <div className="ob-sections">
          <span>Sections</span>
          <button type="button" className="ob-sec-pill active">
            Sectional
          </button>
        </div>
        <label className="ob-lang">
          Language
          <select defaultValue="en">
            <option value="en">English</option>
          </select>
        </label>
        <div className="ob-timer-wrap">
          {!isReview ? (
            <>
              <span
                className={`ob-timer${remainingMs < 60_000 ? ' urgent' : ''}`}
              >
                Time Left: {formatClock(remainingMs)}
              </span>
              <button
                type="button"
                className="ob-pause"
                onClick={() => setConfirmSubmit(true)}
              >
                Submit
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ob-pause"
              onClick={() => setMode('result')}
            >
              Scorecard
            </button>
          )}
        </div>
      </div>

      <div className={`ob-exam-body${paletteOpen ? '' : ' palette-collapsed'}`}>
        <main className="ob-q-panel">
          {currentQ ? (
            <>
              <h2>Question No {index + 1}</h2>
              {currentQ.stem ? (
                <div className="ob-stem">
                  <p>{currentQ.stem}</p>
                  {currentQ.options && (
                    <div className="ob-opts" role="radiogroup">
                      {optionKeys.map((key) => {
                        const label = currentQ.options?.[key]
                        if (!label) return null
                        const active = currentState.choice === key
                        return (
                          <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={active ? 'active' : undefined}
                            disabled={isReview}
                            onClick={() =>
                              patchCurrent({ choice: key as AnswerKey })
                            }
                          >
                            <em>({key.toLowerCase()})</em> {label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {currentQ.prompt && (
                    <p className="ob-prompt">{currentQ.prompt}</p>
                  )}
                  <div className="ob-image-wrap">
                    <img
                      src={currentQ.imageDataUrl}
                      alt={`Question ${index + 1}`}
                    />
                  </div>
                  {!isReview && (
                    <div className="ob-opts letters" role="radiogroup">
                      {ANSWER_KEYS.slice(0, 5).map((key) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={currentState.choice === key}
                          className={
                            currentState.choice === key ? 'active' : undefined
                          }
                          onClick={() =>
                            patchCurrent({ choice: key as AnswerKey })
                          }
                        >
                          ({key.toLowerCase()})
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {isReview && (
                <div className="ob-review">
                  <p>
                    Correct: <strong>{currentQ.answerKey}</strong>
                    {currentState.choice
                      ? ` · You: ${currentState.choice}`
                      : ' · Not attempted'}
                    {reviewRow && (
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
                            : 'Wrong'}
                      </span>
                    )}
                  </p>
                  {currentQ.explanation && <p>{currentQ.explanation}</p>}
                  {currentQ.solutionImageDataUrl && (
                    <div className="ob-image-wrap solution">
                      <img
                        src={currentQ.solutionImageDataUrl}
                        alt="Solution"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="ob-q-actions">
                {!isReview && (
                  <>
                    <button
                      type="button"
                      className="ob-btn light"
                      onClick={markReviewAndNext}
                    >
                      Mark for Review &amp; Next
                    </button>
                    <button
                      type="button"
                      className="ob-btn light"
                      onClick={() => patchCurrent({ choice: null })}
                    >
                      Clear Response
                    </button>
                    <button
                      type="button"
                      className="ob-btn solid"
                      onClick={saveAndNext}
                    >
                      Save &amp; Next
                    </button>
                  </>
                )}
                {isReview && (
                  <>
                    <button
                      type="button"
                      className="ob-btn light"
                      disabled={index <= 0}
                      onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="ob-btn solid"
                      disabled={index >= total - 1}
                      onClick={() =>
                        setIndex((i) => Math.min(total - 1, i + 1))
                      }
                    >
                      Next
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="lede">Question missing from bank.</p>
          )}
        </main>

        <aside className="ob-palette" aria-label="Question palette">
          <button
            type="button"
            className="ob-palette-toggle"
            onClick={() => setPaletteOpen((v) => !v)}
            aria-label={paletteOpen ? 'Collapse palette' : 'Expand palette'}
          >
            {paletteOpen ? '»' : '«'}
          </button>
          {paletteOpen && (
            <>
              <div className="ob-pal-stats">
                <span>
                  <i className="ob-leg green" /> {answered} Answered
                </span>
                <span>
                  <i className="ob-leg orange" /> {notAnswered} Not Answered
                </span>
                <span>
                  <i className="ob-leg purple" /> {marked} Marked
                </span>
                <span>
                  <i className="ob-leg grey" /> {notVisited} Not Visited
                </span>
              </div>
              <div className="ob-pal-grid">
                {attempt.questionIds.map((qid, i) => {
                  const st = attempt.answers[qid] ?? emptyAttemptState()
                  const row = score?.perQuestion[i]
                  let cls = 'ob-pal'
                  if (isReview && row) {
                    cls += row.isSkipped
                      ? ' skip'
                      : row.isCorrect
                        ? ' ok'
                        : ' bad'
                  } else if (st.choice && st.markedForReview) {
                    cls += ' ans-mark'
                  } else if (st.markedForReview) {
                    cls += ' mark'
                  } else if (st.choice) {
                    cls += ' ans'
                  } else if (st.visited) {
                    cls += ' visit'
                  } else {
                    cls += ' grey'
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
              <div className="ob-pal-foot">
                <button
                  type="button"
                  className="ob-btn light"
                  onClick={() => setMode('instructions')}
                >
                  Instructions
                </button>
                {!isReview && (
                  <button
                    type="button"
                    className="ob-btn solid"
                    onClick={() => setConfirmSubmit(true)}
                  >
                    Submit
                  </button>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {confirmSubmit && (
        <div className="pex-modal" role="dialog" aria-modal="true">
          <div className="pex-modal-card">
            <h2>Submit test?</h2>
            <p>
              Answered {answered}/{total}. Marked {marked}. Time left{' '}
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
