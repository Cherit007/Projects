import { Link } from 'react-router-dom'
import { examsSharingTopic } from '../data/exams'
import { AREA_LABELS } from '../data/topics'
import type { Topic } from '../data/types'
import { useProgress } from '../hooks/useProgress'
import { MASTERY_LABELS, resolveMastery } from '../utils/mastery'
import { showToast } from '../utils/toastBus'
import { topicHours, topicProgress } from '../utils/topicMeta'
import { pyqLinksForTopic } from '../utils/topicPyq'
import { ProgressRing } from './ProgressRing'

type Props = {
  topic: Topic
  highlightExamIds?: string[]
  weak?: boolean
}

export function TopicCard({ topic, highlightExamIds, weak }: Props) {
  const { isDone, isSubDone, toggleTopic, mastery, cycleMastery } = useProgress()
  const prog = topicProgress(topic, isDone, isSubDone)
  const shared = examsSharingTopic(topic.id)
  const hours = topicHours(topic)
  const starSet = highlightExamIds ? new Set(highlightExamIds) : null
  const level = resolveMastery(topic, mastery[topic.id], isDone, isSubDone)
  const pyqs = pyqLinksForTopic(topic)

  return (
    <article
      className={`topic-card${prog.fullyDone ? ' done' : ''}${weak ? ' weak' : ''}`}
    >
      <div className="topic-card-top">
        <div className="chip-wrap">
          <span className="soft-chip area-chip">{AREA_LABELS[topic.area]}</span>
          {weak && <span className="soft-chip sunk-chip">Weak</span>}
          {level && (
            <span className={`soft-chip mastery-chip mastery-${level}`}>
              {MASTERY_LABELS[level]}
            </span>
          )}
          {prog.fullyDone && !level && (
            <span className="soft-chip reg-open-chip">Done</span>
          )}
          {!prog.fullyDone && prog.pct > 0 && !level && (
            <span className="soft-chip pin-chip">In progress</span>
          )}
        </div>
        <ProgressRing pct={prog.pct} size={44} stroke={4} label="Topic" />
      </div>

      <label className="check topic-card-check">
        <input
          type="checkbox"
          checked={prog.fullyDone}
          onChange={() => {
            const wasDone = prog.fullyDone
            toggleTopic(topic.id)
            if (!wasDone && shared.length > 1) {
              showToast(
                `Synced across ${shared.length} exams: ${shared
                  .slice(0, 4)
                  .map((e) => e.shortName)
                  .join(', ')}${shared.length > 4 ? '…' : ''}`,
              )
            }
          }}
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

      <div className="topic-card-actions">
        <button
          type="button"
          className="ghost mastery-cycle"
          onClick={() => cycleMastery(topic.id)}
          title="Cycle mastery: Learning → Practiced → Mastered"
        >
          {level ? `Mastery: ${MASTERY_LABELS[level]}` : 'Set mastery'}
        </button>
        {pyqs.map((link) => (
          <a
            key={link.url}
            className="topic-pyq-link"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            PYQ · {link.label}
          </a>
        ))}
      </div>

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
