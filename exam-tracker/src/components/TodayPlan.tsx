import { Link } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'
import { buildTodayPlan } from '../utils/readiness'

export function TodayPlan() {
  const { completed, starred, mockScores, weakAreas, stats } = useProgress()
  const plan = buildTodayPlan({
    completed,
    starred,
    mockScores,
    weakTopicIds: weakAreas.map((w) => w.topic.id),
  })

  return (
    <section className="today-plan" aria-label="Today's plan">
      <div className="section-head">
        <h2>Today’s plan</h2>
        <span className="soft-chip">
          {stats.streak > 0 ? `${stats.streak}-day streak` : 'Start a streak'}
        </span>
      </div>
      <p className="muted-line plan-intro">
        Auto-built from deadlines, weak shared topics, and your shortlist — like
        Oliveboard “what next”, but personal.
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
