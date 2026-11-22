import { useEffect, useMemo, useState } from 'react'
import {
  listStoreQuestions,
  scoreQuiz,
  type PdfDetectedQuestion,
  type PdfDetectedSolution,
  type PdfPageKind,
  type PdfQuizDocStore,
  type PdfQuizOptionKey,
  type PdfQuizQuestion,
  type PdfQuizSession,
} from '../utils/pdfPageQuiz'
import { formatClock, newId } from '../utils/questionBank'
import { putQuizSession } from '../utils/pdfPageQuizDb'
import { QuizMathText } from './QuizMathText'

type Mode = 'review' | 'solutions' | 'test' | 'result'

export function PdfQuizOverlay({
  store,
  page,
  detectedQuestions,
  detectedSolutions,
  pageKind,
  busy,
  busyLabel = 'Reading page…',
  error,
  info = '',
  extractPreview = '',
  forceSolutions,
  onClose,
  onStartDetect,
  onOcrEnglish,
  onDetectSolutions,
}: {
  store: PdfQuizDocStore
  page: number
  detectedQuestions: PdfDetectedQuestion[]
  detectedSolutions: PdfDetectedSolution[]
  pageKind?: PdfPageKind | null
  busy: boolean
  busyLabel?: string
  error: string
  info?: string
  extractPreview?: string
  forceSolutions?: boolean
  onClose: () => void
  onStartDetect: () => void
  onOcrEnglish?: () => void
  onDetectSolutions: () => void
}) {
  const [mode, setMode] = useState<Mode>(
    forceSolutions ? 'solutions' : 'review',
  )
  const [selected, setSelected] = useState<number[]>(
    detectedQuestions.map((q) => q.number),
  )
  const [perQuestionSec, setPerQuestionSec] = useState(90)
  const [totalSec, setTotalSec] = useState(0)
  const [session, setSession] = useState<PdfQuizSession | null>(null)
  const [qStartedAt, setQStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  const all = listStoreQuestions(store)
  const pageQs = useMemo(
    () =>
      detectedQuestions.length
        ? detectedQuestions
        : all.filter((q) => q.sourcePage === page),
    [all, detectedQuestions, page],
  )

  useEffect(() => {
    if (forceSolutions) setMode('solutions')
  }, [forceSolutions])

  useEffect(() => {
    setSelected(
      (detectedQuestions.length ? detectedQuestions : pageQs).map(
        (q) => q.number,
      ),
    )
  }, [detectedQuestions, pageQs])

  useEffect(() => {
    if (mode !== 'test' || !session) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [mode, session])

  const currentQ: PdfQuizQuestion | null = useMemo(() => {
    if (!session) return null
    const n = session.questionNumbers[session.index]
    return store.questions[String(n)] || null
  }, [session, store.questions])

  const qElapsedSec = Math.floor((now - qStartedAt) / 1000)
  const totalElapsedSec = session
    ? Math.floor((now - new Date(session.startedAt).getTime()) / 1000)
    : 0

  const submit = async () => {
    if (!session) return
    const next: PdfQuizSession = {
      ...session,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    }
    setSession(next)
    await putQuizSession(next)
    setMode('result')
  }

  const goNext = (auto = false) => {
    if (!session) return
    if (session.index >= session.questionNumbers.length - 1) {
      void submit()
      return
    }
    const next = { ...session, index: session.index + 1 }
    setSession(next)
    setQStartedAt(Date.now())
    void putQuizSession(next)
    void auto
  }

  useEffect(() => {
    if (mode !== 'test' || !session || !currentQ) return
    if (session.perQuestionSec > 0 && qElapsedSec >= session.perQuestionSec) {
      goNext(true)
    }
    if (session.totalSec > 0 && totalElapsedSec >= session.totalSec) {
      void submit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qElapsedSec, totalElapsedSec, mode])

  const toggle = (n: number) => {
    setSelected((prev) =>
      prev.includes(n)
        ? prev.filter((x) => x !== n)
        : [...prev, n].sort((a, b) => a - b),
    )
  }

  const startTest = async () => {
    const nums = selected.length ? selected : pageQs.map((q) => q.number)
    if (!nums.length) return
    const s: PdfQuizSession = {
      id: newId('pq'),
      docId: store.docId,
      questionNumbers: nums,
      index: 0,
      answers: Object.fromEntries(nums.map((n) => [String(n), null])),
      startedAt: new Date().toISOString(),
      perQuestionSec,
      totalSec,
      status: 'in_progress',
    }
    await putQuizSession(s)
    setSession(s)
    setQStartedAt(Date.now())
    setMode('test')
  }

  const choose = (letter: PdfQuizOptionKey) => {
    if (!session || !currentQ) return
    const next = {
      ...session,
      answers: { ...session.answers, [String(currentQ.number)]: letter },
    }
    setSession(next)
    void putQuizSession(next)
  }

  const goPrev = () => {
    if (!session || session.index <= 0) return
    const next = { ...session, index: session.index - 1 }
    setSession(next)
    setQStartedAt(Date.now())
    void putQuizSession(next)
  }

  const result = session ? scoreQuiz(session, store) : null
  const looksLikeSolutions =
    pageKind === 'solutions' ||
    (pageKind === 'other' && !pageQs.length) ||
    (pageKind === 'mixed' && !pageQs.length)

  return (
    <div className="pdf-quiz-overlay" role="dialog" aria-modal="true">
      <div className="pdf-quiz-panel">
        <header className="pdf-quiz-head">
          <div>
            <p className="pdf-kicker">Page {page} · auto test</p>
            <h2>
              {mode === 'test'
                ? `Q ${session ? session.index + 1 : 0} / ${session?.questionNumbers.length ?? 0}`
                : mode === 'result'
                  ? 'Result'
                  : mode === 'solutions'
                    ? 'Solutions mapped'
                    : 'Detected questions'}
            </h2>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </header>

        {error && <p className="pdf-status error">{error}</p>}
        {info && !busy && <p className="pdf-status muted">{info}</p>}
        {busy && <p className="pdf-status muted">{busyLabel}</p>}

        {mode === 'review' && (
          <>
            {looksLikeSolutions && (
              <div className="pdf-quiz-suggest">
                <p>
                  This looks like a solutions / answer-key page. Map answers to
                  questions you already detected, or keep browsing.
                </p>
                <div className="pdf-quiz-actions">
                  <button
                    type="button"
                    className="pdf-side-btn primary"
                    disabled={busy}
                    onClick={onDetectSolutions}
                  >
                    Map solutions
                  </button>
                  <button
                    type="button"
                    className="pdf-doubt-btn"
                    onClick={onClose}
                  >
                    Keep browsing
                  </button>
                </div>
              </div>
            )}

            <div className="pdf-quiz-actions">
              <button
                type="button"
                className="pdf-side-btn primary"
                disabled={busy}
                onClick={onStartDetect}
              >
                {pageQs.length ? 'Re-detect page' : 'Detect questions'}
              </button>
              {onOcrEnglish && (
                <button
                  type="button"
                  className="pdf-side-btn"
                  disabled={busy}
                  onClick={onOcrEnglish}
                  title="Most accurate for English+Hindi pages — OCRs left column only"
                >
                  OCR English column
                </button>
              )}
              <button
                type="button"
                className="pdf-doubt-btn"
                disabled={busy}
                onClick={onDetectSolutions}
              >
                Map solutions
              </button>
            </div>
            <p className="pdf-quiz-hint">
              Hindi is ignored. If stems look jumbled, use{' '}
              <strong>OCR English column</strong> — it reads only the left
              English side of the page (more accurate on Champion books).
            </p>

            {pageQs.length === 0 && extractPreview ? (
              <details className="pdf-quiz-extract">
                <summary>Text we read from this page</summary>
                <pre>{extractPreview}</pre>
              </details>
            ) : null}

            {pageQs.length === 0 ? (
              !looksLikeSolutions && (
                <p className="pdf-empty-side">
                  No questions yet — detect this page, or keep browsing the PDF.
                </p>
              )
            ) : (
              <>
                <ul className="pdf-quiz-list">
                  {pageQs.map((q) => {
                    const full = store.questions[String(q.number)] || q
                    const checked = selected.includes(q.number)
                    const stem = 'stem' in full ? full.stem : ''
                    return (
                      <li key={q.number} className="pdf-quiz-item">
                        <label className="pdf-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(q.number)}
                          />
                          <strong>Q{q.number}</strong>
                        </label>
                        <QuizMathText
                          text={stem}
                          as="p"
                          className="pdf-quiz-stem"
                        />
                        <div className="pdf-quiz-opts">
                          {(['A', 'B', 'C', 'D'] as const).map((k) => {
                            const text =
                              'options' in full ? full.options[k] : undefined
                            if (!text) return null
                            const ans =
                              'answer' in full ? full.answer : undefined
                            return (
                              <span
                                key={k}
                                className={`pdf-quiz-opt${ans === k ? ' key' : ''}`}
                              >
                                <em>({k})</em>{' '}
                                <QuizMathText text={text} />
                              </span>
                            )
                          })}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className="pdf-quiz-setup">
                  <label>
                    Sec / question
                    <input
                      type="number"
                      min={0}
                      value={perQuestionSec}
                      onChange={(e) =>
                        setPerQuestionSec(Number(e.target.value) || 0)
                      }
                    />
                  </label>
                  <label>
                    Total sec (0=off)
                    <input
                      type="number"
                      min={0}
                      value={totalSec}
                      onChange={(e) => setTotalSec(Number(e.target.value) || 0)}
                    />
                  </label>
                </div>

                <div className="pdf-quiz-actions">
                  <button
                    type="button"
                    className="pdf-side-btn primary"
                    disabled={!selected.length}
                    onClick={() => void startTest()}
                  >
                    Start timed test ({selected.length})
                  </button>
                  <button
                    type="button"
                    className="pdf-doubt-btn"
                    onClick={onClose}
                  >
                    Keep browsing PDF
                  </button>
                </div>
                <p className="pdf-quiz-hint">
                  Bank has {all.length} mapped question
                  {all.length === 1 ? '' : 's'} for this PDF
                  {detectedSolutions.length
                    ? ` · just linked ${detectedSolutions.length} solution(s)`
                    : ''}
                  .
                </p>
              </>
            )}
          </>
        )}

        {mode === 'solutions' && (
          <>
            <p className="lede">
              Linked {detectedSolutions.length} answer
              {detectedSolutions.length === 1 ? '' : 's'} from page {page}.
            </p>
            <ul className="pdf-quiz-list">
              {detectedSolutions.map((s) => (
                <li key={s.number}>
                  <strong>
                    Q{s.number} → {s.answer}
                  </strong>
                  {s.explanation ? (
                    <QuizMathText text={s.explanation} as="p" />
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="pdf-quiz-actions">
              <button
                type="button"
                className="pdf-side-btn primary"
                onClick={() => setMode('review')}
              >
                Back to questions
              </button>
              <button type="button" className="pdf-doubt-btn" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}

        {mode === 'test' && session && currentQ && (
          <div className="pdf-quiz-runner">
            <div className="pdf-quiz-timers">
              <span>
                Q time {formatClock(qElapsedSec, 'sec')}
                {session.perQuestionSec
                  ? ` / ${formatClock(session.perQuestionSec, 'sec')}`
                  : ''}
              </span>
              <span>
                Total {formatClock(totalElapsedSec, 'sec')}
                {session.totalSec
                  ? ` / ${formatClock(session.totalSec, 'sec')}`
                  : ''}
              </span>
            </div>
            <div className="pdf-quiz-qhead">
              <span className="pdf-quiz-qnum">Q{currentQ.number}</span>
              <QuizMathText
                text={currentQ.stem}
                as="div"
                className="pdf-quiz-stem"
              />
            </div>
            {currentQ.stemHi ? (
              <QuizMathText
                text={currentQ.stemHi}
                as="p"
                className="pdf-quiz-hi"
              />
            ) : null}
            <div className="pdf-quiz-choices">
              {(['A', 'B', 'C', 'D'] as const).map((k) => {
                const text = currentQ.options[k]
                if (!text) return null
                const active = session.answers[String(currentQ.number)] === k
                return (
                  <button
                    key={k}
                    type="button"
                    className={active ? 'active' : ''}
                    onClick={() => choose(k)}
                  >
                    <strong>{k}</strong>
                    <QuizMathText text={text} />
                  </button>
                )
              })}
            </div>
            <div className="pdf-quiz-actions">
              <button
                type="button"
                className="pdf-doubt-btn"
                disabled={session.index === 0}
                onClick={goPrev}
              >
                Prev
              </button>
              <button
                type="button"
                className="pdf-side-btn primary"
                onClick={() => goNext()}
              >
                {session.index >= session.questionNumbers.length - 1
                  ? 'Submit'
                  : 'Next'}
              </button>
            </div>
          </div>
        )}

        {mode === 'result' && session && result && (
          <div className="pdf-quiz-result">
            <p className="lede">
              Correct {result.correct} · Wrong {result.wrong} · Skipped{' '}
              {result.skipped} / {result.total}
            </p>
            <ul className="pdf-quiz-list">
              {session.questionNumbers.map((n) => {
                const q = store.questions[String(n)]
                const choice = session.answers[String(n)]
                const ok = q?.answer && choice === q.answer
                return (
                  <li key={n}>
                    <strong>
                      Q{n}{' '}
                      {q?.answer
                        ? ok
                          ? '✓'
                          : choice
                            ? '✗'
                            : '—'
                        : '(no key yet)'}
                    </strong>
                    {q?.stem ? (
                      <QuizMathText
                        text={q.stem}
                        as="p"
                        className="pdf-quiz-stem"
                      />
                    ) : null}
                    <p>
                      Your: {choice || '—'}
                      {q?.answer ? ` · Key: ${q.answer}` : ''}
                    </p>
                    {q?.explanation ? (
                      <QuizMathText text={q.explanation} as="p" />
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <div className="pdf-quiz-actions">
              <button
                type="button"
                className="pdf-side-btn primary"
                onClick={() => {
                  setMode('review')
                  setSession(null)
                }}
              >
                Back
              </button>
              <button type="button" className="pdf-doubt-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
