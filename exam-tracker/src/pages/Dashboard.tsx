import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DeadlinesStrip } from '../components/DeadlinesStrip'
import { ExamCard } from '../components/ExamCard'
import { ProgressRing } from '../components/ProgressRing'
import { TodayPlan } from '../components/TodayPlan'
import { EXAMS } from '../data/exams'
import type { Tier } from '../data/types'
import { useProgress } from '../hooks/useProgress'

const FILTERS: Array<'All' | 'Starred' | 'IT Officer' | Tier> = [
  'All',
  'Starred',
  'IT Officer',
  'Core',
  'Extra',
  'Tech',
  'PSU',
]

export function Dashboard() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const { stats, starred, deprioritized, focusExamId } = useProgress()
  const pctByExam = useMemo(
    () => Object.fromEntries(stats.byExam.map((s) => [s.examId, s])),
    [stats.byExam],
  )

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    let list = EXAMS
    if (filter === 'Starred') list = EXAMS.filter((e) => starred.includes(e.id))
    else if (filter === 'IT Officer') {
      list = EXAMS.filter(
        (e) =>
          e.tags?.includes('it-officer') ||
          /IT Officer|IT specialist|Scientist-B|Manager \(IT\)|IT stream/i.test(
            `${e.name} ${e.shortName} ${e.fit}`,
          ),
      )
    } else if (filter !== 'All') {
      list = EXAMS.filter((e) => e.tier === filter)
    }

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
        ...(e.tags ?? []),
        ...e.coachingRefs,
        e.tags?.includes('it-officer') ? 'IT Officer PSU bank' : '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })

    // Starred first → normal → deprioritized last; then catalog priority
    return [...list].sort((a, b) => {
      const rank = (id: string) =>
        starred.includes(id) ? 0 : deprioritized.includes(id) ? 2 : 1
      const ar = rank(a.id)
      const br = rank(b.id)
      if (ar !== br) return ar - br
      return a.priority - b.priority
    })
  }, [filter, deferredQuery, starred, deprioritized])

  const poolCount = useMemo(() => {
    if (filter === 'Starred') return starred.length
    if (filter === 'IT Officer') {
      return EXAMS.filter((e) => e.tags?.includes('it-officer')).length
    }
    if (filter === 'All') return EXAMS.length
    return EXAMS.filter((e) => e.tier === filter).length
  }, [filter, starred])

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
              {stats.streak}-day streak · {stats.starredCount} starred
            </span>
          </div>
        </div>
        <div className="hero-progress">
          <ProgressRing pct={stats.pct} size={140} stroke={10} label="Overall progress" />
          <div>
            <strong>{stats.doneTopics}</strong>
            <span>topics done of {stats.totalTopics}</span>
            {stats.streak > 0 && (
              <span className="streak-badge">{stats.streak} day streak</span>
            )}
          </div>
        </div>
      </section>

      <TodayPlan />
      <DeadlinesStrip />

      <section id="targets" className="targets">
        <div className="section-head">
          <h2>Targets</h2>
          <div className="filter-row">
            {FILTERS.map((t) => (
              <button
                key={t}
                type="button"
                className={filter === t ? 'active' : ''}
                onClick={() => setFilter(t)}
              >
                {t}
                {t === 'Starred' && stats.starredCount > 0
                  ? ` (${stats.starredCount})`
                  : ''}
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
              placeholder="Search — IT Officer, SEBI, NIC, PSU…"
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
            {starred.length > 0 && filter !== 'Starred' ? ' · ★ pinned first' : ''}
            {deprioritized.length > 0 ? ' · ↓ low priority at bottom' : ''}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-search">
            <p>
              {filter === 'Starred' && !query
                ? 'No starred exams yet — tap ★ on a card to pin it first.'
                : `No exams match “${query.trim()}”.`}
            </p>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setQuery('')
                setFilter('All')
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
                  pinned={starred.includes(exam.id)}
                  sunk={deprioritized.includes(exam.id)}
                />
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
