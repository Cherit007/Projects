import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DeadlinesStrip } from '../components/DeadlinesStrip'
import { ExamCard } from '../components/ExamCard'
import { ProgressRing } from '../components/ProgressRing'
import { WeakAreas } from '../components/WeakAreas'
import { EXAMS } from '../data/exams'
import type { Tier } from '../data/types'
import { useProgress } from '../hooks/useProgress'

const TIERS: Array<'All' | Tier | 'Starred'> = [
  'All',
  'Starred',
  'Core',
  'Extra',
  'Tech',
  'PSU',
]

export function Dashboard() {
  const [tier, setTier] = useState<(typeof TIERS)[number]>('All')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const { stats, starred, focusExamId } = useProgress()
  const pctByExam = useMemo(
    () => Object.fromEntries(stats.byExam.map((s) => [s.examId, s])),
    [stats.byExam],
  )

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    let list = EXAMS
    if (tier === 'Starred') list = EXAMS.filter((e) => starred.includes(e.id))
    else if (tier !== 'All') list = EXAMS.filter((e) => e.tier === tier)

    list = list.filter((e) => {
      if (!q) return true
      const haystack = [
        e.name,
        e.shortName,
        e.tier,
        e.status,
        e.cycle,
        e.exam,
        e.reg,
        e.location,
        e.qual,
        e.fit,
        e.difficulty,
        ...e.coachingRefs,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
    return [...list].sort((a, b) => a.priority - b.priority)
  }, [tier, deferredQuery, starred])

  const poolCount =
    tier === 'Starred'
      ? starred.length
      : tier === 'All'
        ? EXAMS.length
        : EXAMS.filter((e) => e.tier === tier).length

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
            <Link to="/focus" className="btn ghost-btn">
              {focusExamId ? 'Resume focus' : 'Focus mode'}
            </Link>
            <span className="hero-meta">
              {EXAMS.length} exams · {stats.minutesToday} min today ·{' '}
              {stats.starredCount} starred
            </span>
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

      <DeadlinesStrip />
      <WeakAreas />

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
                {t === 'Starred' && stats.starredCount > 0 ? ` (${stats.starredCount})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="targets-search">
          <label className="search-field" htmlFor="exam-search">
            <span className="search-icon" aria-hidden>
              ⌕
            </span>
            <input
              id="exam-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exams — SEBI, NIC, GATE, Mumbai…"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </label>
          <p className="search-count">
            {filtered.length} of {poolCount} shown
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-search">
            <p>
              {tier === 'Starred' && !query
                ? 'No starred exams yet — tap ★ on a card.'
                : `No exams match “${query.trim()}”.`}
            </p>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setQuery('')
                if (tier === 'Starred') setTier('All')
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
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
        )}
      </section>
    </div>
  )
}
