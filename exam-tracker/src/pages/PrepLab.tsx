import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { NextMoves } from '../components/NextMoves'
import { DOC_ITEMS } from '../data/docsChecklist'
import { upcomingDeadlines, daysUntil } from '../data/deadlines'
import { EXAMS } from '../data/exams'
import { TOPICS } from '../data/topics'
import { useProgress } from '../hooks/useProgress'
import { isFirebaseConfigured } from '../lib/firebase'
import {
  SECTION_LABELS,
  mockTrend,
  sectionAverages,
  topErrorTopics,
  type SectionKey,
} from '../utils/prepAnalytics'
import {
  downloadDeadlinesIcs,
  downloadJson,
  notifyUpcoming,
  requestReminderPermission,
} from '../utils/export'

const SECTION_KEYS: SectionKey[] = ['quant', 'reasoning', 'english', 'ga', 'itPk']

function parseOptionalPct(raw: string): number | undefined {
  const t = raw.trim()
  if (!t) return undefined
  const n = Number(t)
  if (Number.isNaN(n)) return undefined
  return Math.min(100, Math.max(0, n))
}

export function PrepLab() {
  const {
    studyLog,
    mockScores,
    errorLog,
    revisionsDueList,
    addStudy,
    removeStudy,
    addMock,
    removeMock,
    addError,
    removeError,
    reviewRevision,
    exportState,
    importState,
    remindersEnabled,
    setRemindersEnabled,
    docs,
    toggleDoc,
    stats,
  } = useProgress()
  const { user, syncing, signInWithGoogle, signOutUser, error: authError } = useAuth()

  const docsDone = DOC_ITEMS.filter((d) => docs[d.id]).length

  const [minutes, setMinutes] = useState(60)
  const [note, setNote] = useState('')
  const [studyExam, setStudyExam] = useState('')
  const [mockExam, setMockExam] = useState('ibpsso')
  const [source, setSource] = useState('Oliveboard')
  const [score, setScore] = useState(40)
  const [maxScore, setMaxScore] = useState(100)
  const [mockNote, setMockNote] = useState('')
  const [stage, setStage] = useState<'prelims' | 'mains' | 'sectional' | 'other'>(
    'prelims',
  )
  const [percentile, setPercentile] = useState('')
  const [secInputs, setSecInputs] = useState<Record<SectionKey, string>>({
    quant: '',
    reasoning: '',
    english: '',
    ga: '',
    itPk: '',
  })

  const [errExam, setErrExam] = useState('ibpsso')
  const [errTopicId, setErrTopicId] = useState('')
  const [errLabel, setErrLabel] = useState('')
  const [errType, setErrType] = useState<'concept' | 'silly' | 'time'>('concept')
  const [errSection, setErrSection] = useState<SectionKey | 'other'>('quant')
  const [errNote, setErrNote] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const weekMinutes = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000
    return studyLog
      .filter((e) => new Date(e.date).getTime() >= weekAgo)
      .reduce((s, e) => s + e.minutes, 0)
  }, [studyLog])

  const trend = useMemo(() => mockTrend(mockScores, undefined, 8), [mockScores])
  const secAvgs = useMemo(() => sectionAverages(mockScores, 6), [mockScores])
  const errStats = useMemo(() => topErrorTopics(errorLog, 6), [errorLog])
  const maxTrend = Math.max(100, ...trend.map((t) => t.pct))

  const topicOptions = useMemo(
    () =>
      TOPICS.filter((t) =>
        ['quant', 'reasoning', 'english', 'ga', 'banking', 'computer'].includes(
          t.area,
        ),
      ),
    [],
  )

  return (
    <div className="prep-lab">
      <header className="section-head stack">
        <div>
          <h1>Prep lab</h1>
          <p className="lede">
            Log Oliveboard mocks with sections, trap mistakes, and revise on a
            spaced schedule — today <strong>{stats.minutesToday} min</strong> ·
            week <strong>{weekMinutes} min</strong>
            {stats.revisionsDue > 0
              ? ` · ${stats.revisionsDue} revision${stats.revisionsDue === 1 ? '' : 's'} due`
              : ''}
          </p>
        </div>
      </header>

      <NextMoves />

      <div className="prep-grid">
        <section className="prep-panel" id="mock-tracker">
          <h2>Section-wise mock log</h2>
          <p className="muted-line">
            After an Oliveboard mock, paste overall score + optional section
            accuracy % (from their analysis).
          </p>
          <form
            className="prep-form"
            onSubmit={(e) => {
              e.preventDefault()
              const sections: Partial<Record<SectionKey, number>> = {}
              for (const k of SECTION_KEYS) {
                const v = parseOptionalPct(secInputs[k])
                if (v != null) sections[k] = v
              }
              const pctile = parseOptionalPct(percentile)
              addMock({
                examId: mockExam,
                source: source.trim() || 'Mock',
                score: Number(score) || 0,
                maxScore: Math.max(1, Number(maxScore) || 100),
                date: today,
                note: mockNote.trim(),
                stage,
                percentile: pctile,
                sections: Object.keys(sections).length ? sections : undefined,
              })
              setMockNote('')
              setPercentile('')
              setSecInputs({
                quant: '',
                reasoning: '',
                english: '',
                ga: '',
                itPk: '',
              })
            }}
          >
            <label>
              Exam
              <select value={mockExam} onChange={(e) => setMockExam(e.target.value)}>
                {EXAMS.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.shortName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stage
              <select
                value={stage}
                onChange={(e) =>
                  setStage(e.target.value as typeof stage)
                }
              >
                <option value="prelims">Prelims</option>
                <option value="mains">Mains</option>
                <option value="sectional">Sectional</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Source
              <input value={source} onChange={(e) => setSource(e.target.value)} />
            </label>
            <label>
              Percentile (opt)
              <input
                value={percentile}
                onChange={(e) => setPercentile(e.target.value)}
                placeholder="e.g. 82"
              />
            </label>
            <label>
              Score
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
              />
            </label>
            <label>
              Out of
              <input
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
              />
            </label>
            {SECTION_KEYS.map((k) => (
              <label key={k}>
                {SECTION_LABELS[k]} %
                <input
                  inputMode="decimal"
                  value={secInputs[k]}
                  onChange={(e) =>
                    setSecInputs((prev) => ({ ...prev, [k]: e.target.value }))
                  }
                  placeholder="acc %"
                />
              </label>
            ))}
            <label className="full">
              Note
              <input
                value={mockNote}
                onChange={(e) => setMockNote(e.target.value)}
                placeholder="e.g. slow on puzzles · IT PK networking weak"
              />
            </label>
            <button type="submit" className="btn primary">
              Save mock
            </button>
          </form>

          {trend.length > 0 && (
            <div className="trend-block">
              <h3>Score trend</h3>
              <div className="trend-bars" aria-hidden>
                {trend.map((t) => (
                  <div key={t.id} className="trend-col" title={`${t.date}: ${t.pct}%`}>
                    <div
                      className="trend-bar"
                      style={{ height: `${Math.max(8, (t.pct / maxTrend) * 100)}%` }}
                    />
                    <span>{t.pct}</span>
                  </div>
                ))}
              </div>
              {Object.keys(secAvgs).length > 0 && (
                <ul className="sec-avg-list">
                  {SECTION_KEYS.filter((k) => secAvgs[k] != null).map((k) => (
                    <li key={k}>
                      <span>{SECTION_LABELS[k]}</span>
                      <strong className={secAvgs[k]! < 70 ? 'warn-text' : ''}>
                        {secAvgs[k]}%
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <ul className="log-list">
            {mockScores.slice(0, 10).map((m) => {
              const pct = Math.round((m.score / m.maxScore) * 100)
              const secBits = m.sections
                ? SECTION_KEYS.filter((k) => m.sections?.[k] != null)
                    .map((k) => `${SECTION_LABELS[k]} ${m.sections![k]}%`)
                    .join(' · ')
                : ''
              return (
                <li key={m.id}>
                  <div>
                    <strong>
                      {EXAMS.find((x) => x.id === m.examId)?.shortName} · {m.score}/
                      {m.maxScore} ({pct}%)
                      {m.percentile != null ? ` · P${m.percentile}` : ''}
                    </strong>
                    <span>
                      {m.source} · {m.stage ?? 'mock'} · {m.date}
                      {m.note ? ` — ${m.note}` : ''}
                      {secBits ? ` · ${secBits}` : ''}
                    </span>
                  </div>
                  <button type="button" className="ghost" onClick={() => removeMock(m.id)}>
                    Remove
                  </button>
                </li>
              )
            })}
            {mockScores.length === 0 && (
              <li className="muted-line">No mocks logged yet — add your next Oliveboard attempt.</li>
            )}
          </ul>
        </section>

        <section className="prep-panel" id="error-notebook">
          <h2>Error notebook</h2>
          <p className="muted-line">
            Tag wrong questions as concept / silly / time so the same leak stops
            repeating.
          </p>
          <form
            className="prep-form"
            onSubmit={(e) => {
              e.preventDefault()
              const topic = TOPICS.find((t) => t.id === errTopicId)
              const label = (topic?.title || errLabel).trim()
              if (!label) return
              addError({
                date: today,
                examId: errExam || undefined,
                topicId: errTopicId || undefined,
                topicLabel: label,
                mistakeType: errType,
                section: errSection,
                note: errNote.trim(),
              })
              setErrNote('')
              setErrLabel('')
            }}
          >
            <label>
              Exam
              <select value={errExam} onChange={(e) => setErrExam(e.target.value)}>
                {EXAMS.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.shortName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mistake type
              <select
                value={errType}
                onChange={(e) =>
                  setErrType(e.target.value as typeof errType)
                }
              >
                <option value="concept">Concept gap</option>
                <option value="silly">Silly / misread</option>
                <option value="time">Time pressure</option>
              </select>
            </label>
            <label>
              Section
              <select
                value={errSection}
                onChange={(e) =>
                  setErrSection(e.target.value as typeof errSection)
                }
              >
                {SECTION_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {SECTION_LABELS[k]}
                  </option>
                ))}
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Syllabus topic
              <select
                value={errTopicId}
                onChange={(e) => setErrTopicId(e.target.value)}
              >
                <option value="">Custom label…</option>
                {topicOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            {!errTopicId && (
              <label className="full">
                Topic label
                <input
                  value={errLabel}
                  onChange={(e) => setErrLabel(e.target.value)}
                  placeholder="e.g. Floor puzzle / DBMS normalization"
                  required
                />
              </label>
            )}
            <label className="full">
              What went wrong
              <input
                value={errNote}
                onChange={(e) => setErrNote(e.target.value)}
                placeholder="Short note you’ll remember next time"
              />
            </label>
            <button type="submit" className="btn primary">
              Log error
            </button>
          </form>

          {errStats.length > 0 && (
            <ul className="err-stat-list">
              {errStats.map((s) => (
                <li key={s.key}>
                  <strong>{s.label}</strong>
                  <span>
                    {s.count}× · concept {s.types.concept} · silly {s.types.silly} ·
                    time {s.types.time}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <ul className="log-list">
            {errorLog.slice(0, 12).map((err) => (
              <li key={err.id}>
                <div>
                  <strong>
                    {err.topicLabel}{' '}
                    <span className={`err-tag ${err.mistakeType}`}>{err.mistakeType}</span>
                  </strong>
                  <span>
                    {err.examId
                      ? EXAMS.find((x) => x.id === err.examId)?.shortName
                      : 'General'}{' '}
                    · {err.date}
                    {err.note ? ` — ${err.note}` : ''}
                  </span>
                </div>
                <button type="button" className="ghost" onClick={() => removeError(err.id)}>
                  Remove
                </button>
              </li>
            ))}
            {errorLog.length === 0 && (
              <li className="muted-line">No errors logged — capture 2–3 after each mock.</li>
            )}
          </ul>
        </section>

        <section className="prep-panel" id="revision-queue">
          <h2>
            Spaced revision{' '}
            <span className="soft-chip">{revisionsDueList.length} due</span>
          </h2>
          <p className="muted-line">
            Ticking a syllabus topic schedules a review (1 → 3 → growing days).
            Mark remembered / forgot here.
          </p>
          <ul className="log-list revision-list">
            {revisionsDueList.map((card) => {
              const topic = TOPICS.find((t) => t.id === card.topicId)
              return (
                <li key={card.topicId}>
                  <div>
                    <strong>{topic?.title ?? card.topicId}</strong>
                    <span>
                      Due {card.due} · interval {card.interval}d · ease{' '}
                      {card.ease.toFixed(1)}
                    </span>
                  </div>
                  <div className="rev-actions">
                    <button
                      type="button"
                      className="btn primary small-btn"
                      onClick={() => reviewRevision(card.topicId, 1)}
                    >
                      Remembered
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => reviewRevision(card.topicId, 0)}
                    >
                      Forgot
                    </button>
                  </div>
                </li>
              )
            })}
            {revisionsDueList.length === 0 && (
              <li className="muted-line">
                Nothing due — complete topics on exam pages to fill this queue.
              </li>
            )}
          </ul>
        </section>

        <section className="prep-panel">
          <h2>Daily study log</h2>
          <form
            className="prep-form"
            onSubmit={(e) => {
              e.preventDefault()
              addStudy({
                date: today,
                minutes: Math.max(1, Number(minutes) || 0),
                note: note.trim(),
                examId: studyExam || undefined,
                topicIds: [],
              })
              setNote('')
            }}
          >
            <label>
              Minutes
              <input
                type="number"
                min={1}
                max={600}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
            <label>
              Exam (optional)
              <select value={studyExam} onChange={(e) => setStudyExam(e.target.value)}>
                <option value="">General / mixed</option>
                {EXAMS.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.shortName}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Note
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. DI sets + Computer Networks revision"
              />
            </label>
            <button type="submit" className="btn primary">
              Add today’s block
            </button>
          </form>
          <ul className="log-list">
            {studyLog.slice(0, 12).map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>
                    {entry.minutes} min · {entry.date}
                  </strong>
                  <span>
                    {entry.examId
                      ? EXAMS.find((x) => x.id === entry.examId)?.shortName
                      : 'Mixed'}
                    {entry.note ? ` — ${entry.note}` : ''}
                  </span>
                </div>
                <button type="button" className="ghost" onClick={() => removeStudy(entry.id)}>
                  Remove
                </button>
              </li>
            ))}
            {studyLog.length === 0 && <li className="muted-line">No sessions logged yet.</li>}
          </ul>
        </section>

        <section className="prep-panel">
          <h2>
            Application kit{' '}
            <span className="soft-chip">
              {docsDone}/{DOC_ITEMS.length}
            </span>
          </h2>
          <p className="muted-line">
            Docs checklist before IBPS / SBI / SEBI forms — avoid last-day panic.
          </p>
          <ul className="docs-list">
            {DOC_ITEMS.map((d) => (
              <li key={d.id}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!docs[d.id]}
                    onChange={() => toggleDoc(d.id)}
                    aria-label={d.title}
                  />
                  <span>
                    <strong>{d.title}</strong>
                    <em>{d.hint}</em>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="prep-panel cloud-panel" id="cloud-login">
          <h2>Your cloud account</h2>
          {isFirebaseConfigured ? (
            <>
              {user ? (
                <p>
                  Signed in as <strong>{user.email ?? user.displayName}</strong>
                  {syncing
                    ? ' · syncing…'
                    : ' · ticks, mocks, errors & revision sync to this Google account.'}
                </p>
              ) : (
                <p>
                  Sign in with Google so mocks, errors, and revision follow you across
                  devices.
                </p>
              )}
              <div className="backup-actions">
                {user ? (
                  <button type="button" className="ghost" onClick={() => void signOutUser()}>
                    Sign out
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={syncing}
                    onClick={() => void signInWithGoogle()}
                  >
                    {syncing ? 'Signing in…' : 'Sign in with Google'}
                  </button>
                )}
              </div>
              {authError && <p className="auth-error-block">{authError}</p>}
            </>
          ) : (
            <p>
              Cloud login not wired — see <code>FIREBASE_SETUP.md</code>. Local prep
              tools still work.
            </p>
          )}
        </section>

        <section className="prep-panel">
          <h2>Reminders & backup</h2>
          <div className="backup-actions">
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                const perm = await requestReminderPermission()
                setRemindersEnabled(perm === 'granted')
                if (perm === 'granted') {
                  const next = upcomingDeadlines(1)[0]
                  if (next) {
                    const days = daysUntil(next.when)
                    notifyUpcoming(
                      `${next.exam.shortName} in ${days} day(s)`,
                      `${next.label} · ${next.date}`,
                    )
                  }
                } else {
                  alert('Notification permission not granted.')
                }
              }}
            >
              {remindersEnabled ? 'Reminders on' : 'Enable browser reminders'}
            </button>
            <button type="button" className="ghost" onClick={() => downloadDeadlinesIcs()}>
              Export calendar (.ics)
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => downloadJson(exportState())}
            >
              Download backup JSON
            </button>
            <label className="import-btn ghost">
              Restore backup
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const text = await file.text()
                    const data = JSON.parse(text)
                    importState(data)
                    alert('Backup restored.')
                  } catch {
                    alert('Could not read that backup file.')
                  }
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          <p className="muted-line">
            <Link to="/focus">Open focus mode</Link> for single-exam deep work.
          </p>
        </section>
      </div>
    </div>
  )
}
