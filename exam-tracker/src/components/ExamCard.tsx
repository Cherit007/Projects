import { Link } from 'react-router-dom'
import type { Exam } from '../data/types'
import { ProgressRing } from './ProgressRing'

type Props = {
  exam: Exam
  pct: number
  done: number
  total: number
}

export function ExamCard({ exam, pct, done, total }: Props) {
  return (
    <Link to={`/exam/${exam.id}`} className={`exam-card tier-${exam.tier.toLowerCase()}`}>
      <div className="exam-card-top">
        <span className="tier-chip">{exam.tier}</span>
        <ProgressRing pct={pct} size={48} stroke={4} />
      </div>
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
  )
}
