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
import { studyStreak } from '../utils/readiness'
import type { SectionKey } from '../utils/prepAnalytics'

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
  studyLog: StudyEntry[]
  mockScores: MockScore[]
  errorLog: ErrorEntry[]
  /** topicId → spaced revision card */
  revision: Record<string, RevisionCard>
  focusExamId: string | null
  remindersEnabled: boolean
  /** Application / document prep checklist */
  docs: Record<string, boolean>
}

const EMPTY: AppState = {
  completed: {},
  starred: [],
  deprioritized: [],
  studyLog: [],
  mockScores: [],
  errorLog: [],
  revision: {},
  focusExamId: null,
  remindersEnabled: false,
  docs: {},
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
      studyLog: Array.isArray(parsed.studyLog) ? parsed.studyLog : [],
      mockScores: Array.isArray(parsed.mockScores) ? parsed.mockScores : [],
      errorLog: Array.isArray(parsed.errorLog) ? parsed.errorLog : [],
      revision: asRevisionMap(parsed.revision),
      focusExamId: parsed.focusExamId ?? null,
      remindersEnabled: !!parsed.remindersEnabled,
      docs: parsed.docs && typeof parsed.docs === 'object' ? parsed.docs : {},
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
    studyLog,
    mockScores,
    errorLog,
    revision,
    focusExamId,
    remindersEnabled,
    docs,
  } = state

  const toggleTopic = useCallback((topicId: string) => {
    const nextCompleted = { ...memoryCache.completed, [topicId]: !memoryCache.completed[topicId] }
    const nowDone = !!nextCompleted[topicId]
    if (!nowDone) delete nextCompleted[topicId]
    persist({
      ...memoryCache,
      completed: nextCompleted,
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
    persist({
      ...memoryCache,
      completed: nextCompleted,
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

      persist({
        ...memoryCache,
        completed: nextCompleted,
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
    if (stars.has(examId)) {
      stars.delete(examId)
    } else {
      stars.add(examId)
      sunk.delete(examId)
    }
    persist({
      ...memoryCache,
      starred: [...stars],
      deprioritized: [...sunk],
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
    persist({
      ...memoryCache,
      errorLog: [{ ...entry, id: uid() }, ...memoryCache.errorLog].slice(0, 300),
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
    persist({ ...memoryCache, focusExamId: examId })
  }, [])

  const setRemindersEnabled = useCallback((value: boolean) => {
    persist({ ...memoryCache, remindersEnabled: value })
  }, [])

  const toggleDoc = useCallback((docId: string) => {
    const next = { ...memoryCache.docs, [docId]: !memoryCache.docs[docId] }
    if (!next[docId]) delete next[docId]
    persist({ ...memoryCache, docs: next })
  }, [])

  const importState = useCallback((incoming: Partial<AppState>) => {
    persist({
      completed: incoming.completed ?? memoryCache.completed,
      starred: incoming.starred ?? memoryCache.starred,
      deprioritized: incoming.deprioritized ?? memoryCache.deprioritized,
      studyLog: incoming.studyLog ?? memoryCache.studyLog,
      mockScores: incoming.mockScores ?? memoryCache.mockScores,
      errorLog: incoming.errorLog ?? memoryCache.errorLog,
      revision: incoming.revision ?? memoryCache.revision,
      focusExamId:
        incoming.focusExamId !== undefined
          ? incoming.focusExamId
          : memoryCache.focusExamId,
      remindersEnabled:
        incoming.remindersEnabled !== undefined
          ? incoming.remindersEnabled
          : memoryCache.remindersEnabled,
      docs: incoming.docs ?? memoryCache.docs,
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
    studyLog,
    mockScores,
    errorLog,
    revision,
    revisionsDueList,
    focusExamId,
    remindersEnabled,
    docs,
    toggleTopic,
    setTopic,
    toggleSubtopic,
    isDone,
    isSubDone,
    toggleStar,
    isStarred,
    toggleDeprioritize,
    isDeprioritized,
    addStudy,
    removeStudy,
    addMock,
    removeMock,
    addError,
    removeError,
    reviewRevision,
    setFocusExam,
    setRemindersEnabled,
    toggleDoc,
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
