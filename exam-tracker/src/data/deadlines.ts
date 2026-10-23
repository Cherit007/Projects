import { EXAM_BY_ID } from './exams'

export type DeadlineKind = 'apply' | 'exam' | 'interview' | 'watch'

export interface Deadline {
  examId: string
  kind: DeadlineKind
  /** ISO date YYYY-MM-DD (approximate when noted) */
  date: string
  label: string
  approx?: boolean
}

/**
 * Actionable dates from recent cycles / canvas notes.
 * Approximate dates are marked — always verify the official notification.
 */
export const DEADLINES: Deadline[] = [
  {
    examId: 'pfrda',
    kind: 'exam',
    date: '2026-11-20',
    label: 'Phase II',
  },
  {
    examId: 'ibpsso',
    kind: 'exam',
    date: '2026-11-01',
    label: 'Mains (IT)',
  },
  {
    examId: 'rrb2it',
    kind: 'exam',
    date: '2026-12-20',
    label: 'Scale II exam',
    approx: true,
  },
  {
    examId: 'sebi',
    kind: 'watch',
    date: '2026-10-15',
    label: 'Watch notification window',
    approx: true,
  },
  {
    examId: 'nabard',
    kind: 'watch',
    date: '2026-10-20',
    label: 'Expected notify window',
    approx: true,
  },
  {
    examId: 'nicscb',
    kind: 'apply',
    date: '2026-04-24',
    label: 'Apply window (verify if open)',
    approx: true,
  },
  {
    examId: 'rbi',
    kind: 'watch',
    date: '2027-04-15',
    label: 'Next cycle ~Apr–May',
    approx: true,
  },
  {
    examId: 'sbi',
    kind: 'interview',
    date: '2026-11-15',
    label: 'Interview window (if cleared)',
    approx: true,
  },
  {
    examId: 'ibpspo',
    kind: 'interview',
    date: '2026-11-10',
    label: 'Interview (after mains)',
    approx: true,
  },
  {
    examId: 'isrosc',
    kind: 'watch',
    date: '2026-11-01',
    label: 'Watch ICRB / CBT updates',
    approx: true,
  },
  {
    examId: 'aaimanit',
    kind: 'watch',
    date: '2026-11-30',
    label: 'Watch Manager (IT) drives',
    approx: true,
  },
  {
    examId: 'pwcsgate',
    kind: 'watch',
    date: '2027-02-15',
    label: 'ET post-GATE window',
    approx: true,
  },
  {
    examId: 'drdosb',
    kind: 'watch',
    date: '2026-12-01',
    label: 'Watch RAC Sci-B',
    approx: true,
  },
  {
    examId: 'ssccgl',
    kind: 'exam',
    date: '2026-10-30',
    label: 'Tier-1 window ends (if applied)',
    approx: true,
  },
  {
    examId: 'ssccgl',
    kind: 'exam',
    date: '2026-12-15',
    label: 'Tier-2 expected',
    approx: true,
  },
  {
    examId: 'ssccgl',
    kind: 'watch',
    date: '2027-05-15',
    label: 'Next CGL notify/apply window',
    approx: true,
  },
  {
    examId: 'ssccgliti',
    kind: 'watch',
    date: '2027-05-15',
    label: 'Next CGL (prefer ITI)',
    approx: true,
  },
  {
    examId: 'ssccglgst',
    kind: 'watch',
    date: '2027-05-15',
    label: 'Next CGL (prefer GST/Excise)',
    approx: true,
  },
  {
    examId: 'ssccglaao',
    kind: 'watch',
    date: '2027-05-15',
    label: 'Next CGL (AAO + Paper-III)',
    approx: true,
  },
  {
    examId: 'ssccglaso',
    kind: 'watch',
    date: '2027-05-15',
    label: 'Next CGL (prefer ASO)',
    approx: true,
  },
  {
    examId: 'statepcs',
    kind: 'watch',
    date: '2026-12-01',
    label: 'Watch home-state PSC',
    approx: true,
  },
]

export function upcomingDeadlines(limit = 8, from = new Date()) {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  return [...DEADLINES]
    .filter((d) => EXAM_BY_ID[d.examId])
    .map((d) => ({
      ...d,
      exam: EXAM_BY_ID[d.examId],
      when: new Date(`${d.date}T12:00:00`),
    }))
    .filter((d) => !Number.isNaN(d.when.getTime()))
    .filter((d) => d.when.getTime() >= start.getTime() - 2 * 86400000)
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, limit)
}

export function daysUntil(date: Date, from = new Date()) {
  const a = new Date(from)
  a.setHours(0, 0, 0, 0)
  const b = new Date(date)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
