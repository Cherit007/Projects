import { TOPIC_BY_ID, TOPICS } from '../data/topics'
import type { Topic, TopicArea } from '../data/types'

/** Default study hours by area (concept + practice). */
const AREA_HOURS: Record<TopicArea, number> = {
  quant: 10,
  reasoning: 10,
  english: 8,
  ga: 12,
  banking: 8,
  esi: 14,
  fm: 14,
  ard: 12,
  computer: 12,
  'gate-cs': 16,
  'desc-eng': 6,
  interview: 4,
}

/** Heavier / lighter overrides for high-yield topics */
const HOUR_OVERRIDES: Record<string, number> = {
  'qa-di': 14,
  're-puzzle': 14,
  'ga-static': 16,
  'ga-current': 14,
  'comp-dsa': 16,
  'comp-security': 10,
  'fm-basics': 12,
  'esi-growth': 10,
}

export function topicHours(topic: Topic): number {
  return HOUR_OVERRIDES[topic.id] ?? AREA_HOURS[topic.area] ?? 8
}

export function topicHoursById(topicId: string): number {
  const t = TOPIC_BY_ID[topicId]
  return t ? topicHours(t) : 8
}

export type TopicProgress = {
  doneSubs: number
  totalSubs: number
  pct: number
  fullyDone: boolean
}

export function topicProgress(
  topic: Topic,
  isDone: (id: string) => boolean,
  isSubDone: (id: string, i: number) => boolean,
): TopicProgress {
  const totalSubs = Math.max(1, topic.subtopics.length)
  if (isDone(topic.id)) {
    return { doneSubs: totalSubs, totalSubs, pct: 100, fullyDone: true }
  }
  let doneSubs = 0
  for (let i = 0; i < topic.subtopics.length; i++) {
    if (isSubDone(topic.id, i)) doneSubs++
  }
  const pct = Math.round((doneSubs / totalSubs) * 100)
  return { doneSubs, totalSubs, pct, fullyDone: false }
}

export function remainingHours(
  topic: Topic,
  isDone: (id: string) => boolean,
  isSubDone: (id: string, i: number) => boolean,
): number {
  const hours = topicHours(topic)
  const { pct, fullyDone } = topicProgress(topic, isDone, isSubDone)
  if (fullyDone) return 0
  return Math.round(hours * (1 - pct / 100) * 10) / 10
}

export function allTopics(): Topic[] {
  return TOPICS
}
