import { Link } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'

export function WeakAreas() {
  const { weakAreas, toggleTopic } = useProgress()

  if (weakAreas.length === 0) {
    return (
      <section className="weak-areas">
        <div className="section-head">
          <h2>Weak areas</h2>
        </div>
        <p className="muted-line">
          No high-overlap gaps right now — keep ticking shared topics.
        </p>
      </section>
    )
  }

  return (
    <section className="weak-areas">
      <div className="section-head">
        <h2>Weak areas</h2>
        <span className="soft-chip">shared across 3+ exams</span>
      </div>
      <ul className="weak-list">
        {weakAreas.map(({ topic, examCount, exams }) => (
          <li key={topic.id}>
            <label className="check">
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggleTopic(topic.id)}
                aria-label={topic.title}
              />
              <span>
                <strong>{topic.title}</strong>
                <em>
                  in {examCount} exams · {exams.slice(0, 4).join(', ')}
                  {exams.length > 4 ? ` +${exams.length - 4}` : ''}
                </em>
              </span>
            </label>
            <Link to="/topics" className="weak-link">
              Open graph
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
