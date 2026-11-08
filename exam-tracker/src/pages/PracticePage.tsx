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
  newId,
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

type Tab = 'bank' | 'drill'

type DraftItem = {
  localId: string
  imageDataUrl: string
  answerKey: AnswerKey
  prompt: string
  explanation: string
  solutionImageDataUrl?: string
}

export function PracticePage() {
  const navigate = useNavigate()
  const {
    ready,
    error,
    questions,
    attempts,
    countsByTopic,
    addQuestions,
    removeQuestion,
    startAttempt,
    removeAttempt,
  } = useQuestionBank()

  const [tab, setTab] = useState<Tab>('bank')
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
  const [uploading, setUploading] = useState(false)
  const [drafts, setDrafts] = useState<DraftItem[]>([])

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

  const onPickBulk = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setMsg('')
    try {
      const next: DraftItem[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const imageDataUrl = await compressQuestionImage(file)
        next.push({
          localId: newId('draft'),
          imageDataUrl,
          answerKey: 'A',
          prompt: '',
          explanation: '',
        })
      }
      if (!next.length) {
        setMsg('No image files found in that selection.')
        return
      }
      setDrafts((prev) => [...prev, ...next])
      setMsg(
        `${next.length} photo${next.length === 1 ? '' : 's'} ready — set each answer, then save all to the bank.`,
      )
    } catch {
      setMsg('Could not read one or more photos — try again.')
    } finally {
      setUploading(false)
    }
  }

  const updateDraft = (localId: string, patch: Partial<DraftItem>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)),
    )
  }

  const onPickSolution = async (localId: string, file: File | null) => {
    if (!file) return
    try {
      const solutionImageDataUrl = await compressQuestionImage(file)
      updateDraft(localId, { solutionImageDataUrl })
    } catch {
      setMsg('Could not read that solution photo.')
    }
  }

  const onSaveAll = async () => {
    if (!drafts.length) {
      setMsg('Insert question photos first.')
      return
    }
    if (!topicId) {
      setMsg('Pick a topic for this batch.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const created = await addQuestions(
        drafts.map((d) => ({
          topicId,
          imageDataUrl: d.imageDataUrl,
          answerKey: d.answerKey,
          prompt: d.prompt,
          explanation: d.explanation,
          solutionImageDataUrl: d.solutionImageDataUrl,
        })),
      )
      setDrafts([])
      setMsg(
        `Saved ${created.length} question${created.length === 1 ? '' : 's'} to ${selectedTopic?.title ?? 'topic'}. Take drills anytime from the Drill tab.`,
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const onStart = async () => {
    if (available <= 0) {
      setMsg('This topic bank is empty — insert questions in the Bank tab first.')
      setTab('bank')
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
            First insert all question photos into a topic bank. Later, start a
            timed drill from that bank — nothing is added during the test.
          </p>
        </div>
      </header>

      <div className="yt-mode-toggle practice-tabs" role="tablist" aria-label="Practice mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'bank'}
          className={tab === 'bank' ? 'active' : ''}
          onClick={() => setTab('bank')}
        >
          Build bank
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'drill'}
          className={tab === 'drill' ? 'active' : ''}
          onClick={() => setTab('drill')}
        >
          Take drill
        </button>
      </div>

      {error && <p className="practice-banner error">{error}</p>}
      {msg && <p className="practice-banner">{msg}</p>}

      <section className="practice-setup cardish" aria-label="Topic">
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
        <p className="practice-topic-summary">
          <strong>{selectedTopic?.title ?? 'Topic'}</strong> · {available}{' '}
          question{available === 1 ? '' : 's'} already in bank
          {drafts.length > 0 ? ` · ${drafts.length} waiting to save` : ''}
        </p>
      </section>

      {tab === 'bank' ? (
        <>
          <section className="practice-composer cardish" aria-label="Insert questions">
            <h2>Insert questions (batch)</h2>
            <p className="lede">
              Pick many photos at once for this topic. Set the correct option
              for each, then save the whole batch. Do this before you start any
              drill.
            </p>
            <label className="practice-file practice-file-bulk">
              Choose question photos
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploading || busy}
                onChange={(e) => {
                  void onPickBulk(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>

            {drafts.length > 0 && (
              <>
                <ul className="practice-draft-list">
                  {drafts.map((d, i) => (
                    <li key={d.localId} className="practice-draft-card">
                      <div className="practice-draft-thumb">
                        <img src={d.imageDataUrl} alt={`Draft ${i + 1}`} />
                        <span>#{i + 1}</span>
                      </div>
                      <div className="practice-draft-fields">
                        <label>
                          Correct answer
                          <select
                            value={d.answerKey}
                            onChange={(e) =>
                              updateDraft(d.localId, {
                                answerKey: e.target.value as AnswerKey,
                              })
                            }
                          >
                            {ANSWER_KEYS.map((k) => (
                              <option key={k} value={k}>
                                Option {k}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Note (optional)
                          <input
                            type="text"
                            value={d.prompt}
                            maxLength={160}
                            placeholder="e.g. mock 3 · Q12"
                            onChange={(e) =>
                              updateDraft(d.localId, { prompt: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Explanation (optional)
                          <input
                            type="text"
                            value={d.explanation}
                            maxLength={400}
                            placeholder="Short reason / key point"
                            onChange={(e) =>
                              updateDraft(d.localId, {
                                explanation: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="practice-file">
                          Solution photo (optional)
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              void onPickSolution(
                                d.localId,
                                e.target.files?.[0] ?? null,
                              )
                              e.target.value = ''
                            }}
                          />
                        </label>
                        {d.solutionImageDataUrl && (
                          <p className="practice-q-meta">Solution photo attached</p>
                        )}
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            setDrafts((prev) =>
                              prev.filter((x) => x.localId !== d.localId),
                            )
                          }
                        >
                          Remove from batch
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="practice-composer-actions">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy || uploading}
                    onClick={() => void onSaveAll()}
                  >
                    {busy
                      ? 'Saving…'
                      : `Save all ${drafts.length} to ${selectedTopic?.title ?? 'bank'}`}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy}
                    onClick={() => setDrafts([])}
                  >
                    Clear batch
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="practice-bank" aria-label="Questions in topic">
            <header className="section-head">
              <h2>
                Saved bank · {topicQuestions.length} question
                {topicQuestions.length === 1 ? '' : 's'}
              </h2>
            </header>
            {topicQuestions.length === 0 ? (
              <p className="lede">
                Empty for this topic. Insert a batch of photos above.
              </p>
            ) : (
              <ul className="practice-q-list">
                {topicQuestions.map((q, i) => (
                  <li key={q.id} className="practice-q-card">
                    <button
                      type="button"
                      className="practice-q-thumb"
                      onClick={() =>
                        window.open(
                          q.imageDataUrl,
                          '_blank',
                          'noopener,noreferrer',
                        )
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
        </>
      ) : (
        <>
          <section className="practice-setup cardish" aria-label="Drill config">
            <h2>Start from bank</h2>
            <p className="lede">
              Uses questions already saved for this topic. No uploading during
              the exam.
            </p>
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
                Will use {Math.min(qCount, available)} of {available} ·{' '}
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
            {available === 0 && (
              <p className="practice-banner" style={{ marginTop: '0.85rem' }}>
                Bank is empty for this topic.{' '}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setTab('bank')}
                >
                  Go insert questions
                </button>
              </p>
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
                        {a.status === 'submitted' ? 'Submitted' : 'In progress'}{' '}
                        ·{' '}
                        {new Date(
                          a.submittedAt ?? a.startedAt,
                        ).toLocaleString()}
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
        </>
      )}
    </div>
  )
}
