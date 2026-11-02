import { useMemo, useState } from 'react'
import { YouTubeProgressPlayer } from '../components/YouTubeProgressPlayer'
import { useProgress } from '../hooks/useProgress'
import {
  VIDEO_SECTION_SUGGESTIONS,
  formatDuration,
  parseYouTubeId,
  youtubeWatchUrl,
  type VideoEntry,
} from '../utils/videoLibrary'

export function VideosPage() {
  const { videoLibrary, addVideo, updateVideo, removeVideo } = useProgress()
  const [title, setTitle] = useState('')
  const [section, setSection] = useState<string>(VIDEO_SECTION_SUGGESTIONS[0])
  const [customSection, setCustomSection] = useState('')
  const [url, setUrl] = useState('')
  const [filter, setFilter] = useState('All')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const sections = useMemo(() => {
    const set = new Set<string>()
    for (const v of videoLibrary) set.add(v.section)
    return ['All', ...[...set].sort((a, b) => a.localeCompare(b))]
  }, [videoLibrary])

  const filtered = useMemo(() => {
    if (filter === 'All') return videoLibrary
    return videoLibrary.filter((v) => v.section === filter)
  }, [videoLibrary, filter])

  const grouped = useMemo(() => {
    const map = new Map<string, VideoEntry[]>()
    for (const v of filtered) {
      const list = map.get(v.section) ?? []
      list.push(v)
      map.set(v.section, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const active = videoLibrary.find((v) => v.id === activeId) ?? null

  const onAdd = () => {
    setError('')
    const sec = (customSection.trim() || section).trim()
    if (!title.trim() || !url.trim() || !sec) {
      setError('Add a topic title, section, and YouTube link.')
      return
    }
    if (!parseYouTubeId(url)) {
      setError('Paste a valid YouTube link (youtube.com or youtu.be).')
      return
    }
    const created = addVideo({
      title: title.trim(),
      section: sec,
      url: url.trim(),
    })
    if (!created) {
      setError('Could not save that video.')
      return
    }
    setTitle('')
    setUrl('')
    setCustomSection('')
    setActiveId(created.id)
  }

  const totals = useMemo(() => {
    const n = videoLibrary.length
    if (!n) return { n: 0, avg: 0, done: 0 }
    const avg = Math.round(
      videoLibrary.reduce((s, v) => s + v.pct, 0) / n,
    )
    const done = videoLibrary.filter((v) => v.pct >= 90).length
    return { n, avg, done }
  }, [videoLibrary])

  return (
    <div className="videos-page">
      <header className="section-head stack">
        <div>
          <h1>Video tracker</h1>
          <p className="lede">
            Save YouTube links by topic (vocab, grammar, DI…). Watch inside
            ExamPulse to auto-track progress — or set % manually if you watched
            on the YouTube app.
          </p>
        </div>
        {totals.n > 0 && (
          <p className="videos-summary">
            {totals.n} videos · avg {totals.avg}% · {totals.done} nearly done
            (≥90%)
          </p>
        )}
      </header>

      <section className="video-composer" aria-label="Add video">
        <h2>Add a video</h2>
        <div className="video-composer-grid">
          <label>
            <span>Topic / title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Vocab – root words batch 1"
              maxLength={120}
            />
          </label>
          <label>
            <span>Section</span>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {VIDEO_SECTION_SUGGESTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Or custom section</span>
            <input
              type="text"
              value={customSection}
              onChange={(e) => setCustomSection(e.target.value)}
              placeholder="Overrides dropdown if filled"
              maxLength={64}
            />
          </label>
          <label className="video-url-field">
            <span>YouTube link</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtu.be/… or youtube.com/watch?v=…"
            />
          </label>
        </div>
        {error && <p className="video-error">{error}</p>}
        <button type="button" className="btn primary" onClick={onAdd}>
          Save video
        </button>
      </section>

      {sections.length > 1 && (
        <div className="filter-row video-filters" role="tablist">
          {sections.map((s) => (
            <button
              key={s}
              type="button"
              className={filter === s ? 'active' : ''}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {active && active.videoId && (
        <section className="video-watch" aria-label="Now watching">
          <div className="video-watch-head">
            <div>
              <p className="muted-line">{active.section}</p>
              <h2>{active.title}</h2>
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => setActiveId(null)}
            >
              Close player
            </button>
          </div>
          <YouTubeProgressPlayer
            videoId={active.videoId}
            onProgress={({ watchedSec, durationSec, pct }) => {
              // Only write when progress moves forward meaningfully
              if (
                pct > active.pct ||
                watchedSec > active.watchedSec + 2 ||
                (durationSec && durationSec !== active.durationSec)
              ) {
                updateVideo(active.id, {
                  watchedSec,
                  durationSec,
                  pct: Math.max(active.pct, pct),
                })
              }
            }}
          />
          <div className="video-progress-row">
            <div className="video-progress-track" aria-hidden>
              <span style={{ width: `${active.pct}%` }} />
            </div>
            <span>
              {active.pct}% watched
              {active.durationSec
                ? ` · ${formatDuration(active.watchedSec)} / ${formatDuration(active.durationSec)}`
                : ''}
            </span>
          </div>
          <p className="muted-line video-progress-hint">
            Progress updates while you play here. Watched on the YouTube app?
            Use the slider on the card below.
          </p>
        </section>
      )}

      {grouped.length === 0 ? (
        <p className="group-empty">
          No videos yet — add your first topic + YouTube link above.
        </p>
      ) : (
        grouped.map(([sec, items]) => (
          <section key={sec} className="video-section-block">
            <h2 className="roadmap-section-title">{sec}</h2>
            <ul className="video-list">
              {items.map((v) => (
                <li key={v.id} className="video-card">
                  <div className="video-card-main">
                    <strong>{v.title}</strong>
                    <div className="video-progress-track" aria-hidden>
                      <span style={{ width: `${v.pct}%` }} />
                    </div>
                    <em>
                      {v.pct}%
                      {v.durationSec
                        ? ` · ${formatDuration(v.durationSec)} total`
                        : ''}
                      {v.videoId ? '' : ' · invalid YouTube URL'}
                    </em>
                  </div>
                  <div className="video-card-actions">
                    {v.videoId && (
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => setActiveId(v.id)}
                      >
                        Watch
                      </button>
                    )}
                    <a
                      className="btn ghost-btn"
                      href={
                        v.videoId ? youtubeWatchUrl(v.videoId) : v.url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      YouTube ↗
                    </a>
                    <label className="video-manual">
                      <span>Set %</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={v.pct}
                        onChange={(e) =>
                          updateVideo(v.id, {
                            pct: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        if (confirm(`Remove “${v.title}”?`)) removeVideo(v.id)
                        if (activeId === v.id) setActiveId(null)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
