import { Link } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'
import { buildNextMoves } from '../utils/prepAnalytics'

export function NextMoves() {
  const { mockScores, errorLog, revision, weakAreas } = useProgress()
  const moves = buildNextMoves({
    mockScores,
    errors: errorLog,
    revision,
    weakTopicIds: weakAreas.map((w) => w.topic.id),
  })

  if (moves.length === 0) return null

  return (
    <section className="next-moves" aria-label="Next three moves">
      <div className="section-head">
        <h2>3 next moves</h2>
        <span className="soft-chip">from mocks · errors · revision</span>
      </div>
      <ol className="plan-list">
        {moves.map((item, i) => (
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
