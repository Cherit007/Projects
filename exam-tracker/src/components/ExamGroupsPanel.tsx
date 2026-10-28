import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EXAMS } from '../data/exams'
import { useProgress } from '../hooks/useProgress'
import {
  groupProgress,
  partitionGroupSyllabus,
} from '../utils/examGroups'
import { examMatchesQuery } from '../utils/examSearch'

export function ExamGroupsPanel() {
  const {
    examGroups,
    starred,
    addExamGroup,
    isDone,
    isSubDone,
  } = useProgress()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')

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

  const toggle = (id: string) => {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const save = () => {
    const group = addExamGroup(name, picked)
    if (!group) return
    setName('')
    setPicked([])
    setQuery('')
    setOpen(false)
  }

  const canSave = name.trim().length > 0 && picked.length > 0

  return (
    <section className="exam-groups" aria-label="Study groups">
      <div className="section-head exam-groups-head">
        <div>
          <h2>Study groups</h2>
          <p className="muted-line">
            Bundle exams, then open a group for shared syllabus vs extras.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            className="btn primary"
            onClick={() => setOpen(true)}
          >
            New group
          </button>
        )}
      </div>

      {open && (
        <div className="group-composer" role="form" aria-label="Create study group">
          <label className="group-composer-name">
            <span>Group name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bank SO stack"
              maxLength={48}
              autoFocus
            />
          </label>

          <div className="group-composer-pick">
            <div className="group-composer-pick-head">
              <span>
                Exams · {picked.length} selected
                {picked.length === 1 ? ' (all topics count as shared)' : ''}
              </span>
              <div className="group-composer-actions">
                {starred.length > 0 && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setPicked([...starred])}
                  >
                    Use ★
                  </button>
                )}
                {picked.length > 0 && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setPicked([])}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <input
              type="search"
              className="group-composer-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter exams…"
              aria-label="Filter exams"
            />
            <div className="compare-pick group-exam-pick">
              {pickPool.map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  className={picked.includes(exam.id) ? 'active' : ''}
                  onClick={() => toggle(exam.id)}
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
              onClick={() => {
                setOpen(false)
                setName('')
                setPicked([])
                setQuery('')
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!canSave}
              onClick={save}
            >
              Save group
            </button>
          </div>
        </div>
      )}

      {examGroups.length === 0 && !open ? (
        <p className="group-empty">
          No groups yet. Create one to track common topics across a few targets.
        </p>
      ) : (
        <ul className="group-list">
          {examGroups.map((g) => {
            const parts = partitionGroupSyllabus(g.examIds)
            const commonProg = groupProgress(parts.common, isDone, isSubDone)
            const allRows = [...parts.common, ...parts.extras]
            const allProg = groupProgress(allRows, isDone, isSubDone)
            const labels = parts.exams.map((e) => e.shortName).join(' · ')
            return (
              <li key={g.id}>
                <Link to={`/group/${g.id}`} className="group-row">
                  <div className="group-row-main">
                    <strong>{g.name}</strong>
                    <em>{labels || 'No exams'}</em>
                  </div>
                  <div className="group-row-meta">
                    <span>
                      Shared {commonProg.done}/{commonProg.total}
                      {parts.exams.length > 1
                        ? ` · Extra ${parts.extras.length}`
                        : ''}
                    </span>
                    <span className="group-row-pct">{allProg.pct}%</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
