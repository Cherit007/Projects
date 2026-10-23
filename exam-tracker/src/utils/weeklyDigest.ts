import { daysUntil, upcomingDeadlines } from '../data/deadlines'
import { EXAM_BY_ID } from '../data/exams'

export type DigestItem = {
  examId: string
  label: string
  days: number
  kind: string
}

/** Deadlines in the next `withinDays` for starred (or all) exams. */
export function buildWeeklyDigest(args: {
  starredIds: string[]
  withinDays?: number
  from?: Date
}): DigestItem[] {
  const within = args.withinDays ?? 30
  const from = args.from ?? new Date()
  const starSet = new Set(args.starredIds)
  const preferStarred = starSet.size > 0

  return upcomingDeadlines(20, from)
    .map((d) => {
      const days = daysUntil(d.when, from)
      return {
        examId: d.examId,
        label: `${EXAM_BY_ID[d.examId]?.shortName ?? d.exam.shortName}: ${d.label}`,
        days,
        kind: d.kind,
      }
    })
    .filter((d) => d.days >= 0 && d.days <= within)
    .filter((d) => !preferStarred || starSet.has(d.examId))
    .slice(0, 6)
}

export function digestMessage(items: DigestItem[]): string {
  if (!items.length) return 'No apply/exam deadlines in the next 30 days for your ★ exams.'
  const head = items
    .slice(0, 3)
    .map((i) => `${i.label} (${i.days}d)`)
    .join(' · ')
  return `This week’s watch: ${head}${items.length > 3 ? '…' : ''}`
}
