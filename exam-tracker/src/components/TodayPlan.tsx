import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'
import { buildRoadmap } from '../utils/roadmap'
import { buildTodayPlan } from '../utils/readiness'

export function TodayPlan() {
  const {
    completed,
    starred,
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
    if (!starred.length) return []
    return buildRoadmap({
      starredIds: starred,
      completed,
      isDone,
      isSubDone,
      weakTopicIds: weakIds,
    })
      .filter((i) => !i.fullyDone)
      .slice(0, 2)
  }, [starred, completed, isDone, isSubDone, weakIds])

  const base = buildTodayPlan({
    completed,
    starred,
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
    return [...fromRoad, ...rest].slice(0, 4)
  }, [roadmapNext, base])

  return (
    <section className="today-plan" aria-label="Today's plan">
      <div className="section-head">
        <h2>Today’s plan</h2>
        <div className="chip-wrap">
          <span className="soft-chip">
            {stats.streak > 0 ? `${stats.streak}-day streak` : 'Start a streak'}
          </span>
          {starred.length > 0 && (
            <Link to="/roadmap" className="soft-chip pin-chip">
              Full roadmap →
            </Link>
          )}
        </div>
      </div>
      <p className="muted-line plan-intro">
        {starred.length > 0
          ? 'Pulled from your ★ roadmap, weak topics, and deadlines.'
          : 'Star exams to unlock a timed roadmap — until then, deadlines and weak topics drive this list.'}
      </p>
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
