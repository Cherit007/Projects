import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { EXAMS, examTopicIds } from '../data/exams'
import { TOPICS } from '../data/topics'

const STORAGE_KEY = 'exam-prep-progress-v1'

type ProgressMap = Record<string, boolean>

function readStorage(): ProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ProgressMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

let memoryCache: ProgressMap = typeof localStorage !== 'undefined' ? readStorage() : {}
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ProgressMap {
  return memoryCache
}

function persist(next: ProgressMap) {
  memoryCache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
  emit()
}

export function useProgress() {
  const completed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): ProgressMap => ({}),
  )

  const toggleTopic = useCallback((topicId: string) => {
    const next = { ...memoryCache, [topicId]: !memoryCache[topicId] }
    if (!next[topicId]) delete next[topicId]
    persist(next)
  }, [])

  const setTopic = useCallback((topicId: string, value: boolean) => {
    const next = { ...memoryCache }
    if (value) next[topicId] = true
    else delete next[topicId]
    persist(next)
  }, [])

  const toggleSubtopic = useCallback(
    (topicId: string, subIndex: number, total: number) => {
      const key = `${topicId}::${subIndex}`
      const next = { ...memoryCache, [key]: !memoryCache[key] }
      if (!next[key]) delete next[key]

      // Auto-complete parent topic when all subtopics done
      let allDone = true
      for (let i = 0; i < total; i++) {
        const k = `${topicId}::${i}`
        const val = i === subIndex ? !!next[key] : !!next[k]
        if (!val) {
          allDone = false
          break
        }
      }
      if (allDone) next[topicId] = true
      else delete next[topicId]

      persist(next)
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

  const resetAll = useCallback(() => {
    if (confirm('Clear all progress? This cannot be undone.')) {
      persist({})
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
    return {
      totalTopics,
      doneTopics,
      pct: totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0,
      byExam,
    }
  }, [completed])

  return {
    completed,
    toggleTopic,
    setTopic,
    toggleSubtopic,
    isDone,
    isSubDone,
    resetAll,
    stats,
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
