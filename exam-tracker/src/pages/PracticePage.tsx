import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TOPICS } from '../data/topics'
import type { TopicArea } from '../data/types'
import { useQuestionBank } from '../hooks/useQuestionBank'
import {
  ANSWER_KEYS,
  DEFAULT_PRACTICE_CONFIG,
  compressQuestionImage,
  formatClock,
  type AnswerKey,
} from '../utils/questionBank'

const AREA_LABEL: Record<TopicArea, string> = {
  quant: 'Quant',
  reasoning: 'Reasoning',
  english: 'English',
  ga: 'GA',
  banking: 'Banking',
  esi: 'ESI',
  fm: 'FM',
  ard: 'ARD',
  computer: 'Computer',
  'gate-cs': 'GATE CS',
  'desc-eng': 'Desc. Eng',
  interview: 'Interview',
}

export function PracticePage() {
  const navigate = useNavigate()
  const {
    ready,
    error,
    questions,
    attempts,
    countsByTopic,
    addQuestion,
    removeQuestion,
    startAttempt,
    removeAttempt,
  } = useQuestionBank()

  const [topicId, setTopicId] = useState(TOPICS[0]?.id ?? '')
  const [areaFilter, setAreaFilter] = useState<TopicArea | 'all'>('all')
  const [qCount, setQCount] = useState(DEFAULT_PRACTICE_CONFIG.questionCount)
  const [mins, setMins] = useState(
    Math.round(DEFAULT_PRACTICE_CONFIG.durationSec / 60),
  )
  const [marksCorrect, setMarksCorrect] = useState(
    DEFAULT_PRACTICE_CONFIG.marksCorrect,
  )
  const [marksWrong, setMarksWrong] = useState(
    DEFAULT_PRACTICE_CONFIG.marksWrong,
  )
  const [shuffle, setShuffle] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // Composer
  const [composerOpen, setComposerOpen] = useState(false)
  const [answerKey, setAnswerKey] = useState<AnswerKey>('A')
  const [prompt, setPrompt] = useState('')
  const [explanation, setExplanation] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [solutionPreview, setSolutionPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const topicsFiltered = useMemo(() => {
    return TOPICS.filter((t) => areaFilter === 'all' || t.area === areaFilter)
  }, [areaFilter])

  const topicQuestions = useMemo(
    () => questions.filter((q) => q.topicId === topicId),
    [questions, topicId],
  )

  const topicAttempts = useMemo(
    () => attempts.filter((a) => a.topicId === topicId).slice(0, 12),
    [attempts, topicId],
  )

  const selectedTopic = TOPICS.find((t) => t.id === topicId)
  const available = countsByTopic.get(topicId) ?? 0

  const onPickImage = async (
    file: File | null,
    kind: 'question' | 'solution',
  ) => {
    if (!file) return
    setUploading(true)
    setMsg('')
    try {
      const dataUrl = await compressQuestionImage(file)
      if (kind === 'question') setImagePreview(dataUrl)
      else setSolutionPreview(dataUrl)
    } catch {
      setMsg('Could not read that photo — try another image.')
    } finally {
      setUploading(false)
    }
  }

  const onAdd = async () => {
    if (!imagePreview) {
      setMsg('Add a question photo first.')
      return
    }
    if (!topicId) {
      setMsg('Pick a topic.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await addQuestion({
        topicId,
        imageDataUrl: imagePreview,
        answerKey,
        prompt,
        explanation,
        solutionImageDataUrl: solutionPreview ?? undefined,
      })
      setImagePreview(null)
      setSolutionPreview(null)
      setPrompt('')
      setExplanation('')
      setAnswerKey('A')
      setMsg('Question saved to this topic bank.')
      setComposerOpen(false)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const onStart = async () => {
    if (available <= 0) {
      setMsg('Add questions to this topic before starting a drill.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const attempt = await startAttempt(topicId, {
        questionCount: qCount,
        durationSec: Math.max(1, mins) * 60,
        marksCorrect,
        marksWrong,
        shuffle,
      })
      navigate(`/practice/exam/${attempt.id}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not start')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="practice-page">
        <p className="lede">Loading question bank…</p>
      </div>
    )
  }

  return (
    <div className="practice-page">
      <header className="section-head yt-page-head">
        <div>
          <h1>Practice bank</h1>
          <p className="lede">
            Upload question photos topic-wise, run timed drills (e.g. 15 Q /
            20 min), and review with per-question timing — Testbook-style.
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setComposerOpen((o) => !o)}
        >
          {composerOpen ? 'Close' : 'Add question'}
        </button>
      </header>

      {error && <p className="practice-banner error">{error}</p>}
      {msg && <p className="practice-banner">{msg}</p>}

      <section className="practice-setup cardish" aria-label="Topic & config">
        <div className="practice-setup-grid">
          <label>
            Area
            <select
              value={areaFilter}
              onChange={(e) =>
                setAreaFilter(e.target.value as TopicArea | 'all')
              }
            >
              <option value="all">All areas</option>
              {(Object.keys(AREA_LABEL) as TopicArea[]).map((a) => (
                <option key={a} value={a}>
                  {AREA_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="practice-topic-pick">
            Topic
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
              {topicsFiltered.map((t) => (
                <option key={t.id} value={t.id}>
                  {AREA_LABEL[t.area]} · {t.title} (
                  {countsByTopic.get(t.id) ?? 0})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="practice-config-row">
          <label>
            Questions
            <input
              type="number"
              min={1}
              max={100}
              value={qCount}
              onChange={(e) => setQCount(Number(e.target.value) || 1)}
            />
          </label>
          <label>
            Minutes
            <input
              type="number"
              min={1}
              max={300}
              value={mins}
              onChange={(e) => setMins(Number(e.target.value) || 1)}
            />
          </label>
          <label>
            + marks
            <input
              type="number"
              min={0}
              step={0.25}
              value={marksCorrect}
              onChange={(e) => setMarksCorrect(Number(e.target.value) || 0)}
            />
          </label>
          <label>
            − marks
            <input
              type="number"
              min={0}
              step={0.25}
              value={marksWrong}
              onChange={(e) => setMarksWrong(Number(e.target.value) || 0)}
            />
          </label>
          <label className="practice-check">
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => setShuffle(e.target.checked)}
            />
            Shuffle
          </label>
        </div>

        <div className="practice-start-row">
          <p>
            <strong>{selectedTopic?.title ?? 'Topic'}</strong> · {available} in
            bank · will use {Math.min(qCount, available)} Q ·{' '}
            {formatClock(mins * 60, 'sec')}
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={busy || available === 0}
            onClick={() => void onStart()}
          >
            Start timed drill
          </button>
        </div>
      </section>

      {composerOpen && (
        <section className="practice-composer cardish" aria-label="Add question">
          <h2>Add to {selectedTopic?.title ?? 'topic'}</h2>
          <p className="lede">
            Photo of the question + correct option. Optional solution photo /
            notes for review.
          </p>
          <div className="practice-composer-grid">
            <label className="practice-file">
              Question photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={uploading}
                onChange={(e) =>
                  void onPickImage(e.target.files?.[0] ?? null, 'question')
                }
              />
            </label>
            <label className="practice-file">
              Solution photo (optional)
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={uploading}
                onChange={(e) =>
                  void onPickImage(e.target.files?.[0] ?? null, 'solution')
                }
              />
            </label>
            <label>
              Correct answer
              <select
                value={answerKey}
                onChange={(e) => setAnswerKey(e.target.value as AnswerKey)}
              >
                {ANSWER_KEYS.map((k) => (
                  <option key={k} value={k}>
                    Option {k}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Short note (optional)
              <input
                type="text"
                value={prompt}
                maxLength={160}
                placeholder="e.g. Q from mock 12"
                onChange={(e) => setPrompt(e.target.value)}
              />
            </label>
            <label className="practice-span">
              Explanation (optional)
              <textarea
                rows={3}
                value={explanation}
                maxLength={800}
                placeholder="Why this option is correct…"
                onChange={(e) => setExplanation(e.target.value)}
              />
            </label>
          </div>
          <div className="practice-previews">
            {imagePreview && (
              <figure>
                <figcaption>Question</figcaption>
                <img src={imagePreview} alt="Question preview" />
              </figure>
            )}
            {solutionPreview && (
              <figure>
                <figcaption>Solution</figcaption>
                <img src={solutionPreview} alt="Solution preview" />
              </figure>
            )}
          </div>
          <div className="practice-composer-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy || uploading || !imagePreview}
              onClick={() => void onAdd()}
            >
              {busy ? 'Saving…' : 'Save to bank'}
            </button>
          </div>
        </section>
      )}

      <section className="practice-bank" aria-label="Questions in topic">
        <header className="section-head">
          <h2>
            Bank · {topicQuestions.length} question
            {topicQuestions.length === 1 ? '' : 's'}
          </h2>
        </header>
        {topicQuestions.length === 0 ? (
          <p className="lede">No questions yet — add photos for this topic.</p>
        ) : (
          <ul className="practice-q-list">
            {topicQuestions.map((q, i) => (
              <li key={q.id} className="practice-q-card">
                <button
                  type="button"
                  className="practice-q-thumb"
                  onClick={() =>
                    window.open(q.imageDataUrl, '_blank', 'noopener,noreferrer')
                  }
                >
                  <img src={q.imageDataUrl} alt="" />
                  <span>#{i + 1}</span>
                </button>
                <div>
                  <p>
                    Answer <strong>{q.answerKey}</strong>
                    {q.prompt ? ` · ${q.prompt}` : ''}
                  </p>
                  <p className="practice-q-meta">
                    Added {new Date(q.createdAt).toLocaleString()}
                  </p>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      if (confirm('Delete this question from the bank?')) {
                        void removeQuestion(q.id)
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="practice-history" aria-label="Recent attempts">
        <header className="section-head">
          <h2>Recent drills</h2>
        </header>
        {topicAttempts.length === 0 ? (
          <p className="lede">No attempts for this topic yet.</p>
        ) : (
          <ul className="practice-attempt-list">
            {topicAttempts.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>
                    {a.config.questionCount} Q ·{' '}
                    {formatClock(a.config.durationSec, 'sec')}
                  </strong>
                  <span>
                    {a.status === 'submitted' ? 'Submitted' : 'In progress'} ·{' '}
                    {new Date(a.submittedAt ?? a.startedAt).toLocaleString()}
                  </span>
                </div>
                <div className="practice-attempt-actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => navigate(`/practice/exam/${a.id}`)}
                  >
                    {a.status === 'submitted' ? 'Review' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      if (confirm('Delete this attempt?')) {
                        void removeAttempt(a.id)
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
