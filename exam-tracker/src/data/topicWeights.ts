/**
 * Per-exam relative topic weights (1 = baseline).
 * Used for roadmap ordering and weighted hour estimates.
 */
export const EXAM_TOPIC_WEIGHTS: Record<string, Record<string, number>> = {
  ssccgl: {
    'qa-di': 1.5,
    'qa-algebra': 1.3,
    'qa-number-system': 1.2,
    're-puzzle': 1.3,
    'en-rc': 1.2,
    'ga-static': 1.6,
    'ga-current': 1.4,
    'comp-fundamentals': 1.1,
  },
  ssccgliti: {
    'qa-di': 1.5,
    'ga-static': 1.5,
    'ga-current': 1.3,
    'en-rc': 1.2,
    're-puzzle': 1.3,
  },
  ssccglgst: {
    'qa-di': 1.4,
    'ga-static': 1.5,
    'ga-current': 1.3,
    're-puzzle': 1.2,
  },
  ssccglaao: {
    'qa-di': 1.3,
    'ga-static': 1.3,
    'fm-basics': 1.8,
    'fm-ratio': 1.7,
    'fm-risk': 1.6,
    'fm-mgmt': 1.5,
    'esi-growth': 1.4,
    'esi-inflation': 1.3,
  },
  ssccglaso: {
    'qa-di': 1.4,
    'en-rc': 1.4,
    'en-grammar': 1.3,
    'ga-static': 1.5,
    'comp-fundamentals': 1.2,
  },
  sebi: {
    'qa-di': 1.3,
    'esi-growth': 1.6,
    'esi-inflation': 1.5,
    'fm-basics': 1.7,
    'fm-fintech': 1.6,
    'fm-risk': 1.5,
    'comp-security': 1.2,
  },
  rbi: {
    'qa-di': 1.4,
    'esi-growth': 1.7,
    'esi-inflation': 1.6,
    'fm-basics': 1.6,
    'ga-economy': 1.4,
    'en-rc': 1.3,
  },
  nabard: {
    'qa-di': 1.3,
    'esi-growth': 1.5,
    'ard-agri': 1.8,
    'ard-rural': 1.7,
    'ga-current': 1.3,
  },
  ibpsso: {
    'qa-di': 1.3,
    're-puzzle': 1.3,
    'comp-dsa': 1.6,
    'comp-dbms': 1.5,
    'comp-networking': 1.5,
    'comp-security': 1.4,
  },
}

/** Relative weight for a topic under an exam (default 1). */
export function topicWeight(examId: string, topicId: string): number {
  return EXAM_TOPIC_WEIGHTS[examId]?.[topicId] ?? 1
}

/** Max weight across a set of exams (for multi-exam roadmap items). */
export function maxTopicWeight(examIds: string[], topicId: string): number {
  let max = 1
  for (const id of examIds) {
    const w = topicWeight(id, topicId)
    if (w > max) max = w
  }
  return max
}
