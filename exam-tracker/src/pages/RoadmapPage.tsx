import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AREA_LABELS } from '../data/topics'
import { useProgress } from '../hooks/useProgress'
import {
  PHASE_LABELS,
  buildRoadmap,
  etaDays,
  examRoadStrips,
  formatEta,
  roadmapTotals,
  type RoadmapPhase,
} from '../utils/roadmap'

const HOURS_KEY = 'exampulse-daily-minutes'

export function RoadmapPage() {
  const navigate = useNavigate()
  const {
    starred,
    completed,
    mockScores,
    isDone,
    isSubDone,
    weakAreas,
    setFocusExam,
  } = useProgress()

  const [dailyMinutes, setDailyMinutes] = useState(() => {
    const raw = localStorage.getItem(HOURS_KEY)
    const n = raw ? Number(raw) : 150
    return Number.isFinite(n) && n > 0 ? n : 150
  })

  useEffect(() => {
    localStorage.setItem(HOURS_KEY, String(dailyMinutes))
  }, [dailyMinutes])

  const weakIds = useMemo(
    () => weakAreas.map((w) => w.topic.id),
    [weakAreas],
  )

  const items = useMemo(
    () =>
      buildRoadmap({
        starredIds: starred,
        completed,
        isDone,
        isSubDone,
        weakTopicIds: weakIds,
      }),
    [starred, completed, isDone, isSubDone, weakIds],
  )

  const totals = useMemo(() => roadmapTotals(items), [items])
  const days = etaDays(totals.hoursLeft, dailyMinutes)

  const strips = useMemo(
    () =>
      examRoadStrips({
        starredIds: starred,
        completed,
        mockScores,
        isDone,
        isSubDone,
        dailyMinutes,
      }),
    [starred, completed, mockScores, isDone, isSubDone, dailyMinutes],
  )

  const next = items.find((i) => !i.fullyDone)

  const byPhase = useMemo(() => {
    const order: RoadmapPhase[] = ['foundation', 'specific', 'polish']
    return order
      .map((phase) => ({
        phase,
        label: PHASE_LABELS[phase],
        rows: items.filter((i) => i.phase === phase),
      }))
      .filter((g) => g.rows.length > 0)
  }, [items])

  if (starred.length === 0) {
    return (
      <div className="roadmap-page">
        <header className="section-head stack">
          <div>
            <h1>Roadmap</h1>
            <p className="lede">
              Star target exams on the dashboard. We’ll merge their syllabi,
              put shared topics first, and estimate finish time from your daily
              study minutes.
            </p>
          </div>
        </header>
        <div className="roadmap-empty">
          <p>No ★ favorites yet.</p>
          <Link to="/" className="btn primary">
            Pick targets
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="roadmap-page">
      <header className="section-head stack">
        <div>
          <h1>Roadmap</h1>
          <p className="lede">
            Built from {starred.length} starred exam
            {starred.length === 1 ? '' : 's'}. Shared foundation first, then
            exam-specific depth, then polish.
          </p>
        </div>
      </header>

      <section className="roadmap-summary" aria-label="Plan summary">
        <div className="roadmap-stat">
          <em>Topics left</em>
          <strong>
            {totals.pendingCount}
            <span> / {totals.topicCount}</span>
          </strong>
        </div>
        <div className="roadmap-stat">
          <em>Hours left</em>
          <strong>{totals.hoursLeft}h</strong>
        </div>
        <div className="roadmap-stat">
          <em>ETA</em>
          <strong>{formatEta(days)}</strong>
        </div>
        <label className="roadmap-minutes">
          <span>Daily study</span>
          <select
            value={dailyMinutes}
            onChange={(e) => setDailyMinutes(Number(e.target.value))}
          >
            <option value={60}>1 hour / day</option>
            <option value={90}>1.5 hours / day</option>
            <option value={120}>2 hours / day</option>
            <option value={150}>2.5 hours / day</option>
            <option value={180}>3 hours / day</option>
            <option value={240}>4 hours / day</option>
          </select>
        </label>
      </section>

      {next && (
        <section className="roadmap-next">
          <div>
            <p className="eyebrow">Start here</p>
            <h2>{next.topic.title}</h2>
            <p>
              {PHASE_LABELS[next.phase]} · ~{next.hoursLeft}h left · used by{' '}
              {next.examLabels.join(', ')}
            </p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const focusId = next.examIds[0]
              if (focusId) setFocusExam(focusId)
              navigate('/focus')
            }}
          >
            Start next
          </button>
        </section>
      )}

      <section className="roadmap-strips" aria-label="Favorite exam progress">
        <h2 className="roadmap-section-title">Your favorites</h2>
        <div className="roadmap-strip-grid">
          {strips.map((s) => (
            <Link key={s.exam.id} to={`/exam/${s.exam.id}`} className="roadmap-strip">
              <strong>{s.exam.shortName}</strong>
              <span>Ready {s.readiness}%</span>
              <span>
                {s.topicsLeft} topics · {s.hoursLeft}h · {formatEta(s.etaDays)}
              </span>
              <div className="roadmap-bar" aria-hidden>
                <i style={{ width: `${Math.min(100, s.readiness)}%` }} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {byPhase.map((group) => (
        <section key={group.phase} className="roadmap-phase">
          <h2 className="roadmap-section-title">{group.label}</h2>
          <ol className="roadmap-queue">
            {group.rows.map((row, idx) => (
              <li
                key={row.topic.id}
                className={row.fullyDone ? 'done' : undefined}
              >
                <span className="plan-num">{idx + 1}</span>
                <div className="roadmap-queue-body">
                  <strong>{row.topic.title}</strong>
                  <em>
                    {AREA_LABELS[row.topic.area]} · {row.pct}% · ~
                    {row.hoursLeft}h left · {row.examLabels.join(' · ')}
                  </em>
                </div>
                {!row.fullyDone && (
                  <button
                    type="button"
                    className="ghost roadmap-go"
                    onClick={() => {
                      setFocusExam(row.examIds[0])
                      navigate('/focus')
                    }}
                  >
                    Focus
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
