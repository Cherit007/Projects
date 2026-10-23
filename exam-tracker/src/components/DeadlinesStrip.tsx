import { Link } from 'react-router-dom'
import { daysUntil, upcomingDeadlines } from '../data/deadlines'

export function DeadlinesStrip() {
  const items = upcomingDeadlines(8)

  if (items.length === 0) return null

  return (
    <section className="deadlines" aria-label="Upcoming deadlines">
      <div className="section-head">
        <h2>Upcoming</h2>
        <span className="soft-chip">verify official dates</span>
      </div>
      <div className="deadline-rail">
        {items.map((d) => {
          const days = daysUntil(d.when)
          const tone =
            days < 0 ? 'past' : days <= 14 ? 'soon' : days <= 45 ? 'near' : 'later'
          return (
            <Link
              key={`${d.examId}-${d.kind}-${d.date}`}
              to={`/exam/${d.examId}`}
              className={`deadline-card ${tone}`}
            >
              <span className="deadline-days">
                {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
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
