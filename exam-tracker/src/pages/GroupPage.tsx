import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { TopicCard } from '../components/TopicCard'
import { EXAMS } from '../data/exams'
import { useProgress } from '../hooks/useProgress'
import {
  groupProgress,
  partitionGroupSyllabus,
} from '../utils/examGroups'
import { examMatchesQuery } from '../utils/examSearch'

type Tab = 'common' | 'extra'

export function GroupPage() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const {
    examGroups,
    updateExamGroup,
    removeExamGroup,
    isDone,
    isSubDone,
    starred,
  } = useProgress()

  const group = examGroups.find((g) => g.id === groupId)
  const [tab, setTab] = useState<Tab>('common')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group?.name ?? '')
  const [picked, setPicked] = useState<string[]>(group?.examIds ?? [])
  const [query, setQuery] = useState('')

  const parts = useMemo(
    () => partitionGroupSyllabus(group?.examIds ?? []),
    [group?.examIds],
  )
  const commonProg = useMemo(
    () => groupProgress(parts.common, isDone, isSubDone),
    [parts.common, isDone, isSubDone],
  )
  const extraProg = useMemo(
    () => groupProgress(parts.extras, isDone, isSubDone),
    [parts.extras, isDone, isSubDone],
  )

  const pickPool = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...EXAMS].sort((a, b) => {
      const as = starred.includes(a.id) ? 0 : 1
      const bs = starred.includes(b.id) ? 0 : 1
      if (as !== bs) return as - bs
      return a.priority - b.priority
    })
    if (!q) return list
    return list.filter((e) => examMatchesQuery(e, q))
  }, [query, starred])

  if (!groupId || !group) {
    return <Navigate to="/" replace />
  }

  const rows = tab === 'common' ? parts.common : parts.extras
  const highlight = group.examIds

  const startEdit = () => {
    setName(group.name)
    setPicked([...group.examIds])
    setQuery('')
    setEditing(true)
  }

  const saveEdit = () => {
    updateExamGroup(group.id, { name, examIds: picked })
    setEditing(false)
  }

  const onDelete = () => {
    if (!confirm(`Delete group “${group.name}”? Progress ticks stay.`)) return
    removeExamGroup(group.id)
    navigate('/')
  }

  return (
    <div className="group-page">
      <header className="section-head stack">
        <Link to="/" className="back-link">
          ← Dashboard
        </Link>
        <div className="group-page-title">
          <div>
            <h1>{group.name}</h1>
            <p className="lede">
              Shared topics first — then extras that only some exams in this
              group need.
            </p>
          </div>
          <div className="group-page-actions">
            <button type="button" className="btn ghost-btn" onClick={startEdit}>
              Edit
            </button>
            <button type="button" className="btn ghost-btn" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
        <div className="group-exam-chips" aria-label="Exams in group">
          {parts.exams.map((e) => (
            <Link key={e.id} to={`/exam/${e.id}`} className="soft-chip">
              {e.shortName}
            </Link>
          ))}
        </div>
      </header>

      {editing && (
        <div className="group-composer" role="form" aria-label="Edit study group">
          <label className="group-composer-name">
            <span>Group name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={48}
            />
          </label>
          <div className="group-composer-pick">
            <div className="group-composer-pick-head">
              <span>Exams · {picked.length} selected</span>
            </div>
            <input
              type="search"
              className="group-composer-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter exams…"
            />
            <div className="compare-pick group-exam-pick">
              {pickPool.map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  className={picked.includes(exam.id) ? 'active' : ''}
                  onClick={() =>
                    setPicked((prev) =>
                      prev.includes(exam.id)
                        ? prev.filter((x) => x !== exam.id)
                        : [...prev, exam.id],
                    )
                  }
                >
                  {exam.shortName}
                </button>
              ))}
            </div>
          </div>
          <div className="group-composer-footer">
            <button
              type="button"
              className="btn ghost-btn"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!name.trim() || picked.length === 0}
              onClick={saveEdit}
            >
              Save changes
            </button>
          </div>
        </div>
      )}

      <div className="filter-row group-tabs" role="tablist" aria-label="Syllabus view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'common'}
          className={tab === 'common' ? 'active' : ''}
          onClick={() => setTab('common')}
        >
          Shared by all
          <span>
            {commonProg.done}/{commonProg.total} · {commonProg.pct}%
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'extra'}
          className={tab === 'extra' ? 'active' : ''}
          onClick={() => setTab('extra')}
          disabled={parts.exams.length < 2}
        >
          Extra syllabus
          <span>
            {extraProg.done}/{extraProg.total} · {extraProg.pct}%
          </span>
        </button>
      </div>

      <p className="muted-line group-tab-hint">
        {tab === 'common'
          ? parts.exams.length < 2
            ? 'Single-exam group — every topic is listed as shared.'
            : `Topics that appear on every exam in this group (${parts.exams.length}).`
          : 'Topics that appear on some exams only — tick them when you need that lane.'}
      </p>

      {rows.length === 0 ? (
        <p className="group-empty">
          {tab === 'common'
            ? 'No shared topics for this selection.'
            : 'No extras — every topic is shared across the group.'}
        </p>
      ) : (
        <div className="topic-grid">
          {rows.map((row) => (
            <div key={row.topic.id} className="group-topic-wrap">
              {tab === 'extra' && (
                <div className="group-topic-exams">
                  {row.examLabels.join(' · ')}
                </div>
              )}
              <TopicCard topic={row.topic} highlightExamIds={highlight} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
