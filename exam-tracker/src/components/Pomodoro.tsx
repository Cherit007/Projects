import { useEffect, useRef, useState } from 'react'
import { useProgress } from '../hooks/useProgress'

const FOCUS_SECS = 25 * 60
const BREAK_SECS = 5 * 60

type Mode = 'focus' | 'break'

type Props = {
  examId?: string
  topicId?: string | null
  topicLabel?: string
}

export function Pomodoro({ examId, topicId, topicLabel }: Props) {
  const { addStudy } = useProgress()
  const [mode, setMode] = useState<Mode>('focus')
  const [secs, setSecs] = useState(FOCUS_SECS)
  const [running, setRunning] = useState(false)
  const endRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    endRef.current = Date.now() + secs * 1000
    const id = window.setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil(((endRef.current ?? Date.now()) - Date.now()) / 1000),
      )
      setSecs(left)
      if (left <= 0) {
        window.clearInterval(id)
        setRunning(false)
        if (mode === 'focus') {
          const today = new Date().toISOString().slice(0, 10)
          addStudy({
            date: today,
            minutes: 25,
            note: topicLabel
              ? `Pomodoro · ${topicLabel}`
              : 'Pomodoro focus block',
            examId,
            topicIds: topicId ? [topicId] : [],
          })
          setMode('break')
          setSecs(BREAK_SECS)
        } else {
          setMode('focus')
          setSecs(FOCUS_SECS)
        }
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [running, mode, addStudy, examId, topicId, topicLabel])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <div className={`pomodoro ${mode}`}>
      <div className="pomo-head">
        <strong>{mode === 'focus' ? 'Focus timer' : 'Break'}</strong>
        <span>
          25/5 ·{' '}
          {topicLabel ? `logs → ${topicLabel}` : 'auto-logs study'}
        </span>
      </div>
      <div className="pomo-clock" aria-live="polite">
        {mm}:{ss}
      </div>
      <div className="pomo-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => setRunning((r) => !r)}
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setRunning(false)
            setMode('focus')
            setSecs(FOCUS_SECS)
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
