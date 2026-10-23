import { TOPIC_BY_ID } from '../data/topics'
import type { MockScore } from '../hooks/useProgress'
import {
  SECTION_LABELS,
  type SectionKey,
  weakestSection,
} from './prepAnalytics'

export type AfterMockSuggestion = {
  id: string
  title: string
  why: string
  href: string
  topicId?: string
  kind: 'drill' | 'revise' | 'mock' | 'topic'
}

const SECTION_TO_AREAS: Record<SectionKey, string[]> = {
  quant: ['quant'],
  reasoning: ['reasoning'],
  english: ['english'],
  ga: ['ga', 'banking'],
  itPk: ['computer', 'gate-cs'],
}

/** Build post-mock actions from the latest mock’s weak section. */
export function buildAfterMockFlow(args: {
  mockScores: MockScore[]
  isDone: (id: string) => boolean
  take?: number
}): {
  mock: MockScore | null
  weak: { key: SectionKey; avg: number } | null
  suggestions: AfterMockSuggestion[]
} {
  const mock = args.mockScores[0] ?? null
  if (!mock) {
    return { mock: null, weak: null, suggestions: [] }
  }

  const scoped = args.mockScores.filter((m) => m.examId === mock.examId)
  const weak = weakestSection(scoped.length ? scoped : [mock])
  const suggestions: AfterMockSuggestion[] = []

  if (weak) {
    const areas = new Set(SECTION_TO_AREAS[weak.key] ?? [])
    const topics = Object.values(TOPIC_BY_ID)
      .filter((t) => areas.has(t.area) && !args.isDone(t.id))
      .slice(0, args.take ?? 3)
    for (const t of topics) {
      suggestions.push({
        id: `am-${t.id}`,
        title: t.title,
        why: `${SECTION_LABELS[weak.key]} avg ${weak.avg}% on recent mocks`,
        href: '/topics',
        topicId: t.id,
        kind: 'topic',
      })
    }
    if (!topics.length) {
      suggestions.push({
        id: `am-sec-${weak.key}`,
        title: `Drill ${SECTION_LABELS[weak.key]}`,
        why: `Section avg ${weak.avg}% — syllabus already ticked; do PYQ drills`,
        href: '/topics',
        kind: 'drill',
      })
    }
  }

  suggestions.push({
    id: 'am-error',
    title: 'Log 2–3 mistakes in error notebook',
    why: 'Turns mock pain into spaced revision cards',
    href: '/prep',
    kind: 'revise',
  })

  return { mock, weak, suggestions: suggestions.slice(0, (args.take ?? 3) + 1) }
}
