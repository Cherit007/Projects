import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { EXAMS, examTopicIds, examsSharingTopic } from '../data/exams'
import { TOPICS } from '../data/topics'
import { scheduleCloudSave } from '../lib/cloudSync'
import {
  dueRevisions,
  reviewCard,
  scheduleFirstReview,
  todayIso,
  type RevisionCard,
} from '../utils/spacedRepetition'
import type { ExamGroup } from '../utils/examGroups'
import { normalizeExamGroups } from '../utils/examGroups'
import type { MasteryLevel } from '../utils/mastery'
import type { SectionKey } from '../utils/prepAnalytics'
import { studyStreak } from '../utils/readiness'

const STORAGE_KEY = 'exam-prep-app-v2'
const LEGACY_KEY = 'exam-prep-progress-v1'

export type StudyEntry = {
  id: string
  date: string
  minutes: number
  note: string
  examId?: string
  topicIds: string[]
}

export type MockSections = Partial<Record<SectionKey, number>>

export type MockScore = {
  id: string
  examId: string
  source: string
  score: number
  maxScore: number
  date: string
  note: string
  /** Section accuracy % 0–100 from Oliveboard / other platforms */
  sections?: MockSections
  percentile?: number
  stage?: 'prelims' | 'mains' | 'sectional' | 'other'
}

export type ErrorEntry = {
  id: string
  date: string
  examId?: string
  topicId?: string
  topicLabel: string
  mistakeType: 'concept' | 'silly' | 'time'
  section?: SectionKey | 'other'
  note: string
}

export type AppState = {
  completed: Record<string, boolean>
  starred: string[]
  /** Exams sunk to the bottom of Targets */
  deprioritized: string[]
  /** ★ exams excluded from roadmap / week plan (still starred) */
  roadmapIgnored: string[]
  studyLog: StudyEntry[]
  mockScores: MockScore[]
  errorLog: ErrorEntry[]
  /** topicId → spaced revision card */
  revision: Record<string, RevisionCard>
  /** topicId → Learning / Practiced / Mastered */
  mastery: Record<string, MasteryLevel>
  focusExamId: string | null
  /** Active topic for Focus timer logging */
  focusTopicId: string | null
  /** ISO date when user marked “done for today” */
  checkInDoneDate: string | null
  /** ISO date of last weekly digest toast */
  lastDigestAt: string | null
  remindersEnabled: boolean
  /** Application / document prep checklist */
  docs: Record<string, boolean>
  /** Named multi-exam sets for common + extra syllabus tracking */
  examGroups: ExamGroup[]
}

const EMPTY: AppState = {
  completed: {},
  starred: [],
  deprioritized: [],
  roadmapIgnored: [],
  studyLog: [],
  mockScores: [],
  errorLog: [],
  revision: {},
  mastery: {},
  focusExamId: null,
  focusTopicId: null,
  checkInDoneDate: null,
  lastDigestAt: null,
  remindersEnabled: false,
  docs: {},
  examGroups: [],
}

function asMasteryMap(v: unknown): Record<string, MasteryLevel> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, MasteryLevel> = {}
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (raw === 'learning' || raw === 'practiced' || raw === 'mastered') {
      out[k] = raw
    }
  }
  return out
}

function migrateLegacy(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function asRevisionMap(v: unknown): Record<string, RevisionCard> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, RevisionCard> = {}
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const c = raw as Partial<RevisionCard>
    if (typeof c.due !== 'string') continue
    out[k] = {
      topicId: typeof c.topicId === 'string' ? c.topicId : k,
      due: c.due,
      interval: typeof c.interval === 'number' ? c.interval : 1,
      ease: typeof c.ease === 'number' ? c.ease : 2.5,
      reps: typeof c.reps === 'number' ? c.reps : 0,
    }
  }
  return out
}

function readStorage(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const legacy = migrateLegacy()
      return { ...EMPTY, completed: legacy }
    }
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      completed: parsed.completed ?? migrateLegacy(),
      starred: Array.isArray(parsed.starred) ? parsed.starred : [],
      deprioritized: Array.isArray(parsed.deprioritized)
        ? parsed.deprioritized
        : [],
      roadmapIgnored: Array.isArray(parsed.roadmapIgnored)
        ? parsed.roadmapIgnored
        : [],
      studyLog: Array.isArray(parsed.studyLog) ? parsed.studyLog : [],
      mockScores: Array.isArray(parsed.mockScores) ? parsed.mockScores : [],
      errorLog: Array.isArray(parsed.errorLog) ? parsed.errorLog : [],
      revision: asRevisionMap(parsed.revision),
      mastery: asMasteryMap(parsed.mastery),
      focusExamId: parsed.focusExamId ?? null,
      focusTopicId:
        typeof parsed.focusTopicId === 'string' ? parsed.focusTopicId : null,
      checkInDoneDate:
        typeof parsed.checkInDoneDate === 'string'
          ? parsed.checkInDoneDate
          : null,
      lastDigestAt:
        typeof parsed.lastDigestAt === 'string' ? parsed.lastDigestAt : null,
      remindersEnabled: !!parsed.remindersEnabled,
      docs: parsed.docs && typeof parsed.docs === 'object' ? parsed.docs : {},
      examGroups: normalizeExamGroups(parsed.examGroups),
    }
  } catch {
    return { ...EMPTY }
  }
}

let memoryCache: AppState =
  typeof localStorage !== 'undefined' ? readStorage() : { ...EMPTY }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): AppState {
  return memoryCache
}

function persist(next: AppState) {
  memoryCache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
  scheduleCloudSave(next)
  emit()
}

/** Snapshot for cloud merge / auth lifecycle (outside React). */
export function exportProgressSnapshot(): AppState {
  return memoryCache
}

/** Replace full state (login merge). */
export function replaceProgressState(next: AppState) {
  persist(next)
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function withRevisionOnComplete(
  completed: Record<string, boolean>,
  revision: Record<string, RevisionCard>,
  topicId: string,
  nowDone: boolean,
): Record<string, RevisionCard> {
  const next = { ...revision }
  if (nowDone) {
    if (!next[topicId]) next[topicId] = scheduleFirstReview(topicId)
  } else {
    delete next[topicId]
  }
  // keep completed param referenced for clarity / future hooks
  void completed
  return next
}

export function useProgress() {
  const state = useSyncExternalStore(subscribe, getSnapshot, (): AppState => ({
    ...EMPTY,
  }))
  const {
    completed,
    starred,
    deprioritized,
    roadmapIgnored,
    studyLog,
    mockScores,
    errorLog,
    revision,
    mastery,
    focusExamId,
    focusTopicId,
    checkInDoneDate,
    lastDigestAt,
    remindersEnabled,
    docs,
    examGroups,
  } = state

  const toggleTopic = useCallback((topicId: string) => {
    const nextCompleted = { ...memoryCache.completed, [topicId]: !memoryCache.completed[topicId] }
    const nowDone = !!nextCompleted[topicId]
    if (!nowDone) delete nextCompleted[topicId]
    const nextMastery = { ...memoryCache.mastery }
    if (nowDone && !nextMastery[topicId]) nextMastery[topicId] = 'practiced'
    if (!nowDone) delete nextMastery[topicId]
    persist({
      ...memoryCache,
      completed: nextCompleted,
      mastery: nextMastery,
      revision: withRevisionOnComplete(
        nextCompleted,
        memoryCache.revision,
        topicId,
        nowDone,
      ),
    })
  }, [])

  const setTopic = useCallback((topicId: string, value: boolean) => {
    const nextCompleted = { ...memoryCache.completed }
    if (value) nextCompleted[topicId] = true
    else delete nextCompleted[topicId]
    const nextMastery = { ...memoryCache.mastery }
    if (value && !nextMastery[topicId]) nextMastery[topicId] = 'practiced'
    if (!value) delete nextMastery[topicId]
    persist({
      ...memoryCache,
      completed: nextCompleted,
      mastery: nextMastery,
      revision: withRevisionOnComplete(
        nextCompleted,
        memoryCache.revision,
        topicId,
        value,
      ),
    })
  }, [])

  const toggleSubtopic = useCallback(
    (topicId: string, subIndex: number, total: number) => {
      const key = `${topicId}::${subIndex}`
      const nextCompleted = {
        ...memoryCache.completed,
        [key]: !memoryCache.completed[key],
      }
      if (!nextCompleted[key]) delete nextCompleted[key]

      let allDone = true
      for (let i = 0; i < total; i++) {
        const k = `${topicId}::${i}`
        const val = i === subIndex ? !!nextCompleted[key] : !!nextCompleted[k]
        if (!val) {
          allDone = false
          break
        }
      }
      if (allDone) nextCompleted[topicId] = true
      else delete nextCompleted[topicId]

      const nextMastery = { ...memoryCache.mastery }
      if (allDone && !nextMastery[topicId]) nextMastery[topicId] = 'practiced'
      if (!allDone && nextMastery[topicId] === 'practiced') {
        nextMastery[topicId] = 'learning'
      }

      persist({
        ...memoryCache,
        completed: nextCompleted,
        mastery: nextMastery,
        revision: withRevisionOnComplete(
          nextCompleted,
          memoryCache.revision,
          topicId,
          allDone,
        ),
      })
    },
    [],
  )

  const setMastery = useCallback((topicId: string, level: MasteryLevel | null) => {
    const next = { ...memoryCache.mastery }
    if (level) next[topicId] = level
    else delete next[topicId]
    persist({ ...memoryCache, mastery: next })
  }, [])

  const cycleMastery = useCallback((topicId: string) => {
    const order: Array<MasteryLevel | null> = [
      'learning',
      'practiced',
      'mastered',
      null,
    ]
    const cur = memoryCache.mastery[topicId] ?? null
    const idx = order.indexOf(cur)
    const nextLevel = order[(idx + 1) % order.length]
    const next = { ...memoryCache.mastery }
    if (nextLevel) next[topicId] = nextLevel
    else delete next[topicId]
    persist({ ...memoryCache, mastery: next })
  }, [])

  const isDone = useCallback(
    (topicId: string) => !!completed[topicId],
    [completed],
  )

  const isSubDone = useCallback(
    (topicId: string, subIndex: number) =>
      !!completed[`${topicId}::${subIndex}`] || !!completed[topicId],
    [completed],
  )

  const toggleStar = useCallback((examId: string) => {
    const stars = new Set(memoryCache.starred)
    const sunk = new Set(memoryCache.deprioritized)
    const ignored = new Set(memoryCache.roadmapIgnored)
    if (stars.has(examId)) {
      stars.delete(examId)
      ignored.delete(examId)
    } else {
      stars.add(examId)
      sunk.delete(examId)
    }
    persist({
      ...memoryCache,
      starred: [...stars],
      deprioritized: [...sunk],
      roadmapIgnored: [...ignored],
    })
  }, [])

  const isStarred = useCallback(
    (examId: string) => starred.includes(examId),
    [starred],
  )

  const toggleDeprioritize = useCallback((examId: string) => {
    const sunk = new Set(memoryCache.deprioritized)
    const stars = new Set(memoryCache.starred)
    if (sunk.has(examId)) {
      sunk.delete(examId)
    } else {
      sunk.add(examId)
      stars.delete(examId)
    }
    persist({
      ...memoryCache,
      deprioritized: [...sunk],
      starred: [...stars],
    })
  }, [])

  const isDeprioritized = useCallback(
    (examId: string) => deprioritized.includes(examId),
    [deprioritized],
  )

  const toggleRoadmapIgnore = useCallback((examId: string) => {
    const ignored = new Set(memoryCache.roadmapIgnored)
    if (ignored.has(examId)) ignored.delete(examId)
    else ignored.add(examId)
    persist({ ...memoryCache, roadmapIgnored: [...ignored] })
  }, [])

  const isRoadmapIgnored = useCallback(
    (examId: string) => roadmapIgnored.includes(examId),
    [roadmapIgnored],
  )

  /** Starred exams that still feed roadmap / week plan. */
  const roadmapStarred = useMemo(
    () => starred.filter((id) => !roadmapIgnored.includes(id)),
    [starred, roadmapIgnored],
  )

  const addStudy = useCallback(
    (entry: Omit<StudyEntry, 'id'>) => {
      persist({
        ...memoryCache,
        studyLog: [{ ...entry, id: uid() }, ...memoryCache.studyLog].slice(0, 200),
      })
    },
    [],
  )

  const removeStudy = useCallback((id: string) => {
    persist({
      ...memoryCache,
      studyLog: memoryCache.studyLog.filter((e) => e.id !== id),
    })
  }, [])

  const addMock = useCallback((entry: Omit<MockScore, 'id'>) => {
    persist({
      ...memoryCache,
      mockScores: [{ ...entry, id: uid() }, ...memoryCache.mockScores].slice(0, 200),
    })
  }, [])

  const removeMock = useCallback((id: string) => {
    persist({
      ...memoryCache,
      mockScores: memoryCache.mockScores.filter((e) => e.id !== id),
    })
  }, [])

  const addError = useCallback((entry: Omit<ErrorEntry, 'id'>) => {
    const nextRevision = { ...memoryCache.revision }
    // F3: error → bump or create SM-2 card for that topic
    if (entry.topicId) {
      const existing = nextRevision[entry.topicId]
      if (existing) {
        nextRevision[entry.topicId] = reviewCard(existing, 0, todayIso())
      } else {
        nextRevision[entry.topicId] = scheduleFirstReview(entry.topicId)
      }
    }
    persist({
      ...memoryCache,
      errorLog: [{ ...entry, id: uid() }, ...memoryCache.errorLog].slice(0, 300),
      revision: nextRevision,
    })
  }, [])

  const removeError = useCallback((id: string) => {
    persist({
      ...memoryCache,
      errorLog: memoryCache.errorLog.filter((e) => e.id !== id),
    })
  }, [])

  const reviewRevision = useCallback((topicId: string, quality: 0 | 1) => {
    const card = memoryCache.revision[topicId]
    if (!card) return
    persist({
      ...memoryCache,
      revision: {
        ...memoryCache.revision,
        [topicId]: reviewCard(card, quality, todayIso()),
      },
    })
  }, [])

  const setFocusExam = useCallback((examId: string | null) => {
    persist({
      ...memoryCache,
      focusExamId: examId,
      focusTopicId: null,
    })
  }, [])

  const setFocusTopic = useCallback((topicId: string | null) => {
    persist({ ...memoryCache, focusTopicId: topicId })
  }, [])

  const markCheckInDone = useCallback(() => {
    persist({ ...memoryCache, checkInDoneDate: todayIso() })
  }, [])

  const clearCheckIn = useCallback(() => {
    persist({ ...memoryCache, checkInDoneDate: null })
  }, [])

  const markDigestShown = useCallback(() => {
    persist({ ...memoryCache, lastDigestAt: todayIso() })
  }, [])

  const setRemindersEnabled = useCallback((value: boolean) => {
    persist({ ...memoryCache, remindersEnabled: value })
  }, [])

  const toggleDoc = useCallback((docId: string) => {
    const next = { ...memoryCache.docs, [docId]: !memoryCache.docs[docId] }
    if (!next[docId]) delete next[docId]
    persist({ ...memoryCache, docs: next })
  }, [])

  const addExamGroup = useCallback((name: string, examIds: string[]) => {
    const cleaned = normalizeExamGroups([
      {
        id: uid(),
        name,
        examIds,
        createdAt: new Date().toISOString(),
      },
    ])
    if (!cleaned.length) return null
    persist({
      ...memoryCache,
      examGroups: [cleaned[0], ...memoryCache.examGroups],
    })
    return cleaned[0]
  }, [])

  const updateExamGroup = useCallback(
    (id: string, patch: Partial<Pick<ExamGroup, 'name' | 'examIds'>>) => {
      const next = memoryCache.examGroups.map((g) => {
        if (g.id !== id) return g
        const merged = {
          ...g,
          name: patch.name !== undefined ? patch.name : g.name,
          examIds: patch.examIds !== undefined ? patch.examIds : g.examIds,
        }
        return normalizeExamGroups([merged])[0] ?? g
      })
      persist({ ...memoryCache, examGroups: next.filter(Boolean) })
    },
    [],
  )

  const removeExamGroup = useCallback((id: string) => {
    persist({
      ...memoryCache,
      examGroups: memoryCache.examGroups.filter((g) => g.id !== id),
    })
  }, [])

  const importState = useCallback((incoming: Partial<AppState>) => {
    persist({
      completed: incoming.completed ?? memoryCache.completed,
      starred: incoming.starred ?? memoryCache.starred,
      deprioritized: incoming.deprioritized ?? memoryCache.deprioritized,
      roadmapIgnored: incoming.roadmapIgnored ?? memoryCache.roadmapIgnored,
      studyLog: incoming.studyLog ?? memoryCache.studyLog,
      mockScores: incoming.mockScores ?? memoryCache.mockScores,
      errorLog: incoming.errorLog ?? memoryCache.errorLog,
      revision: incoming.revision ?? memoryCache.revision,
      mastery: incoming.mastery ?? memoryCache.mastery,
      focusExamId:
        incoming.focusExamId !== undefined
          ? incoming.focusExamId
          : memoryCache.focusExamId,
      focusTopicId:
        incoming.focusTopicId !== undefined
          ? incoming.focusTopicId
          : memoryCache.focusTopicId,
      checkInDoneDate:
        incoming.checkInDoneDate !== undefined
          ? incoming.checkInDoneDate
          : memoryCache.checkInDoneDate,
      lastDigestAt:
        incoming.lastDigestAt !== undefined
          ? incoming.lastDigestAt
          : memoryCache.lastDigestAt,
      remindersEnabled:
        incoming.remindersEnabled !== undefined
          ? incoming.remindersEnabled
          : memoryCache.remindersEnabled,
      docs: incoming.docs ?? memoryCache.docs,
      examGroups:
        incoming.examGroups !== undefined
          ? normalizeExamGroups(incoming.examGroups)
          : memoryCache.examGroups,
    })
  }, [])

  const exportState = useCallback(() => memoryCache, [])

  const resetAll = useCallback(() => {
    if (
      confirm(
        'Clear all progress, stars, deprioritized list, study log, mocks, errors and revision queue? This cannot be undone.',
      )
    ) {
      persist({ ...EMPTY })
      try {
        localStorage.removeItem(LEGACY_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const stats = useMemo(() => {
    const totalTopics = TOPICS.length
    const doneTopics = TOPICS.filter((t) => completed[t.id]).length
    const byExam = EXAMS.map((exam) => {
      const ids = examTopicIds(exam)
      const done = ids.filter((id) => completed[id]).length
      return {
        examId: exam.id,
        done,
        total: ids.length,
        pct: ids.length ? Math.round((done / ids.length) * 100) : 0,
      }
    })
    const today = todayIso()
    const minutesToday = studyLog
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + e.minutes, 0)
    return {
      totalTopics,
      doneTopics,
      pct: totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0,
      byExam,
      minutesToday,
      starredCount: starred.length,
      streak: studyStreak(studyLog),
      revisionsDue: dueRevisions(revision, today).length,
    }
  }, [completed, studyLog, starred, revision])

  const weakAreas = useMemo(() => {
    return TOPICS.map((topic) => {
      const shared = examsSharingTopic(topic.id)
      const done = !!completed[topic.id]
      return {
        topic,
        examCount: shared.length,
        done,
        exams: shared.map((e) => e.shortName),
      }
    })
      .filter((t) => !t.done && t.examCount >= 3)
      .sort((a, b) => b.examCount - a.examCount)
      .slice(0, 12)
  }, [completed])

  const revisionsDueList = useMemo(
    () => dueRevisions(revision, todayIso()),
    [revision],
  )

  return {
    completed,
    starred,
    deprioritized,
    roadmapIgnored,
    roadmapStarred,
    studyLog,
    mockScores,
    errorLog,
    revision,
    mastery,
    revisionsDueList,
    focusExamId,
    focusTopicId,
    checkInDoneDate,
    lastDigestAt,
    remindersEnabled,
    docs,
    examGroups,
    toggleTopic,
    setTopic,
    toggleSubtopic,
    setMastery,
    cycleMastery,
    isDone,
    isSubDone,
    toggleStar,
    isStarred,
    toggleDeprioritize,
    isDeprioritized,
    toggleRoadmapIgnore,
    isRoadmapIgnored,
    addStudy,
    removeStudy,
    addMock,
    removeMock,
    addError,
    removeError,
    reviewRevision,
    setFocusExam,
    setFocusTopic,
    markCheckInDone,
    clearCheckIn,
    markDigestShown,
    setRemindersEnabled,
    toggleDoc,
    addExamGroup,
    updateExamGroup,
    removeExamGroup,
    importState,
    exportState,
    resetAll,
    stats,
    weakAreas,
  }
}

/** Hydrate from storage on first client mount (SSR-safe). */
export function useProgressHydration() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    memoryCache = readStorage()
    emit()
    setReady(true)
  }, [])
  return ready
}
