import { useMemo, useState } from 'react'
import { ExamCard } from '../components/ExamCard'
import { ProgressRing } from '../components/ProgressRing'
import { EXAMS } from '../data/exams'
import type { Tier } from '../data/types'
import { useProgress } from '../hooks/useProgress'

const TIERS: Array<'All' | Tier> = ['All', 'Core', 'Extra', 'Tech', 'PSU']

export function Dashboard() {
  const [tier, setTier] = useState<'All' | Tier>('All')
  const { stats } = useProgress()
  const pctByExam = useMemo(
    () => Object.fromEntries(stats.byExam.map((s) => [s.examId, s])),
    [stats.byExam],
  )

  const filtered = useMemo(() => {
    const list = tier === 'All' ? EXAMS : EXAMS.filter((e) => e.tier === tier)
    return [...list].sort((a, b) => a.priority - b.priority)
  }, [tier])

  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Your command centre</p>
          <h1>ExamPulse</h1>
          <p className="lede">
            Track every target exam, date, and syllabus — tick a topic once and
            it marks complete across all exams that share it.
          </p>
          <div className="hero-cta">
            <a href="#targets" className="btn primary">
              Browse targets
            </a>
            <span className="hero-meta">{EXAMS.length} exams · shared syllabus graph</span>
          </div>
        </div>
        <div className="hero-progress">
          <ProgressRing pct={stats.pct} size={140} stroke={10} label="Overall progress" />
          <div>
            <strong>{stats.doneTopics}</strong>
            <span>topics done of {stats.totalTopics}</span>
          </div>
        </div>
      </section>

      <section id="targets" className="targets">
        <div className="section-head">
          <h2>Targets</h2>
          <div className="filter-row">
            {TIERS.map((t) => (
              <button
                key={t}
                type="button"
                className={tier === t ? 'active' : ''}
                onClick={() => setTier(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="exam-grid">
          {filtered.map((exam) => {
            const s = pctByExam[exam.id] ?? { pct: 0, done: 0, total: 0 }
            return (
              <ExamCard
                key={exam.id}
                exam={exam}
                pct={s.pct}
                done={s.done}
                total={s.total}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
