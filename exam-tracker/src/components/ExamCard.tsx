import { Link } from 'react-router-dom'
import type { Exam } from '../data/types'
import { useProgress } from '../hooks/useProgress'
import { ProgressRing } from './ProgressRing'

type Props = {
  exam: Exam
  pct: number
  done: number
  total: number
  pinned?: boolean
}

export function ExamCard({ exam, pct, done, total, pinned }: Props) {
  const { isStarred, toggleStar } = useProgress()
  const starred = isStarred(exam.id)
  const isItOfficer = exam.tags?.includes('it-officer')

  return (
    <div
      className={`exam-card tier-${exam.tier.toLowerCase()}${pinned || starred ? ' pinned' : ''}`}
    >
      <div className="exam-card-top">
        <div className="chip-wrap">
          <span className="tier-chip">{exam.tier}</span>
          {isItOfficer && <span className="soft-chip it-chip">IT Officer</span>}
          {(pinned || starred) && <span className="soft-chip pin-chip">Pinned</span>}
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
          <ProgressRing pct={pct} size={48} stroke={4} />
        </div>
      </div>
      <Link to={`/exam/${exam.id}`} className="exam-card-link">
        <h3>{exam.shortName}</h3>
        <p className="exam-card-name">{exam.name}</p>
        <div className="exam-card-meta">
          <span>{exam.exam.split('·')[0]?.trim() || exam.cycle}</span>
          <span>
            {done}/{total} topics
          </span>
        </div>
        <p className="exam-card-status">{exam.status}</p>
      </Link>
    </div>
  )
}
