import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'
import { buildRoadmap } from '../utils/roadmap'
import { buildTodayPlan } from '../utils/readiness'

type Props = {
  /** Shorter list + no intro copy (dashboard). */
  compact?: boolean
}

export function TodayPlan({ compact = false }: Props) {
  const {
    completed,
    starred,
    roadmapStarred,
    mockScores,
    weakAreas,
    stats,
    isDone,
    isSubDone,
  } = useProgress()

  const weakIds = useMemo(
    () => weakAreas.map((w) => w.topic.id),
    [weakAreas],
  )

  const roadmapNext = useMemo(() => {
    if (!roadmapStarred.length) return []
    return buildRoadmap({
      starredIds: roadmapStarred,
      completed,
      isDone,
      isSubDone,
      weakTopicIds: weakIds,
    })
      .filter((i) => !i.fullyDone)
      .slice(0, compact ? 1 : 2)
  }, [roadmapStarred, completed, isDone, isSubDone, weakIds, compact])

  const base = buildTodayPlan({
    completed,
    starred: roadmapStarred,
    mockScores,
    weakTopicIds: weakIds,
  })

  const plan = useMemo(() => {
    const fromRoad = roadmapNext.map((r) => ({
      id: `road-${r.topic.id}`,
      title: `Next: ${r.topic.title}`,
      why: `${r.examLabels.slice(0, 3).join(' · ')} · ~${r.hoursLeft}h left`,
      href: '/roadmap',
      kind: 'topic' as const,
    }))
    const seen = new Set(fromRoad.map((i) => i.id))
    const rest = base.filter((i) => !seen.has(i.id) && i.kind !== 'topic')
    return [...fromRoad, ...rest].slice(0, compact ? 3 : 4)
  }, [roadmapNext, base, compact])

  return (
    <section
      className={`today-plan${compact ? ' today-plan-compact' : ''}`}
      aria-label="Today's plan"
    >
      <div className="section-head">
        <h2>Today</h2>
        <div className="chip-wrap">
          {!compact && (
            <span className="soft-chip">
              {stats.streak > 0 ? `${stats.streak}-day streak` : 'Start a streak'}
            </span>
          )}
          {starred.length > 0 && (
            <Link to="/roadmap" className="soft-chip pin-chip">
              Roadmap →
            </Link>
          )}
          <Link to="/prep" className="soft-chip">
            Prep lab →
          </Link>
        </div>
      </div>
      {!compact && (
        <p className="muted-line plan-intro">
          {starred.length > 0
            ? 'Pulled from your ★ roadmap, weak topics, and deadlines.'
            : 'Star exams to unlock a timed roadmap — until then, deadlines and weak topics drive this list.'}
        </p>
      )}
      <ol className="plan-list">
        {plan.map((item, i) => (
          <li key={item.id}>
            <span className="plan-num">{i + 1}</span>
            <div>
              <Link to={item.href}>
                <strong>{item.title}</strong>
              </Link>
              <em>{item.why}</em>
            </div>
            <span className={`plan-kind ${item.kind}`}>{item.kind}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
