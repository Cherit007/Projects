import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TopicCard } from '../components/TopicCard'
import { WeakAreas } from '../components/WeakAreas'
import { EXAM_BY_ID, examTopicIds, examsSharingTopic } from '../data/exams'
import { AREA_LABELS, TOPICS } from '../data/topics'
import type { TopicArea } from '../data/types'
import { useProgress } from '../hooks/useProgress'
import { topicProgress } from '../utils/topicMeta'

type ViewMode = 'cards' | 'list' | 'matrix'
type StatusFilter = 'all' | 'pending' | 'done' | 'weak'

export function TopicsPage() {
  const { isDone, isSubDone, toggleTopic, starred, weakAreas } = useProgress()
  const [area, setArea] = useState<TopicArea | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [starOnly, setStarOnly] = useState(false)
  const [view, setView] = useState<ViewMode>('cards')

  const weakIds = useMemo(() => new Set(weakAreas.map((w) => w.topic.id)), [weakAreas])

  const starTopicIds = useMemo(() => {
    const set = new Set<string>()
    for (const id of starred) {
      const exam = EXAM_BY_ID[id]
      if (!exam) continue
      for (const tid of examTopicIds(exam)) set.add(tid)
    }
    return set
  }, [starred])

  const areas = useMemo(() => [...new Set(TOPICS.map((t) => t.area))], [])

  const list = useMemo(() => {
    return TOPICS.filter((t) => {
      if (area !== 'all' && t.area !== area) return false
      if (starOnly && starred.length > 0 && !starTopicIds.has(t.id)) return false
      const prog = topicProgress(t, isDone, isSubDone)
      if (status === 'pending' && prog.fullyDone) return false
      if (status === 'done' && !prog.fullyDone) return false
      if (status === 'weak' && !weakIds.has(t.id)) return false
      return true
    })
  }, [area, status, starOnly, starTopicIds, starred.length, isDone, isSubDone, weakIds])

  const matrixExams = useMemo(
    () => starred.map((id) => EXAM_BY_ID[id]).filter(Boolean),
    [starred],
  )

  return (
    <div className="topics-page">
      <header className="section-head stack">
        <div>
          <h1>Topics</h1>
          <p className="lede">
            One shared graph — tick once, every linked exam updates. Use cards or
            matrix to see what your ★ favorites need.
          </p>
        </div>
        <div className="topics-toolbar">
          <div className="filter-row wrap" role="group" aria-label="View">
            {(['cards', 'list', 'matrix'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={view === v ? 'active' : ''}
                onClick={() => setView(v)}
              >
                {v === 'cards' ? 'Cards' : v === 'list' ? 'List' : 'Matrix'}
              </button>
            ))}
          </div>
          <div className="filter-row wrap" role="group" aria-label="Status">
            {(['all', 'pending', 'done', 'weak'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={status === s ? 'active' : ''}
                onClick={() => setStatus(s)}
              >
                {s === 'all' ? 'All' : s === 'pending' ? 'To do' : s === 'done' ? 'Done' : 'Weak'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`star-filter ${starOnly ? 'active' : ''}`}
            onClick={() => setStarOnly((v) => !v)}
            disabled={starred.length === 0}
            title={
              starred.length === 0
                ? 'Star exams on the dashboard first'
                : 'Show only topics used by starred exams'
            }
          >
            ★ Syllabus only {starred.length > 0 ? `(${starred.length})` : ''}
          </button>
        </div>
        <div className="filter-row wrap">
          <button
            type="button"
            className={area === 'all' ? 'active' : ''}
            onClick={() => setArea('all')}
          >
            All areas
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

      {starred.length === 0 && (
        <p className="topics-hint">
          Tip: ★ favorite exams on the dashboard, then open{' '}
          <Link to="/roadmap">Roadmap</Link> for a timed plan — or enable ★
          Syllabus only here.
        </p>
      )}

      {view === 'cards' && (
        <div className="topic-card-grid">
          {list.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              highlightExamIds={starred}
              weak={weakIds.has(topic.id)}
            />
          ))}
        </div>
      )}

      {view === 'list' && (
        <ul className="master-topics">
          {list.map((topic) => {
            const shared = examsSharingTopic(topic.id)
            const prog = topicProgress(topic, isDone, isSubDone)
            return (
              <li key={topic.id} className={prog.fullyDone ? 'done' : ''}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={prog.fullyDone}
                    onChange={() => toggleTopic(topic.id)}
                    aria-label={topic.title}
                  />
                  <span>
                    <strong>{topic.title}</strong>
                    <em>
                      {AREA_LABELS[topic.area]} · {prog.doneSubs}/{prog.totalSubs}{' '}
                      subtopics
                    </em>
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
      )}

      {view === 'matrix' && (
        <div className="topic-matrix-wrap">
          {matrixExams.length === 0 ? (
            <p className="empty-inline">
              Star exams on the <Link to="/">dashboard</Link> to build the matrix.
            </p>
          ) : (
            <table className="topic-matrix">
              <thead>
                <tr>
                  <th scope="col">Topic</th>
                  {matrixExams.map((e) => (
                    <th key={e.id} scope="col">
                      <Link to={`/exam/${e.id}`}>{e.shortName}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((topic) => {
                  const prog = topicProgress(topic, isDone, isSubDone)
                  return (
                    <tr key={topic.id} className={prog.fullyDone ? 'done' : ''}>
                      <th scope="row">
                        <button
                          type="button"
                          className="matrix-topic-btn"
                          onClick={() => toggleTopic(topic.id)}
                        >
                          {topic.title}
                          <span>
                            {prog.pct}% · {AREA_LABELS[topic.area]}
                          </span>
                        </button>
                      </th>
                      {matrixExams.map((e) => {
                        const used = examTopicIds(e).includes(topic.id)
                        return (
                          <td key={e.id}>
                            {!used ? (
                              <span className="cell empty-cell">—</span>
                            ) : prog.fullyDone ? (
                              <span className="cell ok-cell" title="Done">
                                ✓
                              </span>
                            ) : prog.pct > 0 ? (
                              <span className="cell mid-cell" title={`${prog.pct}%`}>
                                {prog.pct}%
                              </span>
                            ) : (
                              <span className="cell todo-cell" title="Not started">
                                ○
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {list.length === 0 && (
        <p className="empty-inline">No topics match these filters.</p>
      )}
    </div>
  )
}
