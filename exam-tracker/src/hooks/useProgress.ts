import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { EXAMS, examTopicIds, examsSharingTopic } from '../data/exams'
import { TOPICS } from '../data/topics'
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

export type MockScore = {
  id: string
  examId: string
  source: string
  score: number
  maxScore: number
  date: string
  note: string
}

export type AppState = {
  completed: Record<string, boolean>
  starred: string[]
  studyLog: StudyEntry[]
  mockScores: MockScore[]
  focusExamId: string | null
  remindersEnabled: boolean
  /** Application / document prep checklist */
  docs: Record<string, boolean>
}

const EMPTY: AppState = {
  completed: {},
  starred: [],
  studyLog: [],
  mockScores: [],
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
      studyLog: Array.isArray(parsed.studyLog) ? parsed.studyLog : [],
      mockScores: Array.isArray(parsed.mockScores) ? parsed.mockScores : [],
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
  emit()
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function useProgress() {
  const state = useSyncExternalStore(subscribe, getSnapshot, (): AppState => ({
    ...EMPTY,
  }))
  const {
    completed,
    starred,
    studyLog,
    mockScores,
    focusExamId,
    remindersEnabled,
    docs,
  } = state

  const toggleTopic = useCallback((topicId: string) => {
    const nextCompleted = { ...memoryCache.completed, [topicId]: !memoryCache.completed[topicId] }
    if (!nextCompleted[topicId]) delete nextCompleted[topicId]
    persist({ ...memoryCache, completed: nextCompleted })
  }, [])

  const setTopic = useCallback((topicId: string, value: boolean) => {
    const nextCompleted = { ...memoryCache.completed }
    if (value) nextCompleted[topicId] = true
    else delete nextCompleted[topicId]
    persist({ ...memoryCache, completed: nextCompleted })
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

      persist({ ...memoryCache, completed: nextCompleted })
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
    const set = new Set(memoryCache.starred)
    if (set.has(examId)) set.delete(examId)
    else set.add(examId)
    persist({ ...memoryCache, starred: [...set] })
  }, [])

  const isStarred = useCallback(
    (examId: string) => starred.includes(examId),
    [starred],
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
      studyLog: incoming.studyLog ?? memoryCache.studyLog,
      mockScores: incoming.mockScores ?? memoryCache.mockScores,
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
    if (confirm('Clear all progress, stars, study log and mocks? This cannot be undone.')) {
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
    const today = new Date().toISOString().slice(0, 10)
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
    }
  }, [completed, studyLog, starred])

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

  return {
    completed,
    starred,
    studyLog,
    mockScores,
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
    addStudy,
    removeStudy,
    addMock,
    removeMock,
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
