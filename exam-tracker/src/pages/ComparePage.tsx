import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EXAMS } from '../data/exams'
import { useProgress } from '../hooks/useProgress'
import { readinessScore } from '../utils/readiness'

export function ComparePage() {
  const { completed, mockScores, starred } = useProgress()
  const defaults = useMemo(() => {
    const starredIds = EXAMS.filter((e) => starred.includes(e.id)).map((e) => e.id)
    const it = EXAMS.filter((e) => e.tags?.includes('it-officer')).map((e) => e.id)
    return [...new Set([...starredIds, ...it, 'ibpsso', 'sebi', 'sbi'])].slice(0, 3)
  }, [starred])

  const [picked, setPicked] = useState<string[]>(defaults)

  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  const rows = picked
    .map((id) => EXAMS.find((e) => e.id === id))
    .filter(Boolean)
    .map((exam) => {
      const r = readinessScore(exam!, completed, mockScores)
      return { exam: exam!, r }
    })

  return (
    <div className="compare-page">
      <header className="section-head stack">
        <div>
          <h1>Compare exams</h1>
          <p className="lede">
            Side-by-side like Testbook scorecards — pick up to 3 (pay, fit, readiness).
          </p>
        </div>
      </header>

      <div className="compare-pick">
        {EXAMS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={picked.includes(e.id) ? 'active' : ''}
            onClick={() => toggle(e.id)}
          >
            {e.shortName}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="muted-line">Select exams above to compare.</p>
      ) : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Lens</th>
                {rows.map(({ exam }) => (
                  <th key={exam.id}>
                    <Link to={`/exam/${exam.id}`}>{exam.shortName}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Readiness</td>
                {rows.map(({ exam, r }) => (
                  <td key={exam.id}>
                    <strong>{r.score}%</strong>
                    <span className="muted-line"> {r.label}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Syllabus done</td>
                {rows.map(({ exam, r }) => (
                  <td key={exam.id}>{r.syllabus}%</td>
                ))}
              </tr>
              <tr>
                <td>Mock avg</td>
                {rows.map(({ exam, r }) => (
                  <td key={exam.id}>{r.mocks == null ? '—' : `${r.mocks}%`}</td>
                ))}
              </tr>
              <tr>
                <td>Tier</td>
                {rows.map(({ exam }) => (
                  <td key={exam.id}>{exam.tier}</td>
                ))}
              </tr>
              <tr>
                <td>Difficulty</td>
                {rows.map(({ exam }) => (
                  <td key={exam.id}>{exam.difficulty}</td>
                ))}
              </tr>
              <tr>
                <td>OBC age</td>
                {rows.map(({ exam }) => (
                  <td key={exam.id}>{exam.obcAge}</td>
                ))}
              </tr>
              <tr>
                <td>Compensation</td>
                {rows.map(({ exam }) => (
                  <td key={exam.id}>{exam.compensation}</td>
                ))}
              </tr>
              <tr>
                <td>Location</td>
                {rows.map(({ exam }) => (
                  <td key={exam.id}>{exam.location}</td>
                ))}
              </tr>
              <tr>
                <td>Status</td>
                {rows.map(({ exam }) => (
                  <td key={exam.id}>{exam.status}</td>
                ))}
              </tr>
              <tr>
                <td>Fit for you</td>
                {rows.map(({ exam }) => (
                  <td key={exam.id}>{exam.fit}</td>
                ))}
              </tr>
              <tr>
                <td>Tags</td>
                {rows.map(({ exam }) => (
                  <td key={exam.id}>{(exam.tags ?? []).join(', ') || '—'}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
