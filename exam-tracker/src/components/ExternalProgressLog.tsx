import { useEffect, useState } from 'react'
import {
  formatDuration,
  parseTimestampInput,
  type VideoEntry,
} from '../utils/videoLibrary'

type Props = {
  video: VideoEntry
  nudge?: boolean
  onApply: (patch: {
    pct: number
    watchedSec: number
    durationSec?: number | null
  }) => void
  onClearNudge?: () => void
}

const QUICK = [10, 25, 50, 75, 100] as const

/**
 * Manual progress for “open on YouTube” mode — the official site never
 * reports watch time back to ExamPulse.
 */
export function ExternalProgressLog({
  video,
  nudge = false,
  onApply,
  onClearNudge,
}: Props) {
  const [timeDraft, setTimeDraft] = useState(() =>
    video.watchedSec > 0 ? formatClock(video.watchedSec) : '',
  )
  const [durationDraft, setDurationDraft] = useState(() =>
    video.durationSec ? formatClock(video.durationSec) : '',
  )
  const [error, setError] = useState('')

  useEffect(() => {
    setTimeDraft(video.watchedSec > 0 ? formatClock(video.watchedSec) : '')
    setDurationDraft(video.durationSec ? formatClock(video.durationSec) : '')
    setError('')
  }, [video.id])

  const applyPct = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)))
    const duration = video.durationSec
    onApply({
      pct: clamped,
      watchedSec:
        duration != null && duration > 0
          ? (clamped / 100) * duration
          : video.watchedSec,
    })
    onClearNudge?.()
  }

  const applyTime = () => {
    const watched = parseTimestampInput(timeDraft)
    if (watched == null) {
      setError('Use 12:30, 12m30s, or seconds')
      return
    }
    let duration = video.durationSec
    if (!duration && durationDraft.trim()) {
      const parsed = parseTimestampInput(durationDraft)
      if (parsed == null || parsed <= 0) {
        setError('Duration looks invalid')
        return
      }
      duration = parsed
    }
    if (duration != null && duration > 0) {
      const capped = Math.min(watched, duration)
      onApply({
        pct: Math.min(100, Math.round((capped / duration) * 100)),
        watchedSec: capped,
        durationSec: duration,
      })
    } else {
      onApply({
        pct: video.pct > 0 ? video.pct : watched > 0 ? 1 : 0,
        watchedSec: watched,
      })
    }
    setError('')
    onClearNudge?.()
  }

  const saveDuration = () => {
    const parsed = parseTimestampInput(durationDraft)
    if (parsed == null || parsed <= 0) {
      setError('Enter total length like 45:00')
      return
    }
    const watched = Math.min(video.watchedSec, parsed)
    onApply({
      durationSec: parsed,
      watchedSec: watched,
      pct: Math.min(100, Math.round((watched / parsed) * 100)),
    })
    setError('')
  }

  return (
    <div className={`yt-log-progress${nudge ? ' is-nudge' : ''}`}>
      <div className="yt-log-progress-head">
        <strong>{nudge ? 'Welcome back — log where you stopped' : 'Log progress'}</strong>
        <span>
          YouTube doesn’t send watch time to ExamPulse. Tap a % or enter the
          timestamp from the player.
        </span>
      </div>

      <div className="yt-log-quick" role="group" aria-label="Quick progress">
        {QUICK.map((p) => (
          <button
            key={p}
            type="button"
            className={video.pct === p || (p === 100 && video.pct >= 90) ? 'active' : ''}
            onClick={() => applyPct(p)}
          >
            {p === 100 ? 'Done' : `${p}%`}
          </button>
        ))}
      </div>

      <label className="yt-log-slider">
        <span>{video.pct}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={video.pct}
          onChange={(e) => applyPct(Number(e.target.value))}
          aria-label="Watch percent"
        />
      </label>

      <div className="yt-log-time-row">
        <label>
          At timestamp
          <input
            type="text"
            inputMode="numeric"
            placeholder="12:30"
            value={timeDraft}
            onChange={(e) => setTimeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyTime()
            }}
          />
        </label>
        {!video.durationSec && (
          <label>
            Total length
            <input
              type="text"
              inputMode="numeric"
              placeholder="45:00"
              value={durationDraft}
              onChange={(e) => setDurationDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveDuration()
              }}
            />
          </label>
        )}
        <button type="button" className="yt-action solid" onClick={applyTime}>
          Save
        </button>
      </div>

      {video.durationSec != null && (
        <p className="yt-log-hint">
          Length {formatDuration(video.durationSec)}
          {video.watchedSec > 0
            ? ` · logged ${formatDuration(video.watchedSec)}`
            : ''}
        </p>
      )}
      {error && <p className="yt-log-error">{error}</p>}
    </div>
  )
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }
  return `${m}:${String(r).padStart(2, '0')}`
}
