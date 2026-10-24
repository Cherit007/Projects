import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CglPackPanel } from '../components/CglPackPanel'
import { CglPreferenceRank } from '../components/CglPreferenceRank'
import { DailyCheckIn } from '../components/DailyCheckIn'
import { DeadlinesStrip } from '../components/DeadlinesStrip'
import { ExamCard } from '../components/ExamCard'
import { ExamGroupsPanel } from '../components/ExamGroupsPanel'
import { ProgressRing } from '../components/ProgressRing'
import { TodayPlan } from '../components/TodayPlan'
import { WeekPlan } from '../components/WeekPlan'
import { EXAMS } from '../data/exams'
import type { Tier } from '../data/types'
import { useFoundationLock } from '../hooks/usePrepSettings'
import { useProgress } from '../hooks/useProgress'

const FILTERS: Array<
  'All' | 'Starred' | 'IT Officer' | 'Tech lean' | 'Commerce/GA' | Tier
> = [
  'All',
  'Starred',
  'IT Officer',
  'Tech lean',
  'Commerce/GA',
  'Core',
  'Extra',
  'Tech',
  'PSU',
]

function isCommerceGa(exam: (typeof EXAMS)[number]) {
  return !!exam.tags?.includes('commerce-ga')
}

export function Dashboard() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const {
    stats,
    starred,
    deprioritized,
    focusExamId,
    toggleDeprioritize,
    isDeprioritized,
  } = useProgress()
  const [foundationLock] = useFoundationLock()
  const pctByExam = useMemo(
    () => Object.fromEntries(stats.byExam.map((s) => [s.examId, s])),
    [stats.byExam],
  )

  const commerceIds = useMemo(
    () => EXAMS.filter(isCommerceGa).map((e) => e.id),
    [],
  )
  const commerceStillUp = commerceIds.filter((id) => !isDeprioritized(id))

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
    } else if (filter === 'Tech lean') {
      list = EXAMS.filter((e) => !isCommerceGa(e))
    } else if (filter === 'Commerce/GA') {
      list = EXAMS.filter(isCommerceGa)
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
    if (filter === 'Tech lean') {
      return EXAMS.filter((e) => !isCommerceGa(e)).length
    }
    if (filter === 'Commerce/GA') return commerceIds.length
    if (filter === 'All') return EXAMS.length
    return EXAMS.filter((e) => e.tier === filter).length
  }, [filter, starred, commerceIds])

  return (
    <div className="dashboard">
      <section className="hero hero-compact">
        <div className="hero-copy">
          <h1>ExamPulse</h1>
          <p className="lede">
            One tick updates every exam that shares the topic.
          </p>
          <div className="hero-cta">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                // Don't use href="#targets" — HashRouter owns the URL hash.
                document
                  .getElementById('targets')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              Browse targets
            </button>
            <Link to={focusExamId ? '/focus' : '/roadmap'} className="btn ghost-btn">
              {focusExamId ? 'Resume focus' : 'Open roadmap'}
            </Link>
          </div>
        </div>
        <div className="hero-progress">
          <ProgressRing
            pct={stats.pct}
            size={112}
            stroke={8}
            label="Overall progress"
          />
          <div>
            <strong>
              {stats.doneTopics}
              <span className="hero-of">/{stats.totalTopics}</span>
            </strong>
            <span>
              {stats.minutesToday}m today
              {stats.streak > 0 ? ` · ${stats.streak}d streak` : ''}
              {stats.starredCount > 0 ? ` · ${stats.starredCount}★` : ''}
            </span>
          </div>
        </div>
      </section>

      <section className="dash-primary" aria-label="Today">
        <DailyCheckIn />
        <TodayPlan compact />
      </section>

      <ExamGroupsPanel />

      <div className="dash-folds">
        {starred.length > 0 && (
          <details className="dash-fold">
            <summary>
              This week
              <span>Mon–Sun plan</span>
            </summary>
            <WeekPlan foundationLock={foundationLock} compact />
          </details>
        )}
        <details className="dash-fold">
          <summary>
            Upcoming deadlines
            <span>verify official dates</span>
          </summary>
          <DeadlinesStrip limit={5} nested />
        </details>
        <details className="dash-fold">
          <summary>
            CGL pack & preference
            <span>core path · AAO · rank order</span>
          </summary>
          <CglPackPanel nested />
          <CglPreferenceRank />
        </details>
      </div>

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
          <div className="targets-tools">
            <p className="search-count">
              {filtered.length} of {poolCount} shown
              {starred.length > 0 && filter !== 'Starred' ? ' · ★ pinned first' : ''}
              {deprioritized.length > 0 ? ' · ↓ low priority at bottom' : ''}
            </p>
            {commerceStillUp.length > 0 && (
              <button
                type="button"
                className="btn ghost-btn sink-commerce"
                title="Move RBI / SEBI / NABARD / ESI-FM family to the bottom"
                onClick={() => {
                  for (const id of commerceStillUp) toggleDeprioritize(id)
                }}
              >
                ↓ Sink commerce / GA ({commerceStillUp.length})
              </button>
            )}
          </div>
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
