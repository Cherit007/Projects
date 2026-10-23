import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { WeekPlan } from '../components/WeekPlan'
import { EXAM_BY_ID } from '../data/exams'
import { AREA_LABELS } from '../data/topics'
import {
  COACH_TEMPLATES,
  useCoachTemplate,
  useDailyMinutes,
  useFoundationLock,
} from '../hooks/usePrepSettings'
import { useProgress } from '../hooks/useProgress'
import { downloadRoadmapIcs, printRoadmapPdf } from '../utils/export'
import {
  PHASE_LABELS,
  buildRoadmap,
  etaDays,
  examRoadStrips,
  formatEta,
  roadmapTotals,
  type RoadmapPhase,
} from '../utils/roadmap'
import { applyFoundationLock, buildWeekPlan } from '../utils/weekPlan'

export function RoadmapPage() {
  const navigate = useNavigate()
  const {
    starred,
    roadmapStarred,
    completed,
    mockScores,
    revision,
    isDone,
    isSubDone,
    weakAreas,
    setFocusExam,
    toggleRoadmapIgnore,
    isRoadmapIgnored,
  } = useProgress()

  const [dailyMinutes, setDailyMinutes] = useDailyMinutes()
  const [foundationLock, setFoundationLock] = useFoundationLock()
  const [coachTemplate, setCoachTemplate] = useCoachTemplate()

  const weakIds = useMemo(
    () => weakAreas.map((w) => w.topic.id),
    [weakAreas],
  )

  const items = useMemo(
    () =>
      buildRoadmap({
        starredIds: roadmapStarred,
        completed,
        isDone,
        isSubDone,
        weakTopicIds: weakIds,
      }),
    [roadmapStarred, completed, isDone, isSubDone, weakIds],
  )

  const lockState = useMemo(
    () => applyFoundationLock(items, foundationLock),
    [items, foundationLock],
  )

  const totals = useMemo(() => roadmapTotals(items), [items])
  const days = etaDays(totals.hoursLeft, dailyMinutes)

  const strips = useMemo(
    () =>
      examRoadStrips({
        starredIds: roadmapStarred,
        completed,
        mockScores,
        isDone,
        isSubDone,
        dailyMinutes,
      }),
    [roadmapStarred, completed, mockScores, isDone, isSubDone, dailyMinutes],
  )

  const next = lockState.active[0] ?? items.find((i) => !i.fullyDone)

  const weekPlan = useMemo(() => {
    if (!roadmapStarred.length) return null
    return buildWeekPlan({
      starredIds: roadmapStarred,
      completed,
      isDone,
      isSubDone,
      weakTopicIds: weakIds,
      mockScores,
      revision,
      foundationLock,
    })
  }, [
    roadmapStarred,
    completed,
    isDone,
    isSubDone,
    weakIds,
    mockScores,
    revision,
    foundationLock,
  ])

  const byPhase = useMemo(() => {
    const order: RoadmapPhase[] = ['foundation', 'specific', 'polish']
    return order
      .map((phase) => ({
        phase,
        label: PHASE_LABELS[phase],
        locked: lockState.lockedPhases.includes(phase),
        rows: items.filter((i) => i.phase === phase),
      }))
      .filter((g) => g.rows.length > 0)
  }, [items, lockState.lockedPhases])

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
            Built from {roadmapStarred.length} active ★ exam
            {roadmapStarred.length === 1 ? '' : 's'}
            {starred.length > roadmapStarred.length
              ? ` (${starred.length - roadmapStarred.length} ignored for roadmap)`
              : ''}
            . Shared foundation first, then exam-specific depth, then polish.
          </p>
        </div>
      </header>

      <section className="coach-presets" aria-label="Coach weekly template">
        <div className="section-head">
          <h2 className="roadmap-section-title">Coach template</h2>
        </div>
        <div className="filter-row wrap">
          {COACH_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={coachTemplate === t.id ? 'active' : ''}
              title={t.blurb}
              onClick={() => {
                setCoachTemplate(t.id)
                setFoundationLock(t.foundationLock)
                setDailyMinutes(t.dailyMinutes)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="muted-line plan-intro">
          {COACH_TEMPLATES.find((t) => t.id === coachTemplate)?.blurb}
        </p>
      </section>

      {starred.length > 0 && (
        <section className="roadmap-ignore" aria-label="Roadmap favorites">
          <h2 className="roadmap-section-title">★ in this roadmap</h2>
          <ul className="roadmap-ignore-list">
            {starred.map((id) => {
              const exam = EXAM_BY_ID[id]
              if (!exam) return null
              const ignored = isRoadmapIgnored(id)
              return (
                <li key={id} className={ignored ? 'ignored' : undefined}>
                  <Link to={`/exam/${id}`}>{exam.shortName}</Link>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => toggleRoadmapIgnore(id)}
                  >
                    {ignored ? 'Include in roadmap' : 'Ignore for roadmap'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

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

      <label className="foundation-lock">
        <input
          type="checkbox"
          checked={foundationLock}
          onChange={(e) => setFoundationLock(e.target.checked)}
        />
        <span>
          Foundation lock — finish ≥50% shared Quant/Reasoning/English before
          exam-specific topics
          {foundationLock ? (
            <>
              {' '}
              · now {Math.round(lockState.foundationPct * 100)}%
            </>
          ) : null}
        </span>
      </label>

      <div className="roadmap-export">
        <button
          type="button"
          className="ghost"
          onClick={() =>
            printRoadmapPdf({
              items,
              etaLabel: formatEta(days),
              hoursLeft: totals.hoursLeft,
              starredLabels: strips.map((s) => s.exam.shortName),
            })
          }
        >
          Export PDF
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!weekPlan?.slots.length}
          onClick={() => {
            if (weekPlan) downloadRoadmapIcs(weekPlan.slots)
          }}
        >
          Export week ICS
        </button>
      </div>

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

      <WeekPlan foundationLock={foundationLock} />

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
        <section
          key={group.phase}
          className={`roadmap-phase${group.locked ? ' phase-locked' : ''}`}
        >
          <h2 className="roadmap-section-title">
            {group.label}
            {group.locked ? ' · locked' : ''}
          </h2>
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
                    {row.hoursLeft}h left
                    {row.weight > 1 ? ` · ×${row.weight.toFixed(1)} weight` : ''}{' '}
                    · {row.examLabels.join(' · ')}
                  </em>
                </div>
                {!row.fullyDone && !group.locked && (
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
