import { Link } from 'react-router-dom'
import { examsSharingTopic } from '../data/exams'
import { AREA_LABELS } from '../data/topics'
import type { Topic } from '../data/types'
import { useProgress } from '../hooks/useProgress'
import { topicHours, topicProgress } from '../utils/topicMeta'
import { ProgressRing } from './ProgressRing'

type Props = {
  topic: Topic
  highlightExamIds?: string[]
  weak?: boolean
}

export function TopicCard({ topic, highlightExamIds, weak }: Props) {
  const { isDone, isSubDone, toggleTopic } = useProgress()
  const prog = topicProgress(topic, isDone, isSubDone)
  const shared = examsSharingTopic(topic.id)
  const hours = topicHours(topic)
  const starSet = highlightExamIds ? new Set(highlightExamIds) : null

  return (
    <article
      className={`topic-card${prog.fullyDone ? ' done' : ''}${weak ? ' weak' : ''}`}
    >
      <div className="topic-card-top">
        <div className="chip-wrap">
          <span className="soft-chip area-chip">{AREA_LABELS[topic.area]}</span>
          {weak && <span className="soft-chip sunk-chip">Weak</span>}
          {prog.fullyDone && <span className="soft-chip reg-open-chip">Done</span>}
          {!prog.fullyDone && prog.pct > 0 && (
            <span className="soft-chip pin-chip">In progress</span>
          )}
        </div>
        <ProgressRing pct={prog.pct} size={44} stroke={4} label="Topic" />
      </div>

      <label className="check topic-card-check">
        <input
          type="checkbox"
          checked={prog.fullyDone}
          onChange={() => toggleTopic(topic.id)}
          aria-label={topic.title}
        />
        <span>
          <strong className="topic-card-title">{topic.title}</strong>
          <em>
            {prog.doneSubs}/{prog.totalSubs} subtopics · ~{hours}h
          </em>
        </span>
      </label>

      {topic.note && <p className="topic-card-note">{topic.note}</p>}

      <div className="shared-exams topic-card-exams">
        {shared.map((e) => (
          <Link
            key={e.id}
            to={`/exam/${e.id}`}
            className={starSet?.has(e.id) ? 'starred-exam' : undefined}
          >
            {e.shortName}
          </Link>
        ))}
      </div>
    </article>
  )
}
