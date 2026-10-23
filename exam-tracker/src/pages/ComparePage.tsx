import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EXAMS } from '../data/exams'
import { useDailyMinutes } from '../hooks/usePrepSettings'
import { useProgress } from '../hooks/useProgress'
import { readinessScore } from '../utils/readiness'
import {
  buildRoadmap,
  etaDays,
  formatEta,
  roadmapTotals,
} from '../utils/roadmap'

/** Pack A vs Pack B — primary vs backup roadmap compare (E1). */
const PACK_PRESETS: Array<{ id: string; label: string; examIds: string[] }> = [
  { id: 'sebi', label: 'SEBI-primary', examIds: ['sebi'] },
  { id: 'cgl', label: 'CGL-primary', examIds: ['ssccgl', 'ssccglaso'] },
  { id: 'cgl-aao', label: 'CGL+AAO', examIds: ['ssccgl', 'ssccglaao'] },
  { id: 'rbi', label: 'RBI Gr B', examIds: ['rbi'] },
  { id: 'ibpsso', label: 'IBPS SO IT', examIds: ['ibpsso'] },
  { id: 'nabard', label: 'NABARD', examIds: ['nabard'] },
]

export function ComparePage() {
  const { completed, mockScores, starred, isDone, isSubDone, weakAreas } =
    useProgress()
  const [dailyMinutes] = useDailyMinutes()
  const defaults = useMemo(() => {
    const starredIds = EXAMS.filter((e) => starred.includes(e.id)).map(
      (e) => e.id,
    )
    const it = EXAMS.filter((e) => e.tags?.includes('it-officer')).map(
      (e) => e.id,
    )
    return [...new Set([...starredIds, ...it, 'ibpsso', 'sebi', 'sbi'])].slice(
      0,
      3,
    )
  }, [starred])

  const [picked, setPicked] = useState<string[]>(defaults)
  const [packA, setPackA] = useState('sebi')
  const [packB, setPackB] = useState('cgl')

  const weakIds = useMemo(
    () => weakAreas.map((w) => w.topic.id),
    [weakAreas],
  )

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

  const roadmapSide = (presetId: string) => {
    const preset = PACK_PRESETS.find((p) => p.id === presetId)
    const ids = (preset?.examIds ?? []).filter((id) => EXAMS.some((e) => e.id === id))
    const items = buildRoadmap({
      starredIds: ids,
      completed,
      isDone,
      isSubDone,
      weakTopicIds: weakIds,
    })
    const totals = roadmapTotals(items)
    const days = etaDays(totals.hoursLeft, dailyMinutes)
    return {
      label: preset?.label ?? presetId,
      ids,
      totals,
      eta: formatEta(days),
      pending: totals.pendingCount,
    }
  }

  const sideA = roadmapSide(packA)
  const sideB = roadmapSide(packB)

  return (
    <div className="compare-page">
      <header className="section-head stack">
        <div>
          <h1>Compare</h1>
          <p className="lede">
            Exam scorecards plus primary vs backup roadmap hours — pick a lane
            before the cycle.
          </p>
        </div>
      </header>

      <section className="roadmap-compare" aria-label="Roadmap pack compare">
        <h2>Roadmap packs</h2>
        <p className="muted-line plan-intro">
          Compare two primary stacks (e.g. SEBI vs CGL) using your current ticks.
        </p>
        <div className="roadmap-compare-pick">
          <label>
            Pack A
            <select value={packA} onChange={(e) => setPackA(e.target.value)}>
              {PACK_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pack B
            <select value={packB} onChange={(e) => setPackB(e.target.value)}>
              {PACK_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="roadmap-compare-grid">
          {[sideA, sideB].map((side) => (
            <article key={side.label} className="roadmap-compare-card">
              <h3>{side.label}</h3>
              <p className="muted-line">
                {side.ids
                  .map((id) => EXAMS.find((e) => e.id === id)?.shortName ?? id)
                  .join(' · ')}
              </p>
              <dl>
                <div>
                  <dt>Topics left</dt>
                  <dd>{side.pending}</dd>
                </div>
                <div>
                  <dt>Hours left</dt>
                  <dd>{side.totals.hoursLeft}h</dd>
                </div>
                <div>
                  <dt>ETA @ {dailyMinutes}m/day</dt>
                  <dd>{side.eta}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        {sideA.totals.hoursLeft !== sideB.totals.hoursLeft && (
          <p className="muted-line">
            {sideA.totals.hoursLeft < sideB.totals.hoursLeft
              ? `${sideA.label} needs ~${Math.round(sideB.totals.hoursLeft - sideA.totals.hoursLeft)}h less than ${sideB.label} from your current progress.`
              : `${sideB.label} needs ~${Math.round(sideA.totals.hoursLeft - sideB.totals.hoursLeft)}h less than ${sideA.label} from your current progress.`}
          </p>
        )}
      </section>

      <header className="section-head stack" style={{ marginTop: '1.5rem' }}>
        <div>
          <h2>Exam scorecards</h2>
          <p className="muted-line">
            Side-by-side like Testbook — pick up to 3 (pay, fit, readiness).
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
