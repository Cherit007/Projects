import { daysUntil, upcomingDeadlines } from '../data/deadlines'
import { EXAMS, examTopicIds } from '../data/exams'
import { TOPIC_BY_ID } from '../data/topics'
import type { Exam } from '../data/types'
import type { MockScore, StudyEntry } from '../hooks/useProgress'

export function syllabusPct(
  exam: Exam,
  completed: Record<string, boolean>,
): number {
  const ids = examTopicIds(exam)
  if (!ids.length) return 0
  const done = ids.filter((id) => completed[id]).length
  return Math.round((done / ids.length) * 100)
}

export function mockAvg(examId: string, mocks: MockScore[]): number | null {
  const list = mocks.filter((m) => m.examId === examId)
  if (!list.length) return null
  const avg =
    list.reduce((s, m) => s + (m.score / Math.max(1, m.maxScore)) * 100, 0) /
    list.length
  return Math.round(avg)
}

/** 0–100 readiness: syllabus + mocks + urgency boost for near deadlines */
export function readinessScore(
  exam: Exam,
  completed: Record<string, boolean>,
  mocks: MockScore[],
): { score: number; label: string; syllabus: number; mocks: number | null } {
  const syllabus = syllabusPct(exam, completed)
  const mocksPct = mockAvg(exam.id, mocks)
  const next = upcomingDeadlines(20).find((d) => d.examId === exam.id)
  const days = next ? daysUntil(next.when) : 120
  const urgency =
    days <= 14 ? 12 : days <= 45 ? 8 : days <= 90 ? 4 : 0

  const mockPart = mocksPct == null ? syllabus * 0.35 : mocksPct * 0.35
  const score = Math.min(
    100,
    Math.round(syllabus * 0.55 + mockPart + urgency),
  )

  const label =
    score >= 75 ? 'Exam-ready zone' : score >= 45 ? 'Building' : 'Foundation'

  return { score, label, syllabus, mocks: mocksPct }
}

export function studyStreak(studyLog: StudyEntry[], from = new Date()): number {
  const days = new Set(studyLog.map((e) => e.date))
  let streak = 0
  const cursor = new Date(from)
  cursor.setHours(12, 0, 0, 0)
  // Allow today or yesterday as streak anchor
  const today = cursor.toISOString().slice(0, 10)
  cursor.setDate(cursor.getDate() - 1)
  const yesterday = cursor.toISOString().slice(0, 10)
  if (!days.has(today) && !days.has(yesterday)) return 0
  const start = days.has(today) ? new Date(from) : new Date(from)
  if (!days.has(today)) start.setDate(start.getDate() - 1)
  start.setHours(12, 0, 0, 0)
  for (;;) {
    const key = start.toISOString().slice(0, 10)
    if (!days.has(key)) break
    streak += 1
    start.setDate(start.getDate() - 1)
  }
  return streak
}

export type PlanItem = {
  id: string
  title: string
  why: string
  href: string
  kind: 'topic' | 'exam' | 'mock' | 'focus'
}

export function buildTodayPlan(args: {
  completed: Record<string, boolean>
  starred: string[]
  mockScores: MockScore[]
  weakTopicIds: string[]
}): PlanItem[] {
  const items: PlanItem[] = []
  const nextDeadline = upcomingDeadlines(1)[0]
  if (nextDeadline) {
    items.push({
      id: `deadline-${nextDeadline.examId}`,
      title: `Push ${nextDeadline.exam.shortName}`,
      why: `${nextDeadline.label} · ${nextDeadline.date}`,
      href: `/exam/${nextDeadline.examId}`,
      kind: 'exam',
    })
  }

  for (const topicId of args.weakTopicIds.slice(0, 2)) {
    const title = TOPIC_BY_ID[topicId]?.title ?? topicId
    items.push({
      id: `topic-${topicId}`,
      title: `Clear: ${title}`,
      why: 'Shared across 3+ exams — one tick syncs everywhere',
      href: '/topics',
      kind: 'topic',
    })
  }

  const focusPool = args.starred.length
    ? EXAMS.filter((e) => args.starred.includes(e.id))
    : EXAMS.filter((e) => e.tags?.includes('it-officer')).slice(0, 3)

  const needMock = focusPool.find(
    (e) => !args.mockScores.some((m) => m.examId === e.id),
  )
  if (needMock) {
    items.push({
      id: `mock-${needMock.id}`,
      title: `Log a mock for ${needMock.shortName}`,
      why: 'Readiness needs a score signal',
      href: '/prep',
      kind: 'mock',
    })
  }

  const low = [...focusPool]
    .map((e) => ({
      e,
      r: readinessScore(e, args.completed, args.mockScores).score,
    }))
    .sort((a, b) => a.r - b.r)[0]
  if (low) {
    items.push({
      id: `focus-${low.e.id}`,
      title: `Focus block: ${low.e.shortName}`,
      why: `Readiness ${low.r}% — deepest gap in your shortlist`,
      href: '/focus',
      kind: 'focus',
    })
  }

  // de-dupe by id, max 4
  const seen = new Set<string>()
  return items.filter((i) => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  }).slice(0, 4)
}
