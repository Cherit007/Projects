import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { upcomingDeadlines, daysUntil } from '../data/deadlines'
import { EXAMS } from '../data/exams'
import { useProgress } from '../hooks/useProgress'
import {
  downloadDeadlinesIcs,
  downloadJson,
  notifyUpcoming,
  requestReminderPermission,
} from '../utils/export'

export function PrepLab() {
  const {
    studyLog,
    mockScores,
    addStudy,
    removeStudy,
    addMock,
    removeMock,
    exportState,
    importState,
    remindersEnabled,
    setRemindersEnabled,
    stats,
  } = useProgress()

  const [minutes, setMinutes] = useState(60)
  const [note, setNote] = useState('')
  const [studyExam, setStudyExam] = useState('')
  const [mockExam, setMockExam] = useState(EXAMS[0]?.id ?? '')
  const [source, setSource] = useState('Oliveboard')
  const [score, setScore] = useState(40)
  const [maxScore, setMaxScore] = useState(100)
  const [mockNote, setMockNote] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const weekMinutes = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000
    return studyLog
      .filter((e) => new Date(e.date).getTime() >= weekAgo)
      .reduce((s, e) => s + e.minutes, 0)
  }, [studyLog])

  return (
    <div className="prep-lab">
      <header className="section-head stack">
        <div>
          <h1>Prep lab</h1>
          <p className="lede">
            Daily log, mock scores, reminders, and backup — today{' '}
            <strong>{stats.minutesToday} min</strong> · this week{' '}
            <strong>{weekMinutes} min</strong>
          </p>
        </div>
      </header>

      <div className="prep-grid">
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
          <h2>Mock score tracker</h2>
          <form
            className="prep-form"
            onSubmit={(e) => {
              e.preventDefault()
              addMock({
                examId: mockExam,
                source: source.trim() || 'Mock',
                score: Number(score) || 0,
                maxScore: Math.max(1, Number(maxScore) || 100),
                date: today,
                note: mockNote.trim(),
              })
              setMockNote('')
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
              Source
              <input value={source} onChange={(e) => setSource(e.target.value)} />
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
            <label className="full">
              Note
              <input
                value={mockNote}
                onChange={(e) => setMockNote(e.target.value)}
                placeholder="sectional notes / weak areas"
              />
            </label>
            <button type="submit" className="btn primary">
              Save mock
            </button>
          </form>
          <ul className="log-list">
            {mockScores.slice(0, 12).map((m) => {
              const pct = Math.round((m.score / m.maxScore) * 100)
              return (
                <li key={m.id}>
                  <div>
                    <strong>
                      {EXAMS.find((x) => x.id === m.examId)?.shortName} · {m.score}/
                      {m.maxScore} ({pct}%)
                    </strong>
                    <span>
                      {m.source} · {m.date}
                      {m.note ? ` — ${m.note}` : ''}
                    </span>
                  </div>
                  <button type="button" className="ghost" onClick={() => removeMock(m.id)}>
                    Remove
                  </button>
                </li>
              )
            })}
            {mockScores.length === 0 && <li className="muted-line">No mocks logged yet.</li>}
          </ul>
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
            Calendar export includes approximate watch windows — always confirm on the
            official site. <Link to="/focus">Open focus mode</Link> for single-exam deep
            work.
          </p>
        </section>
      </div>
    </div>
  )
}
