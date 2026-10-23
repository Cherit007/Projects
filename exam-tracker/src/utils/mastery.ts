import type { Topic } from '../data/types'
import { topicProgress } from './topicMeta'

export type MasteryLevel = 'learning' | 'practiced' | 'mastered'

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  learning: 'Learning',
  practiced: 'Practiced',
  mastered: 'Mastered',
}

const CYCLE: MasteryLevel[] = ['learning', 'practiced', 'mastered']

/** Explicit state, or inferred from checklist progress. */
export function resolveMastery(
  topic: Topic,
  stored: MasteryLevel | undefined,
  isDone: (id: string) => boolean,
  isSubDone: (id: string, i: number) => boolean,
): MasteryLevel | null {
  if (stored) return stored
  const prog = topicProgress(topic, isDone, isSubDone)
  if (prog.fullyDone) return 'practiced'
  if (prog.pct > 0) return 'learning'
  return null
}

export function nextMastery(current: MasteryLevel | null): MasteryLevel | null {
  if (!current) return 'learning'
  const i = CYCLE.indexOf(current)
  if (i < 0 || i >= CYCLE.length - 1) return null // after mastered → clear
  return CYCLE[i + 1]
}
