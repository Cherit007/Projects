import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'
import { buildWeekPlan } from '../utils/weekPlan'

type Props = {
  foundationLock: boolean
  /** Hide duplicate heading when nested in a fold. */
  compact?: boolean
}

export function WeekPlan({ foundationLock, compact = false }: Props) {
  const navigate = useNavigate()
  const {
    roadmapStarred,
    completed,
    isDone,
    isSubDone,
    weakAreas,
    mockScores,
    revision,
    setFocusExam,
  } = useProgress()

  const weakIds = useMemo(
    () => weakAreas.map((w) => w.topic.id),
    [weakAreas],
  )

  const plan = useMemo(() => {
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

  if (!roadmapStarred.length || !plan) return null

  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <section
      className={`week-plan${compact ? ' week-plan-nested' : ''}`}
      aria-label="This week"
    >
      {!compact && (
        <>
          <div className="section-head">
            <h2>This week</h2>
            <div className="chip-wrap">
              {plan.mockHeavy && (
                <span className="soft-chip sunk-chip">Deadline mode</span>
              )}
              {plan.locked && (
                <span className="soft-chip pin-chip">
                  Foundation {Math.round(plan.foundationPct * 100)}%
                </span>
              )}
            </div>
          </div>
          <p className="muted-line plan-intro">
            Mon–Fri learn · weak drill · weekend mock + revision
            {plan.locked
              ? ' · exam-specific locked until foundation ≥50%'
              : ''}
            .
          </p>
        </>
      )}
      {compact && (plan.mockHeavy || plan.locked) && (
        <div className="chip-wrap week-nested-chips">
          {plan.mockHeavy && (
            <span className="soft-chip sunk-chip">Deadline mode</span>
          )}
          {plan.locked && (
            <span className="soft-chip pin-chip">
              Foundation {Math.round(plan.foundationPct * 100)}%
            </span>
          )}
        </div>
      )}
      <ol className="week-plan-list">
        {plan.slots.map((slot) => {
          const isToday = slot.dateIso === todayIso
          return (
            <li
              key={slot.dateIso}
              className={`week-slot kind-${slot.kind}${isToday ? ' today' : ''}`}
            >
              <div className="week-slot-day">
                <strong>{slot.day}</strong>
                <span>{slot.dateIso.slice(5)}</span>
              </div>
              <div className="week-slot-body">
                <strong>{slot.title}</strong>
                <em>{slot.why}</em>
              </div>
              <span className={`plan-kind ${slot.kind}`}>{slot.kind}</span>
              <button
                type="button"
                className="ghost week-go"
                onClick={() => {
                  if (
                    slot.examId &&
                    (slot.kind === 'learn' || slot.kind === 'drill')
                  ) {
                    setFocusExam(slot.examId)
                  }
                  if (slot.href === '/focus' && slot.examId) {
                    setFocusExam(slot.examId)
                    navigate('/focus')
                  } else {
                    navigate(slot.href)
                  }
                }}
              >
                Go
              </button>
            </li>
          )
        })}
      </ol>
      <p className="week-plan-foot">
        <Link to="/roadmap">Adjust on Roadmap</Link>
        {' · '}
        <Link to="/prep">Log mocks / revision</Link>
      </p>
    </section>
  )
}
