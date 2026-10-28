import type { Exam } from '../data/types'

/** Extra tokens so short queries like "IB" / "ACIO" / "TSPSC" hit the right cards. */
const ALIASES: Record<string, string[]> = {
  ibacio: [
    'ib',
    'acio',
    'acio-ii',
    'intelligence bureau',
    'mha',
    'central intelligence',
  ],
  statepcs: ['tspsc', 'appsc', 'mpsc', 'uppsc', 'group-1', 'group 1', 'pcs'],
  ssccgl: ['cgl', 'ssc'],
  ssccgliti: ['income tax', 'iti', 'cbdt'],
  ssccglgst: ['gst', 'excise', 'cbic'],
  ssccglaao: ['aao', 'cag'],
  ssccglaso: ['aso', 'css', 'mea'],
  sebi: ['sebi'],
  ibpsso: ['ibps so', 'so it'],
  nabard: ['nabard'],
  rbi: ['rbi'],
}

function examHaystack(exam: Exam): string {
  const alias = (ALIASES[exam.id] ?? []).join(' ')
  return [
    exam.id,
    exam.name,
    exam.shortName,
    exam.tier,
    exam.status,
    exam.cycle,
    exam.exam,
    exam.reg,
    exam.location,
    exam.qual,
    exam.fit,
    exam.difficulty,
    exam.appsNote,
    ...(exam.tags ?? []),
    ...exam.coachingRefs,
    alias,
    exam.tags?.includes('it-officer') ? 'IT Officer PSU bank' : '',
  ]
    .join(' ')
    .toLowerCase()
}

/** True if every whitespace token in `query` appears in the exam haystack. */
export function examMatchesQuery(exam: Exam, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = examHaystack(exam)
  const tokens = q.split(/[\s,/|+]+/).filter(Boolean)
  if (!tokens.length) return true
  return tokens.every((t) => hay.includes(t))
}
