import { Link } from 'react-router-dom'
import { daysUntil, upcomingDeadlines } from '../data/deadlines'

type Props = {
  limit?: number
  /** Skip outer heading when nested in a fold. */
  nested?: boolean
}

export function DeadlinesStrip({ limit = 8, nested = false }: Props) {
  const items = upcomingDeadlines(limit)

  if (items.length === 0) return null

  return (
    <section
      className={`deadlines${nested ? ' deadlines-nested' : ''}`}
      aria-label="Upcoming deadlines"
    >
      {!nested && (
        <div className="section-head">
          <h2>Upcoming</h2>
          <span className="soft-chip">verify official dates</span>
        </div>
      )}
      <div className="deadline-rail">
        {items.map((d) => {
          const days = daysUntil(d.when)
          const tone =
            days < 0
              ? 'past'
              : days <= 14
                ? 'soon'
                : days <= 45
                  ? 'near'
                  : 'later'
          return (
            <Link
              key={`${d.examId}-${d.kind}-${d.date}`}
              to={`/exam/${d.examId}`}
              className={`deadline-card ${tone}`}
            >
              <span className="deadline-days">
                {days < 0
                  ? `${Math.abs(days)}d ago`
                  : days === 0
                    ? 'Today'
                    : `${days}d`}
              </span>
              <strong>{d.exam.shortName}</strong>
              <span className="deadline-label">
                {d.label}
                {d.approx ? ' · ~' : ''}
              </span>
              <span className="deadline-date">{d.date}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
