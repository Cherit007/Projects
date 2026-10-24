import { EXAM_BY_ID, examTopicIds } from '../data/exams'
import { TOPIC_BY_ID } from '../data/topics'
import type { Exam, Topic } from '../data/types'
import { topicProgress } from './topicMeta'

export type ExamGroup = {
  id: string
  name: string
  examIds: string[]
  /** ISO timestamp */
  createdAt: string
}

export type GroupTopicRow = {
  topic: Topic
  /** Exams in the group that include this topic */
  examIds: string[]
  examLabels: string[]
}

export type GroupSyllabus = {
  exams: Exam[]
  /** In every selected exam */
  common: GroupTopicRow[]
  /** In some but not all selected exams */
  extras: GroupTopicRow[]
}

function sortRows(rows: GroupTopicRow[]): GroupTopicRow[] {
  return [...rows].sort((a, b) => {
    if (b.examIds.length !== a.examIds.length) {
      return b.examIds.length - a.examIds.length
    }
    return a.topic.title.localeCompare(b.topic.title)
  })
}

/** Split group syllabus into shared-by-all vs extras. */
export function partitionGroupSyllabus(examIds: string[]): GroupSyllabus {
  const exams = examIds
    .map((id) => EXAM_BY_ID[id])
    .filter((e): e is Exam => !!e)
    .sort((a, b) => a.priority - b.priority)

  if (!exams.length) {
    return { exams: [], common: [], extras: [] }
  }

  const sets = exams.map((e) => new Set(examTopicIds(e)))
  const union = new Set<string>()
  for (const s of sets) for (const id of s) union.add(id)

  const common: GroupTopicRow[] = []
  const extras: GroupTopicRow[] = []

  for (const tid of union) {
    const topic = TOPIC_BY_ID[tid]
    if (!topic) continue
    const present = exams.filter((_, i) => sets[i].has(tid))
    const row: GroupTopicRow = {
      topic,
      examIds: present.map((e) => e.id),
      examLabels: present.map((e) => e.shortName),
    }
    if (present.length === exams.length) common.push(row)
    else extras.push(row)
  }

  return {
    exams,
    common: sortRows(common),
    extras: sortRows(extras),
  }
}

export function groupProgress(
  rows: GroupTopicRow[],
  isDone: (id: string) => boolean,
  isSubDone: (id: string, i: number) => boolean,
): { done: number; total: number; pct: number } {
  const total = rows.length
  let done = 0
  for (const row of rows) {
    if (topicProgress(row.topic, isDone, isSubDone).fullyDone) done++
  }
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
  }
}

export function normalizeExamGroups(raw: unknown): ExamGroup[] {
  if (!Array.isArray(raw)) return []
  const out: ExamGroup[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const g = item as Partial<ExamGroup>
    if (typeof g.id !== 'string' || !g.id) continue
    if (typeof g.name !== 'string' || !g.name.trim()) continue
    const examIds = Array.isArray(g.examIds)
      ? g.examIds.filter(
          (id): id is string => typeof id === 'string' && !!EXAM_BY_ID[id],
        )
      : []
    if (!examIds.length) continue
    out.push({
      id: g.id,
      name: g.name.trim().slice(0, 48),
      examIds: [...new Set(examIds)],
      createdAt:
        typeof g.createdAt === 'string' ? g.createdAt : new Date().toISOString(),
    })
  }
  return out
}

/** Prefer local group definition when ids collide. */
export function mergeExamGroups(
  local: ExamGroup[],
  cloud: ExamGroup[],
): ExamGroup[] {
  const map = new Map<string, ExamGroup>()
  for (const g of cloud) map.set(g.id, g)
  for (const g of local) map.set(g.id, g)
  return [...map.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}
