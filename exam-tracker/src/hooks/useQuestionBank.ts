import { useCallback, useEffect, useMemo, useState } from 'react'
import { TOPICS } from '../data/topics'
import {
  DEFAULT_PRACTICE_CONFIG,
  emptyAttemptState,
  newId,
  pickQuestions,
  type AnswerKey,
  type BankQuestion,
  type PracticeAttempt,
  type PracticeConfig,
} from '../utils/questionBank'
import {
  deleteAttempt,
  deleteQuestion,
  getAttempt,
  getQuestionsByIds,
  listAttempts,
  listQuestions,
  putAttempt,
  putQuestion,
} from '../utils/questionBankDb'

type AddInput = {
  topicId: string
  imageDataUrl: string
  answerKey: AnswerKey
  prompt?: string
  explanation?: string
  solutionImageDataUrl?: string
  difficulty?: BankQuestion['difficulty']
}

export function useQuestionBank() {
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const [qs, as] = await Promise.all([listQuestions(), listAttempts()])
    setQuestions(qs)
    setAttempts(as)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await refresh()
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load question bank')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const countsByTopic = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of questions) {
      map.set(q.topicId, (map.get(q.topicId) ?? 0) + 1)
    }
    return map
  }, [questions])

  const addQuestion = useCallback(async (input: AddInput) => {
    const now = new Date().toISOString()
    const q: BankQuestion = {
      id: newId('q'),
      topicId: input.topicId,
      imageDataUrl: input.imageDataUrl,
      answerKey: input.answerKey,
      prompt: input.prompt?.trim() || undefined,
      explanation: input.explanation?.trim() || undefined,
      solutionImageDataUrl: input.solutionImageDataUrl,
      difficulty: input.difficulty,
      createdAt: now,
      updatedAt: now,
    }
    await putQuestion(q)
    setQuestions((prev) => [q, ...prev])
    return q
  }, [])

  const removeQuestion = useCallback(async (id: string) => {
    await deleteQuestion(id)
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }, [])

  const startAttempt = useCallback(
    async (topicId: string, configPartial?: Partial<PracticeConfig>) => {
      const config: PracticeConfig = {
        ...DEFAULT_PRACTICE_CONFIG,
        ...configPartial,
      }
      const pool = questions.filter((q) => q.topicId === topicId)
      if (!pool.length) throw new Error('No questions in this topic yet')
      const picked = pickQuestions(pool, config.questionCount, config.shuffle)
      if (!picked.length) throw new Error('Could not pick questions')
      const started = new Date()
      const ends = new Date(started.getTime() + config.durationSec * 1000)
      const answers: PracticeAttempt['answers'] = {}
      for (const q of picked) answers[q.id] = emptyAttemptState()
      const topic = TOPICS.find((t) => t.id === topicId)
      const attempt: PracticeAttempt = {
        id: newId('att'),
        topicId,
        topicTitle: topic?.title ?? topicId,
        config: {
          ...config,
          questionCount: picked.length,
        },
        questionIds: picked.map((q) => q.id),
        answers,
        startedAt: started.toISOString(),
        endsAt: ends.toISOString(),
        status: 'in_progress',
      }
      await putAttempt(attempt)
      setAttempts((prev) => [attempt, ...prev])
      return attempt
    },
    [questions],
  )

  const saveAttempt = useCallback(async (attempt: PracticeAttempt) => {
    await putAttempt(attempt)
    setAttempts((prev) => {
      const i = prev.findIndex((a) => a.id === attempt.id)
      if (i < 0) return [attempt, ...prev]
      const next = [...prev]
      next[i] = attempt
      return next
    })
  }, [])

  const loadAttemptBundle = useCallback(async (attemptId: string) => {
    const attempt = await getAttempt(attemptId)
    if (!attempt) return null
    const qs = await getQuestionsByIds(attempt.questionIds)
    return { attempt, questions: qs }
  }, [])

  const removeAttempt = useCallback(async (id: string) => {
    await deleteAttempt(id)
    setAttempts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return {
    ready,
    error,
    questions,
    attempts,
    countsByTopic,
    addQuestion,
    removeQuestion,
    startAttempt,
    saveAttempt,
    loadAttemptBundle,
    removeAttempt,
    refresh,
  }
}
