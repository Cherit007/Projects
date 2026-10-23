import { daysUntil, upcomingDeadlines } from '../data/deadlines'
import { EXAM_BY_ID } from '../data/exams'
import { TOPIC_BY_ID } from '../data/topics'
import type { MockScore } from '../hooks/useProgress'
import { dueRevisions, type RevisionCard } from './spacedRepetition'
import { weakestSection } from './prepAnalytics'
import {
  buildRoadmap,
  type RoadmapItem,
  type RoadmapPhase,
} from './roadmap'

export type DayKind = 'learn' | 'drill' | 'mock' | 'revise' | 'rest'

export type WeekSlot = {
  day: string
  dateIso: string
  kind: DayKind
  title: string
  why: string
  href: string
  topicId?: string
  examId?: string
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfWeekMonday(from = new Date()): Date {
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  const day = d.getDay() // 0 Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Foundation completion 0–1 among pending+done foundation items. */
export function foundationProgress(items: RoadmapItem[]): number {
  const foundation = items.filter((i) => i.phase === 'foundation')
  if (!foundation.length) return 1
  const done = foundation.filter((i) => i.fullyDone).length
  return done / foundation.length
}

/** When lock is on and foundation < threshold, hide specific/polish from “active” queue. */
export function applyFoundationLock(
  items: RoadmapItem[],
  lock: boolean,
  threshold = 0.5,
): { active: RoadmapItem[]; lockedPhases: RoadmapPhase[]; foundationPct: number } {
  const foundationPct = foundationProgress(items)
  if (!lock || foundationPct >= threshold) {
    return { active: items.filter((i) => !i.fullyDone), lockedPhases: [], foundationPct }
  }
  return {
    active: items.filter((i) => !i.fullyDone && i.phase === 'foundation'),
    lockedPhases: ['specific', 'polish'],
    foundationPct,
  }
}

function nearestStarredDeadline(starredIds: string[], from = new Date()) {
  const set = new Set(starredIds)
  return upcomingDeadlines(12, from).find(
    (d) => set.has(d.examId) && (d.kind === 'exam' || d.kind === 'apply'),
  )
}

function examNeedingMock(starredIds: string[], mocks: MockScore[]): string | null {
  const recent = new Set(
    mocks
      .filter((m) => {
        const age = daysUntil(new Date(`${m.date}T12:00:00`), new Date())
        return age >= -14 // last 14 days
      })
      .map((m) => m.examId),
  )
  for (const id of starredIds) {
    if (!recent.has(id) && EXAM_BY_ID[id]) return id
  }
  return starredIds[0] ?? null
}

/**
 * Build Mon–Sun plan from roadmap + mocks + revision + deadlines.
 * C1 week slots · C3 mock cadence · C5 deadline-heavy mode · C2 via active queue.
 */
export function buildWeekPlan(args: {
  starredIds: string[]
  completed: Record<string, boolean>
  isDone: (id: string) => boolean
  isSubDone: (id: string, i: number) => boolean
  weakTopicIds: string[]
  mockScores: MockScore[]
  revision: Record<string, RevisionCard>
  foundationLock: boolean
  from?: Date
}): { slots: WeekSlot[]; mockHeavy: boolean; foundationPct: number; locked: boolean } {
  const from = args.from ?? new Date()
  const full = buildRoadmap({
    starredIds: args.starredIds,
    completed: args.completed,
    isDone: args.isDone,
    isSubDone: args.isSubDone,
    weakTopicIds: args.weakTopicIds,
  })
  const { active, lockedPhases, foundationPct } = applyFoundationLock(
    full,
    args.foundationLock,
  )

  const deadline = nearestStarredDeadline(args.starredIds, from)
  const daysToDeadline = deadline
    ? daysUntil(deadline.when, from)
    : Number.POSITIVE_INFINITY
  const mockHeavy = daysToDeadline <= 30

  const learnQueue = [...active]
  const weak = weakestSection(args.mockScores)
  const due = dueRevisions(args.revision).slice(0, 5)
  const mockExamId = examNeedingMock(args.starredIds, args.mockScores)
  const mockExam = mockExamId ? EXAM_BY_ID[mockExamId] : null

  const monday = startOfWeekMonday(from)
  // Order Mon..Sun as indices 0..6 from monday
  const slots: WeekSlot[] = []

  const takeLearn = (): RoadmapItem | null => learnQueue.shift() ?? null

  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i)
    const day = DAY_NAMES[date.getDay()]
    const dateIso = isoDate(date)
    const dow = date.getDay() // 0 Sun … 6 Sat

    // Sunday → revision
    if (dow === 0) {
      if (due.length) {
        const card = due[0]
        const label = TOPIC_BY_ID[card.topicId]?.title ?? card.topicId
        slots.push({
          day,
          dateIso,
          kind: 'revise',
          title: `Revise: ${label}`,
          why: `${due.length} cards due · spaced repetition`,
          href: '/prep',
          topicId: card.topicId,
        })
      } else {
        slots.push({
          day,
          dateIso,
          kind: 'revise',
          title: 'Light revision / error notebook',
          why: 'No SM-2 dues — clear Prep lab errors',
          href: '/prep',
        })
      }
      continue
    }

    // Saturday → mock (or mid-week mock if mockHeavy already used Wed)
    if (dow === 6) {
      slots.push({
        day,
        dateIso,
        kind: 'mock',
        title: mockExam
          ? `Full / sectional mock · ${mockExam.shortName}`
          : 'Log a mock',
        why: mockHeavy
          ? 'Deadline < 30 days — mock cadence'
          : 'Weekly mock habit',
        href: '/prep',
        examId: mockExam?.id,
      })
      continue
    }

    // Wednesday in mock-heavy → extra mock/drill
    if (mockHeavy && dow === 3) {
      slots.push({
        day,
        dateIso,
        kind: 'mock',
        title: mockExam
          ? `Sectional mock · ${mockExam.shortName}`
          : 'Sectional mock',
        why: deadline
          ? `${deadline.exam.shortName}: ${deadline.label}`
          : 'Deadline mode',
        href: '/prep',
        examId: mockExam?.id,
      })
      continue
    }

    // Weak-section drill mid-week if we have section data
    if (dow === 4 && weak) {
      const weakTopic = active.find((a) => {
        const area = a.topic.area
        if (weak.key === 'quant') return area === 'quant'
        if (weak.key === 'reasoning') return area === 'reasoning'
        if (weak.key === 'english') return area === 'english'
        if (weak.key === 'ga') return area === 'ga' || area === 'banking'
        if (weak.key === 'itPk') return area === 'computer' || area === 'gate-cs'
        return false
      })
      if (weakTopic) {
        // remove from learn queue if present
        const idx = learnQueue.findIndex((x) => x.topic.id === weakTopic.topic.id)
        if (idx >= 0) learnQueue.splice(idx, 1)
        slots.push({
          day,
          dateIso,
          kind: 'drill',
          title: `Drill weak: ${weakTopic.topic.title}`,
          why: `${weak.key} avg ${weak.avg}% in recent mocks`,
          href: '/topics',
          topicId: weakTopic.topic.id,
          examId: weakTopic.examIds[0],
        })
        continue
      }
    }

    const next = takeLearn()
    if (next) {
      slots.push({
        day,
        dateIso,
        kind: 'learn',
        title: next.topic.title,
        why: `${next.examLabels.slice(0, 2).join(' · ')} · ~${next.hoursLeft}h left`,
        href: '/focus',
        topicId: next.topic.id,
        examId: next.examIds[0],
      })
    } else {
      slots.push({
        day,
        dateIso,
        kind: 'rest',
        title: lockedPhases.length
          ? 'Foundation catch-up / light PYQ'
          : 'Buffer — mocks or revision',
        why: lockedPhases.length
          ? 'Finish foundation to unlock exam-specific topics'
          : 'Syllabus queue clear for now',
        href: '/roadmap',
      })
    }
  }

  return {
    slots,
    mockHeavy,
    foundationPct,
    locked: lockedPhases.length > 0,
  }
}
