import { EXAM_BY_ID, EXAMS, examTopicIds } from '../data/exams'
import { TOPIC_BY_ID } from '../data/topics'
import type { Exam, Topic, TopicArea } from '../data/types'
import type { MockScore } from '../hooks/useProgress'
import { readinessScore } from './readiness'
import { remainingHours, topicHours, topicProgress } from './topicMeta'

export type RoadmapPhase = 'foundation' | 'specific' | 'polish'

export type RoadmapItem = {
  topic: Topic
  phase: RoadmapPhase
  examIds: string[]
  examLabels: string[]
  hoursLeft: number
  hoursTotal: number
  pct: number
  score: number
  fullyDone: boolean
}

export type ExamRoadStrip = {
  exam: Exam
  readiness: number
  topicsLeft: number
  hoursLeft: number
  etaDays: number | null
}

const FOUNDATION: TopicArea[] = ['quant', 'reasoning', 'english']
const POLISH: TopicArea[] = ['interview', 'desc-eng']

function phaseFor(area: TopicArea): RoadmapPhase {
  if (FOUNDATION.includes(area)) return 'foundation'
  if (POLISH.includes(area)) return 'polish'
  return 'specific'
}

const PHASE_ORDER: Record<RoadmapPhase, number> = {
  foundation: 0,
  specific: 1,
  polish: 2,
}

export function starredExams(starredIds: string[]): Exam[] {
  const set = new Set(starredIds)
  return EXAMS.filter((e) => set.has(e.id)).sort((a, b) => a.priority - b.priority)
}

/** Union syllabus for favorites, ordered for systematic prep. */
export function buildRoadmap(args: {
  starredIds: string[]
  completed: Record<string, boolean>
  isDone: (id: string) => boolean
  isSubDone: (id: string, i: number) => boolean
  weakTopicIds?: string[]
}): RoadmapItem[] {
  const exams = starredExams(args.starredIds)
  if (!exams.length) return []

  const weak = new Set(args.weakTopicIds ?? [])
  const map = new Map<string, Set<string>>()

  for (const exam of exams) {
    for (const tid of examTopicIds(exam)) {
      if (!TOPIC_BY_ID[tid]) continue
      if (!map.has(tid)) map.set(tid, new Set())
      map.get(tid)!.add(exam.id)
    }
  }

  const items: RoadmapItem[] = []
  for (const [tid, examSet] of map) {
    const topic = TOPIC_BY_ID[tid]
    if (!topic) continue
    const prog = topicProgress(topic, args.isDone, args.isSubDone)
    const hoursTotal = topicHours(topic)
    const hoursLeft = remainingHours(topic, args.isDone, args.isSubDone)
    const share = examSet.size
    const phase = phaseFor(topic.area)
    // Higher score = do sooner
    let score = share * 20 - PHASE_ORDER[phase] * 5
    if (weak.has(tid)) score += 25
    if (!prog.fullyDone && prog.pct > 0 && prog.pct < 100) score += 10 // finish in-progress
    if (prog.fullyDone) score -= 1000

    items.push({
      topic,
      phase,
      examIds: [...examSet],
      examLabels: [...examSet].map((id) => EXAM_BY_ID[id]?.shortName ?? id),
      hoursLeft,
      hoursTotal,
      pct: prog.pct,
      score,
      fullyDone: prog.fullyDone,
    })
  }

  return items.sort((a, b) => {
    if (a.fullyDone !== b.fullyDone) return a.fullyDone ? 1 : -1
    if (PHASE_ORDER[a.phase] !== PHASE_ORDER[b.phase]) {
      return PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]
    }
    return b.score - a.score || a.topic.title.localeCompare(b.topic.title)
  })
}

export function roadmapTotals(items: RoadmapItem[]) {
  const pending = items.filter((i) => !i.fullyDone)
  const hoursLeft = pending.reduce((s, i) => s + i.hoursLeft, 0)
  const hoursDone = items.reduce((s, i) => s + (i.hoursTotal - i.hoursLeft), 0)
  const hoursTotal = items.reduce((s, i) => s + i.hoursTotal, 0)
  return {
    topicCount: items.length,
    pendingCount: pending.length,
    doneCount: items.length - pending.length,
    hoursLeft: Math.round(hoursLeft * 10) / 10,
    hoursDone: Math.round(hoursDone * 10) / 10,
    hoursTotal: Math.round(hoursTotal * 10) / 10,
  }
}

export function etaDays(hoursLeft: number, dailyMinutes: number): number | null {
  if (dailyMinutes <= 0) return null
  const hoursPerDay = dailyMinutes / 60
  if (hoursPerDay <= 0) return null
  return Math.ceil(hoursLeft / hoursPerDay)
}

export function formatEta(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return 'Set daily minutes'
  if (days <= 0) return 'Caught up'
  if (days === 1) return '~1 day'
  if (days < 14) return `~${days} days`
  const weeks = Math.ceil(days / 7)
  return `~${weeks} week${weeks === 1 ? '' : 's'}`
}

export function examRoadStrips(args: {
  starredIds: string[]
  completed: Record<string, boolean>
  mockScores: MockScore[]
  isDone: (id: string) => boolean
  isSubDone: (id: string, i: number) => boolean
  dailyMinutes: number
}): ExamRoadStrip[] {
  return starredExams(args.starredIds).map((exam) => {
    const ids = examTopicIds(exam)
    let hoursLeft = 0
    let topicsLeft = 0
    for (const tid of ids) {
      const topic = TOPIC_BY_ID[tid]
      if (!topic) continue
      const left = remainingHours(topic, args.isDone, args.isSubDone)
      if (left > 0) {
        hoursLeft += left
        topicsLeft++
      }
    }
    const readiness = readinessScore(exam, args.completed, args.mockScores).score
    return {
      exam,
      readiness,
      topicsLeft,
      hoursLeft: Math.round(hoursLeft * 10) / 10,
      etaDays: etaDays(hoursLeft, args.dailyMinutes),
    }
  })
}

export const PHASE_LABELS: Record<RoadmapPhase, string> = {
  foundation: '1 · Foundation (shared)',
  specific: '2 · Exam-specific',
  polish: '3 · Interview / descriptive',
}
