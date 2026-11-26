import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TOPICS } from '../data/topics'
import type { TopicArea } from '../data/types'
import { useQuestionBank } from '../hooks/useQuestionBank'
import {
  PERCENTAGE_ANSWER_KEY,
  PERCENTAGE_CHAMPION_PACK,
  PERCENTAGE_PACK_ID,
  PERCENTAGE_PACK_TOPIC_ID,
  STEM_ONLY_IMAGE,
} from '../data/percentageChampionPack'
import {
  PROFIT_LOSS_CHAMPION_PACK,
  PROFIT_LOSS_PACK_ID,
  PROFIT_LOSS_PACK_TOPIC_ID,
} from '../data/profitLossChampionPack'
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
  const [searchParams] = useSearchParams()
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

  useEffect(() => {
    const fromQuery = searchParams.get('topic')
    if (!fromQuery) return
    if (TOPICS.some((t) => t.id === fromQuery)) {
      setTopicId(fromQuery)
      setTab('drill')
    }
  }, [searchParams])
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
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrLabel, setOcrLabel] = useState('')
  const [scanPreview, setScanPreview] = useState('')

  const openExamWindow = (attemptId: string) => {
    const url = new URL(window.location.href)
    url.hash = `#/practice/exam/${attemptId}`
    const win = window.open(
      url.toString(),
      `exampulse_drill_${attemptId}`,
      'noopener,noreferrer,width=1280,height=860',
    )
    if (!win) {
      // Popup blocked — fall back to same tab
      navigate(`/practice/exam/${attemptId}`)
    }
  }

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

  const onScanScreenshots = async (
    qFiles: FileList | null,
    sFiles: FileList | null,
  ) => {
    if (!qFiles?.length) {
      setMsg('Pick question screenshot(s) first.')
      return
    }
    if (!topicId) {
      setMsg('Pick a topic for this batch.')
      return
    }
    setOcrBusy(true)
    setOcrLabel('Starting OCR…')
    setMsg('')
    setScanPreview('')
    try {
      const { importMcqsFromScreenshots } = await import(
        '../utils/screenshotImport'
      )
      const { items, preview } = await importMcqsFromScreenshots({
        questionFiles: Array.from(qFiles),
        solutionFiles: sFiles ? Array.from(sFiles) : [],
        // Prefer Percentage key map for OCR on this shared topic (P&L uses seed button).
        answerKeyByNumber:
          topicId === PERCENTAGE_PACK_TOPIC_ID
            ? PERCENTAGE_ANSWER_KEY
            : undefined,
        onProgress: setOcrLabel,
      })
      setScanPreview(preview)
      if (!items.length) {
        setMsg(
          'No English MCQs found in those screenshots. Try clearer crops of the English column only.',
        )
        return
      }
      const created = await addQuestions(
        items.map((it) => ({
          topicId,
          imageDataUrl: it.imageDataUrl,
          answerKey: it.answerKey,
          stem: it.stem,
          options: it.options,
          explanation: it.explanation,
          solutionImageDataUrl: it.solutionImageDataUrl,
          source: 'ocr-screenshot' as const,
          prompt: `Q${it.number}`,
        })),
      )
      setMsg(
        `Scanned & saved ${created.length} English question${
          created.length === 1 ? '' : 's'
        } to ${selectedTopic?.title ?? 'topic'} (answers mapped from key when found; solutions optional).`,
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Screenshot scan failed')
    } finally {
      setOcrBusy(false)
      setOcrLabel('')
    }
  }

  const loadSeedPack = async (opts: {
    packId: string
    topicId: string
    promptPrefix: string
    items: Array<{
      number: number
      stem: string
      options: Partial<Record<AnswerKey, string>>
      answerKey: AnswerKey
      sourceTag?: string
    }>
    label: string
  }) => {
    const already = questions.filter(
      (q) =>
        q.topicId === opts.topicId &&
        (q.prompt?.startsWith(opts.promptPrefix) ||
          q.prompt?.includes(opts.packId)),
    )
    if (already.length >= opts.items.length) {
      setMsg(
        `${opts.label} already loaded (${already.length} questions). Delete them first to reload.`,
      )
      setTopicId(opts.topicId)
      return
    }
    setBusy(true)
    setMsg('')
    try {
      setTopicId(opts.topicId)
      const created = await addQuestions(
        opts.items.map((it) => ({
          topicId: opts.topicId,
          imageDataUrl: STEM_ONLY_IMAGE,
          answerKey: it.answerKey,
          stem: it.stem,
          options: it.options,
          source: 'seed' as const,
          prompt: `${opts.promptPrefix}${it.number} · ${opts.packId}${
            it.sourceTag ? ` · ${it.sourceTag}` : ''
          }`,
        })),
      )
      setTab('drill')
      setMsg(
        `Loaded ${created.length} ${opts.label} questions (answer keys only — no solutions) into Percentage, Profit & Loss.`,
      )
      setQCount(Math.min(25, created.length + already.length))
    } catch (e) {
      setMsg(
        e instanceof Error ? e.message : `Could not load ${opts.label} pack`,
      )
    } finally {
      setBusy(false)
    }
  }

  const onLoadPercentagePack = () =>
    void loadSeedPack({
      packId: PERCENTAGE_PACK_ID,
      topicId: PERCENTAGE_PACK_TOPIC_ID,
      promptPrefix: 'Pct Q',
      items: PERCENTAGE_CHAMPION_PACK,
      label: 'Percentage',
    })

  const onLoadProfitLossPack = () =>
    void loadSeedPack({
      packId: PROFIT_LOSS_PACK_ID,
      topicId: PROFIT_LOSS_PACK_TOPIC_ID,
      promptPrefix: 'P&L Q',
      items: PROFIT_LOSS_CHAMPION_PACK,
      label: 'Profit & Loss',
    })

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
      openExamWindow(attempt.id)
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
            Build a topic bank from photos or English screenshots (OCR maps
            questions + answer keys). Drills open in a separate exam window.
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
          <section className="practice-composer cardish" aria-label="Seed packs">
            <h2>SSC packs (keys only)</h2>
            <p className="lede">
              Load English MCQs with answer keys into{' '}
              <strong>Percentage, Profit &amp; Loss</strong>. Solutions skipped
              for now — drill scoring still works from the keys.
            </p>
            <div className="practice-seed-actions">
              <button
                type="button"
                className="btn primary"
                disabled={busy || ocrBusy}
                onClick={onLoadPercentagePack}
              >
                {busy ? 'Loading…' : 'Load Percentage (53 Qs)'}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={busy || ocrBusy}
                onClick={onLoadProfitLossPack}
              >
                {busy ? 'Loading…' : 'Load Profit & Loss (63 Qs)'}
              </button>
            </div>
          </section>

          <section className="practice-composer cardish" aria-label="Scan screenshots">
            <h2>Scan screenshots (English OCR)</h2>
            <p className="lede">
              Upload question screenshots. Answer-key / solution screenshots are
              optional — for Percentage topic we also apply the built-in Q1–53
              key map. English only; stems + options go to the bank.
            </p>
            <form
              className="practice-scan-form"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const qs = fd.getAll('qshots') as File[]
                const ss = fd.getAll('sshots') as File[]
                const qList = qs.filter((f) => f && f.size)
                const sList = ss.filter((f) => f && f.size)
                const qDt = new DataTransfer()
                qList.forEach((f) => qDt.items.add(f))
                const sDt = new DataTransfer()
                sList.forEach((f) => sDt.items.add(f))
                void onScanScreenshots(
                  qDt.files.length ? qDt.files : null,
                  sDt.files.length ? sDt.files : null,
                )
              }}
            >
              <label className="practice-file practice-file-bulk">
                Question screenshots
                <input
                  name="qshots"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={ocrBusy}
                />
              </label>
              <label className="practice-file practice-file-bulk">
                Answer key screenshot (optional — solutions not required)
                <input
                  name="sshots"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={ocrBusy}
                />
              </label>
              <button
                type="submit"
                className="btn primary"
                disabled={ocrBusy || !topicId}
              >
                {ocrBusy ? ocrLabel || 'Scanning…' : 'Scan & save to bank'}
              </button>
            </form>
            {scanPreview ? (
              <details className="practice-scan-preview">
                <summary>OCR text preview</summary>
                <pre>{scanPreview}</pre>
              </details>
            ) : null}
          </section>

          <section className="practice-composer cardish" aria-label="Insert questions">
            <h2>Or insert photos manually</h2>
            <p className="lede">
              Pick many photos at once for this topic. Set the correct option
              for each, then save the whole batch.
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
                {topicQuestions.map((q, i) => {
                  const hasPhoto =
                    Boolean(q.imageDataUrl) &&
                    !q.imageDataUrl.startsWith('data:image/gif')
                  return (
                    <li key={q.id} className="practice-q-card">
                      {hasPhoto ? (
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
                      ) : (
                        <div className="practice-q-thumb practice-q-thumb-text">
                          <span>#{i + 1}</span>
                          <em>{q.stem?.slice(0, 48) || 'Text'}</em>
                        </div>
                      )}
                      <div>
                        <p>
                          Answer <strong>{q.answerKey}</strong>
                          {q.prompt ? ` · ${q.prompt}` : ''}
                        </p>
                        {q.stem ? (
                          <p className="practice-q-stem-preview">
                            {q.stem.slice(0, 140)}
                            {q.stem.length > 140 ? '…' : ''}
                          </p>
                        ) : null}
                        <p className="practice-q-meta">
                          Added {new Date(q.createdAt).toLocaleString()}
                        </p>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            if (
                              confirm('Delete this question from the bank?')
                            ) {
                              void removeQuestion(q.id)
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  )
                })}
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
                        onClick={() => openExamWindow(a.id)}
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
