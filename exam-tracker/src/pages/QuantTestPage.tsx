import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  questionsForSection,
  type PracticeQuestion,
} from '../data/quantPracticeBank'
import { TOPIC_BY_ID } from '../data/topics'
import { useProgress } from '../hooks/useProgress'

type Phase = 'ready' | 'running' | 'done'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function QuantTestPage() {
  const { topicId = '' } = useParams()
  const navigate = useNavigate()
  const { addMock, addStudy, setTopic } = useProgress()
  const topic = TOPIC_BY_ID[topicId]
  const bank = useMemo(() => questionsForSection(topicId), [topicId])

  const [phase, setPhase] = useState<Phase>('ready')
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [showExplain, setShowExplain] = useState(false)

  const minutes = Math.max(8, Math.ceil(bank.length * 0.9))
  const current = questions[index]
  const answered = Object.keys(answers).length

  const correctCount = useMemo(() => {
    return questions.reduce(
      (n, q) => n + (answers[q.id] === q.answerId ? 1 : 0),
      0,
    )
  }, [questions, answers])

  const pct = questions.length
    ? Math.round((correctCount / questions.length) * 100)
    : 0

  useEffect(() => {
    if (phase !== 'running') return
    if (secondsLeft <= 0) {
      setPhase('done')
      return
    }
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [phase, secondsLeft])

  if (!topic || bank.length === 0) {
    return <Navigate to="/practice/quant" replace />
  }

  const start = () => {
    setQuestions(shuffle(bank))
    setAnswers({})
    setIndex(0)
    setShowExplain(false)
    setSecondsLeft(minutes * 60)
    setPhase('running')
  }

  const pick = (optionId: string) => {
    if (!current || phase !== 'running') return
    setAnswers((prev) => ({ ...prev, [current.id]: optionId }))
    setShowExplain(true)
  }

  const next = () => {
    setShowExplain(false)
    if (index + 1 >= questions.length) setPhase('done')
    else setIndex((i) => i + 1)
  }

  const saveResult = () => {
    addMock({
      examId: 'ssccgl',
      source: `Quant drill · ${topic.title}`,
      score: correctCount,
      maxScore: questions.length,
      date: new Date().toISOString().slice(0, 10),
      stage: 'sectional',
      note: `Section test: ${topic.title}`,
      sections: { quant: pct },
    })
    addStudy({
      date: new Date().toISOString().slice(0, 10),
      minutes: Math.max(
        5,
        Math.round((minutes * 60 - Math.max(0, secondsLeft)) / 60) || minutes,
      ),
      note: `Quant section: ${topic.title} (${pct}%)`,
      topicIds: [topicId],
    })
    if (pct >= 70) setTopic(topicId, true)
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="practice-page quant-test">
      <Link to="/practice/quant" className="back-link">
        ← All quant sections
      </Link>

      {phase === 'ready' && (
        <header className="section-head stack">
          <div>
            <h1>{topic.title}</h1>
            <p className="lede">
              {bank.length} exam-style questions · ~{minutes} min suggested ·
              answers + short explanations after each pick.
            </p>
          </div>
          <button type="button" className="btn primary" onClick={start}>
            Start test
          </button>
        </header>
      )}

      {phase === 'running' && current && (
        <div className="quant-test-run">
          <div className="quant-test-bar">
            <span>
              Q{index + 1}/{questions.length}
            </span>
            <span className={secondsLeft < 60 ? 'timer-warn' : ''}>
              {mm}:{ss}
            </span>
            <span>
              Answered {answered}/{questions.length}
            </span>
          </div>

          {current.passage && (
            <pre className="quant-passage">{current.passage}</pre>
          )}
          <h2 className="quant-stem">{current.stem}</h2>
          <div className="quant-options">
            {current.options.map((opt) => {
              const chosen = answers[current.id] === opt.id
              const reveal = showExplain
              const right = opt.id === current.answerId
              const cls = [
                chosen ? 'chosen' : '',
                reveal && right ? 'correct' : '',
                reveal && chosen && !right ? 'wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={cls}
                  disabled={showExplain}
                  onClick={() => pick(opt.id)}
                >
                  <span className="opt-id">{opt.id.toUpperCase()}</span>
                  {opt.text}
                </button>
              )
            })}
          </div>

          {showExplain && (
            <div className="quant-explain">
              <p>
                <strong>
                  {answers[current.id] === current.answerId
                    ? 'Correct'
                    : 'Incorrect'}
                </strong>
                {' · '}
                {current.explanation}
              </p>
              <button type="button" className="btn primary" onClick={next}>
                {index + 1 >= questions.length ? 'See score' : 'Next'}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="quant-result">
          <h1>Section score</h1>
          <p className="lede">
            {topic.title}: <strong>{correctCount}</strong> / {questions.length}{' '}
            ({pct}%)
          </p>
          <div className="quant-result-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                saveResult()
                navigate('/prep')
              }}
            >
              Save to Prep lab
            </button>
            <button type="button" className="btn ghost-btn" onClick={start}>
              Retake
            </button>
            <Link to="/practice/quant" className="btn ghost-btn">
              Other sections
            </Link>
          </div>

          <ul className="quant-review">
            {questions.map((q, i) => {
              const ok = answers[q.id] === q.answerId
              return (
                <li key={q.id} className={ok ? 'ok' : 'bad'}>
                  <span>
                    Q{i + 1} {ok ? '✓' : '✗'}
                  </span>
                  <em>{q.stem.split('\n')[0]}</em>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
