import { useEffect, useRef, useState } from 'react'

function formatSolveClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const tenths = Math.floor((ms % 1000) / 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`
}

/** Ephemeral solve timer — start / stop / reset only; nothing is stored. */
export function PdfSolveTimer() {
  const [running, setRunning] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const baseRef = useRef(0)
  const anchorRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    anchorRef.current = performance.now()
    const id = window.setInterval(() => {
      const anchor = anchorRef.current ?? performance.now()
      setElapsedMs(baseRef.current + (performance.now() - anchor))
    }, 100)
    return () => window.clearInterval(id)
  }, [running])

  const start = () => {
    if (running) return
    baseRef.current = elapsedMs
    setRunning(true)
  }

  const stop = () => {
    if (!running) return
    const anchor = anchorRef.current ?? performance.now()
    baseRef.current += performance.now() - anchor
    setElapsedMs(baseRef.current)
    anchorRef.current = null
    setRunning(false)
  }

  const reset = () => {
    setRunning(false)
    baseRef.current = 0
    anchorRef.current = null
    setElapsedMs(0)
  }

  return (
    <div
      className={`pdf-solve-timer${running ? ' running' : ''}`}
      role="group"
      aria-label="Solve timer"
    >
      <span className="pdf-solve-timer-label">Timer</span>
      <span className="pdf-solve-timer-clock" aria-live="polite">
        {formatSolveClock(elapsedMs)}
      </span>
      <button type="button" onClick={start} disabled={running}>
        Start
      </button>
      <button type="button" onClick={stop} disabled={!running}>
        Stop
      </button>
      <button type="button" onClick={reset}>
        Reset
      </button>
    </div>
  )
}
