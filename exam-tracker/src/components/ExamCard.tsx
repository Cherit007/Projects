import { Link } from 'react-router-dom'
import type { Exam } from '../data/types'
import { useProgress } from '../hooks/useProgress'
import { readinessScore } from '../utils/readiness'
import { ProgressRing } from './ProgressRing'

type Props = {
  exam: Exam
  pct: number
  done: number
  total: number
  pinned?: boolean
  sunk?: boolean
}

export function ExamCard({ exam, pct, done, total, pinned, sunk }: Props) {
  const {
    isStarred,
    toggleStar,
    isDeprioritized,
    toggleDeprioritize,
    completed,
    mockScores,
  } = useProgress()
  const starred = isStarred(exam.id)
  const low = sunk ?? isDeprioritized(exam.id)
  const isItOfficer = exam.tags?.includes('it-officer')
  const ready = readinessScore(exam, completed, mockScores)

  return (
    <div
      className={`exam-card tier-${exam.tier.toLowerCase()}${pinned || starred ? ' pinned' : ''}${low ? ' sunk' : ''}`}
    >
      <div className="exam-card-top">
        <div className="chip-wrap">
          <span className="tier-chip">{exam.tier}</span>
          {isItOfficer && <span className="soft-chip it-chip">IT Officer</span>}
          {(pinned || starred) && <span className="soft-chip pin-chip">Pinned</span>}
          {low && <span className="soft-chip sunk-chip">Low priority</span>}
        </div>
        <div className="exam-card-actions">
          <button
            type="button"
            className={`star-btn ${starred ? 'on' : ''}`}
            aria-label={starred ? 'Unpin favorite' : 'Pin favorite to top'}
            aria-pressed={starred}
            title={starred ? 'Unpin from top' : 'Pin to top of Targets'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleStar(exam.id)
            }}
          >
            {starred ? '★' : '☆'}
          </button>
          <button
            type="button"
            className={`sink-btn ${low ? 'on' : ''}`}
            aria-label={low ? 'Restore normal priority' : 'Deprioritize — move to bottom'}
            aria-pressed={low}
            title={low ? 'Restore normal order' : 'Deprioritize — move to bottom of Targets'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleDeprioritize(exam.id)
            }}
          >
            {low ? '↑' : '↓'}
          </button>
          <ProgressRing pct={ready.score} size={48} stroke={4} label="Readiness" />
        </div>
      </div>
      <Link to={`/exam/${exam.id}`} className="exam-card-link">
        <h3>{exam.shortName}</h3>
        <p className="exam-card-name">{exam.name}</p>
        <div className="exam-card-meta">
          <span>
            Ready {ready.score}% · {ready.label}
          </span>
          <span>
            {done}/{total} · syl {pct}%
          </span>
        </div>
        <p className="exam-card-status">{exam.status}</p>
      </Link>
    </div>
  )
}
