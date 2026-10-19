import { TOPICS } from '../data/topics'
import type { ErrorEntry, MockScore } from '../hooks/useProgress'
import { dueRevisions, type RevisionCard } from './spacedRepetition'

export type SectionKey = 'quant' | 'reasoning' | 'english' | 'ga' | 'itPk'

export const SECTION_LABELS: Record<SectionKey, string> = {
  quant: 'Quant',
  reasoning: 'Reasoning',
  english: 'English',
  ga: 'GA / Banking',
  itPk: 'IT PK',
}

export type NextMove = {
  id: string
  title: string
  why: string
  href: string
  kind: 'revise' | 'drill' | 'mock' | 'fix'
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

/** Average accuracy % per section from recent mocks that logged sections. */
export function sectionAverages(
  mocks: MockScore[],
  take = 5,
): Partial<Record<SectionKey, number>> {
  const buckets: Record<SectionKey, number[]> = {
    quant: [],
    reasoning: [],
    english: [],
    ga: [],
    itPk: [],
  }
  for (const m of mocks.slice(0, take)) {
    const s = m.sections
    if (!s) continue
    ;(Object.keys(buckets) as SectionKey[]).forEach((k) => {
      const v = s[k]
      if (typeof v === 'number' && !Number.isNaN(v)) buckets[k].push(v)
    })
  }
  const out: Partial<Record<SectionKey, number>> = {}
  ;(Object.keys(buckets) as SectionKey[]).forEach((k) => {
    const a = avg(buckets[k])
    if (a != null) out[k] = a
  })
  return out
}

export function weakestSection(
  mocks: MockScore[],
): { key: SectionKey; avg: number } | null {
  const avgs = sectionAverages(mocks)
  let worst: { key: SectionKey; avg: number } | null = null
  for (const [key, value] of Object.entries(avgs) as [SectionKey, number][]) {
    if (!worst || value < worst.avg) worst = { key, avg: value }
  }
  return worst
}

export function mockTrend(mocks: MockScore[], examId?: string, take = 8) {
  const list = (examId ? mocks.filter((m) => m.examId === examId) : mocks)
    .slice(0, take)
    .slice()
    .reverse()
  return list.map((m) => ({
    id: m.id,
    date: m.date,
    pct: Math.round((m.score / Math.max(1, m.maxScore)) * 100),
    percentile: m.percentile,
    label: m.stage ?? 'mock',
  }))
}

export type ErrorStat = {
  key: string
  label: string
  count: number
  types: Record<ErrorEntry['mistakeType'], number>
}

export function topErrorTopics(errors: ErrorEntry[], take = 5): ErrorStat[] {
  const map = new Map<string, ErrorStat>()
  for (const e of errors) {
    const key = e.topicId || e.topicLabel.toLowerCase()
    const label =
      (e.topicId && TOPICS.find((t) => t.id === e.topicId)?.title) || e.topicLabel
    const cur = map.get(key) ?? {
      key,
      label,
      count: 0,
      types: { concept: 0, silly: 0, time: 0 },
    }
    cur.count += 1
    cur.types[e.mistakeType] += 1
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, take)
}

/** Three concrete actions after recent mocks / errors / revision due. */
export function buildNextMoves(args: {
  mockScores: MockScore[]
  errors: ErrorEntry[]
  revision: Record<string, RevisionCard>
  weakTopicIds: string[]
}): NextMove[] {
  const moves: NextMove[] = []
  const due = dueRevisions(args.revision)

  if (due[0]) {
    const topic = TOPICS.find((t) => t.id === due[0].topicId)
    moves.push({
      id: `rev-${due[0].topicId}`,
      title: `Revise: ${topic?.title ?? due[0].topicId}`,
      why: `Spaced review due ${due[0].due} (interval ${due[0].interval}d)`,
      href: '/prep',
      kind: 'revise',
    })
  }

  const weakSec = weakestSection(args.mockScores)
  if (weakSec && weakSec.avg < 75) {
    moves.push({
      id: `sec-${weakSec.key}`,
      title: `Drill ${SECTION_LABELS[weakSec.key]} (~${weakSec.avg}%)`,
      why: 'Lowest section average in recent Oliveboard mocks you logged',
      href: '/prep',
      kind: 'drill',
    })
  }

  const errTop = topErrorTopics(args.errors, 1)[0]
  if (errTop) {
    const dominant = (Object.entries(errTop.types) as [ErrorEntry['mistakeType'], number][])
      .sort((a, b) => b[1] - a[1])[0]?.[0]
    moves.push({
      id: `err-${errTop.key}`,
      title: `Fix errors: ${errTop.label}`,
      why: `${errTop.count} logged · mostly ${dominant} mistakes`,
      href: '/prep',
      kind: 'fix',
    })
  }

  if (moves.length < 3) {
    const weakId = args.weakTopicIds[0]
    if (weakId && !moves.some((m) => m.id.includes(weakId))) {
      const topic = TOPICS.find((t) => t.id === weakId)
      moves.push({
        id: `weak-${weakId}`,
        title: `Study: ${topic?.title ?? weakId}`,
        why: 'High-overlap syllabus gap across multiple exams',
        href: '/topics',
        kind: 'drill',
      })
    }
  }

  if (moves.length < 3) {
    const recent = args.mockScores[0]
    const daysSince = recent
      ? Math.floor(
          (Date.now() - new Date(`${recent.date}T12:00:00`).getTime()) / 86400000,
        )
      : 99
    if (daysSince >= 2) {
      moves.push({
        id: 'mock-soon',
        title: 'Take / log an Oliveboard mock',
        why: recent
          ? `Last logged mock was ${daysSince} days ago`
          : 'No mocks logged yet — start the feedback loop',
        href: '/prep',
        kind: 'mock',
      })
    }
  }

  return moves.slice(0, 3)
}
