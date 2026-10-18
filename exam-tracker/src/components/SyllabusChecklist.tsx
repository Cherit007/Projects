import { useMemo, useState } from 'react'
import { examsSharingTopic } from '../data/exams'
import { AREA_LABELS, TOPIC_BY_ID } from '../data/topics'
import type { Exam } from '../data/types'
import { useProgress } from '../hooks/useProgress'

type Props = {
  exam: Exam
}

export function SyllabusChecklist({ exam }: Props) {
  const { isDone, isSubDone, toggleTopic, toggleSubtopic } = useProgress()
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  const sections = useMemo(() => {
    return exam.syllabus.map((section) => {
      const topics = section.topicIds
        .map((id) => TOPIC_BY_ID[id])
        .filter(Boolean)
        .filter((t) => {
          const done = isDone(t.id)
          if (filter === 'pending') return !done
          if (filter === 'done') return done
          return true
        })
      const total = section.topicIds.length
      const done = section.topicIds.filter((id) => isDone(id)).length
      return { ...section, topics, total, done }
    }).filter((s) => s.topics.length > 0 || filter === 'all')
  }, [exam, filter, isDone])

  return (
    <div className="syllabus">
      <div className="syllabus-toolbar">
        <h2>Syllabus tracker</h2>
        <div className="filter-row" role="tablist">
          {(['all', 'pending', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'pending' ? 'To do' : 'Done'}
            </button>
          ))}
        </div>
      </div>
      <p className="syllabus-hint">
        Tick a topic once — it syncs across every exam that shares that portion
        (e.g. Quant DI, ESI, GATE OS).
      </p>

      {sections.map((section) => (
        <section key={`${section.area}-${section.label}`} className="syllabus-section">
          <header className="syllabus-section-head">
            <div>
              <h3>{section.label}</h3>
              {section.weightNote && <p>{section.weightNote}</p>}
            </div>
            <span className="section-pct">
              {section.done}/{section.total}
            </span>
          </header>
          <ul className="topic-list">
            {section.topics.map((topic) => {
              const done = isDone(topic.id)
              const shared = examsSharingTopic(topic.id).filter((e) => e.id !== exam.id)
              const expanded = openId === topic.id
              return (
                <li key={topic.id} className={done ? 'topic done' : 'topic'}>
                  <div className="topic-row">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleTopic(topic.id)}
                        aria-label={topic.title}
                      />
                      <span className="topic-title">{topic.title}</span>
                    </label>
                    <button
                      type="button"
                      className="expand-btn"
                      aria-expanded={expanded}
                      onClick={() => setOpenId(expanded ? null : topic.id)}
                    >
                      {expanded ? 'Hide' : `${topic.subtopics.length} subtopics`}
                    </button>
                  </div>
                  {shared.length > 0 && (
                    <p className="shared-note">
                      Also in {shared.slice(0, 4).map((e) => e.shortName).join(', ')}
                      {shared.length > 4 ? ` +${shared.length - 4}` : ''}
                    </p>
                  )}
                  {expanded && (
                    <ul className="subtopic-list">
                      {topic.subtopics.map((sub, i) => (
                        <li key={i}>
                          <label className="check sub">
                            <input
                              type="checkbox"
                              checked={isSubDone(topic.id, i)}
                              onChange={() =>
                                toggleSubtopic(topic.id, i, topic.subtopics.length)
                              }
                              aria-label={sub}
                            />
                            <span>{sub}</span>
                          </label>
                        </li>
                      ))}
                      {topic.note && <li className="topic-note">{topic.note}</li>}
                      <li className="area-tag">{AREA_LABELS[topic.area]}</li>
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
