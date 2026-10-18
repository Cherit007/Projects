import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { WeakAreas } from '../components/WeakAreas'
import { examsSharingTopic } from '../data/exams'
import { AREA_LABELS, TOPICS } from '../data/topics'
import type { TopicArea } from '../data/types'
import { useProgress } from '../hooks/useProgress'

export function TopicsPage() {
  const { isDone, toggleTopic } = useProgress()
  const [area, setArea] = useState<TopicArea | 'all'>('all')

  const areas = useMemo(
    () => [...new Set(TOPICS.map((t) => t.area))],
    [],
  )

  const list = useMemo(() => {
    return TOPICS.filter((t) => area === 'all' || t.area === area)
  }, [area])

  return (
    <div className="topics-page">
      <header className="section-head stack">
        <div>
          <h1>Shared topic graph</h1>
          <p className="lede">
            One master checklist. Completing a topic here updates every linked
            exam automatically.
          </p>
        </div>
        <div className="filter-row wrap">
          <button
            type="button"
            className={area === 'all' ? 'active' : ''}
            onClick={() => setArea('all')}
          >
            All
          </button>
          {areas.map((a) => (
            <button
              key={a}
              type="button"
              className={area === a ? 'active' : ''}
              onClick={() => setArea(a)}
            >
              {AREA_LABELS[a]}
            </button>
          ))}
        </div>
      </header>

      <WeakAreas />

      <ul className="master-topics">
        {list.map((topic) => {
          const shared = examsSharingTopic(topic.id)
          const done = isDone(topic.id)
          return (
            <li key={topic.id} className={done ? 'done' : ''}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggleTopic(topic.id)}
                  aria-label={topic.title}
                />
                <span>
                  <strong>{topic.title}</strong>
                  <em>{AREA_LABELS[topic.area]}</em>
                </span>
              </label>
              <div className="shared-exams">
                {shared.map((e) => (
                  <Link key={e.id} to={`/exam/${e.id}`}>
                    {e.shortName}
                  </Link>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
