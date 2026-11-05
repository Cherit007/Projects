import { useMemo, useState } from 'react'
import { YouTubeProgressPlayer } from '../components/YouTubeProgressPlayer'
import { useProgress } from '../hooks/useProgress'
import {
  VIDEO_SECTION_SUGGESTIONS,
  formatDuration,
  parseYouTubeId,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type VideoEntry,
} from '../utils/videoLibrary'

type StatusFilter = 'All' | 'In progress' | 'Done' | 'Not started'

export function VideosPage() {
  const { videoLibrary, addVideo, updateVideo, removeVideo } = useProgress()
  const [title, setTitle] = useState('')
  const [section, setSection] = useState<string>(VIDEO_SECTION_SUGGESTIONS[0])
  const [customSection, setCustomSection] = useState('')
  const [url, setUrl] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [filter, setFilter] = useState('All')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)

  const sections = useMemo(() => {
    const set = new Set<string>()
    for (const v of videoLibrary) set.add(v.section)
    return ['All', ...[...set].sort((a, b) => a.localeCompare(b))]
  }, [videoLibrary])

  const continueWatching = useMemo(() => {
    return videoLibrary
      .filter((v) => v.pct > 0 && v.pct < 90)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8)
  }, [videoLibrary])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return videoLibrary.filter((v) => {
      if (filter !== 'All' && v.section !== filter) return false
      if (status === 'Done' && v.pct < 90) return false
      if (status === 'In progress' && !(v.pct > 0 && v.pct < 90)) return false
      if (status === 'Not started' && v.pct > 0) return false
      if (!q) return true
      return `${v.title} ${v.section} ${v.notes ?? ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [videoLibrary, filter, status, query])

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

  const totals = useMemo(() => {
    const n = videoLibrary.length
    if (!n) return { n: 0, avg: 0, done: 0 }
    const avg = Math.round(videoLibrary.reduce((s, v) => s + v.pct, 0) / n)
    const done = videoLibrary.filter((v) => v.pct >= 90).length
    return { n, avg, done }
  }, [videoLibrary])

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
      notes: notesDraft.trim() || undefined,
    })
    if (!created) {
      setError('Could not save that video.')
      return
    }
    setTitle('')
    setUrl('')
    setNotesDraft('')
    setCustomSection('')
    setComposerOpen(false)
    setActiveId(created.id)
  }

  const renderThumbCard = (v: VideoEntry, compact = false) => {
    const thumb = v.videoId ? youtubeThumbnailUrl(v.videoId) : null
    const done = v.pct >= 90
    return (
      <article
        key={v.id}
        className={`yt-card${compact ? ' compact' : ''}${done ? ' done' : ''}`}
      >
        <button
          type="button"
          className="yt-thumb"
          disabled={!v.videoId}
          onClick={() => v.videoId && setActiveId(v.id)}
          aria-label={`Watch ${v.title}`}
        >
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" />
          ) : (
            <span className="yt-thumb-fallback">No preview</span>
          )}
          <span className="yt-thumb-play" aria-hidden>
            ▶
          </span>
          {v.pct > 0 && (
            <span className="yt-thumb-progress" aria-hidden>
              <i style={{ width: `${v.pct}%` }} />
            </span>
          )}
          {done && <span className="yt-badge done">Done</span>}
          {!done && v.pct > 0 && (
            <span className="yt-badge prog">{v.pct}%</span>
          )}
        </button>

        <div className="yt-card-body">
          <p className="yt-card-section">{v.section}</p>
          <h3 className="yt-card-title">{v.title}</h3>
          <p className="yt-card-meta">
            {v.pct}% watched
            {v.durationSec
              ? ` · ${formatDuration(v.watchedSec)} / ${formatDuration(v.durationSec)}`
              : ''}
          </p>
          {v.notes && <p className="yt-card-notes">{v.notes}</p>}

          <div className="yt-card-actions">
            {v.videoId && (
              <button
                type="button"
                className="btn primary"
                onClick={() => setActiveId(v.id)}
              >
                {v.pct > 0 && v.pct < 90 ? 'Resume' : 'Watch'}
              </button>
            )}
            <a
              className="btn ghost-btn"
              href={v.videoId ? youtubeWatchUrl(v.videoId) : v.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              YouTube ↗
            </a>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                updateVideo(v.id, { pct: done ? 0 : 100, watchedSec: done ? 0 : v.watchedSec })
              }
            >
              {done ? 'Reset' : 'Mark done'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setEditingNotesId(editingNotesId === v.id ? null : v.id)
              }}
            >
              Notes
            </button>
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

          <label className="video-manual yt-manual">
            <span>Set progress</span>
            <input
              type="range"
              min={0}
              max={100}
              value={v.pct}
              onChange={(e) =>
                updateVideo(v.id, { pct: Number(e.target.value) })
              }
            />
          </label>

          {editingNotesId === v.id && (
            <div className="yt-notes-edit">
              <textarea
                defaultValue={v.notes ?? ''}
                rows={3}
                placeholder="Timestamps, weak spots, what to revise…"
                onBlur={(e) => {
                  updateVideo(v.id, { notes: e.target.value.trim() || undefined })
                }}
              />
              <button
                type="button"
                className="ghost"
                onClick={() => setEditingNotesId(null)}
              >
                Done editing
              </button>
            </div>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="videos-page yt-library">
      <header className="section-head stack">
        <div>
          <h1>YouTube library</h1>
          <p className="lede">
            Your study playlist — vocab, grammar, DI, and more — with thumbnails
            and watch progress.
          </p>
        </div>
        <div className="yt-header-actions">
          {totals.n > 0 && (
            <p className="videos-summary">
              {totals.n} videos · avg {totals.avg}% · {totals.done} done
            </p>
          )}
          <button
            type="button"
            className="btn primary"
            onClick={() => setComposerOpen((o) => !o)}
          >
            {composerOpen ? 'Close' : 'Add video'}
          </button>
        </div>
      </header>

      {composerOpen && (
        <section className="video-composer" aria-label="Add YouTube video">
          <h2>Add YouTube video</h2>
          <div className="video-composer-grid">
            <label>
              <span>Topic / title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Vocab – root words batch 1"
                maxLength={120}
                autoFocus
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
            <label className="video-url-field">
              <span>Notes (optional)</span>
              <input
                type="text"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="e.g. revise synonyms at 12:40"
                maxLength={400}
              />
            </label>
          </div>
          {error && <p className="video-error">{error}</p>}
          <button type="button" className="btn primary" onClick={onAdd}>
            Save to library
          </button>
        </section>
      )}

      {videoLibrary.length > 0 && (
        <div className="yt-toolbar">
          <label className="yt-search">
            <span className="search-icon" aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, section, notes…"
            />
          </label>
          <div className="filter-row" role="tablist" aria-label="Status">
            {(
              ['All', 'In progress', 'Done', 'Not started'] as StatusFilter[]
            ).map((s) => (
              <button
                key={s}
                type="button"
                className={status === s ? 'active' : ''}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

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
            <div className="yt-watch-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => updateVideo(active.id, { pct: 100 })}
              >
                Mark done
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setActiveId(null)}
              >
                Close player
              </button>
            </div>
          </div>
          <YouTubeProgressPlayer
            videoId={active.videoId}
            onProgress={({ watchedSec, durationSec, pct }) => {
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
            Progress updates while you play here. Used the YouTube app? Drag
            “Set progress” on the card.
          </p>
        </section>
      )}

      {continueWatching.length > 0 && filter === 'All' && !query && status === 'All' && (
        <section className="yt-continue" aria-label="Continue watching">
          <h2 className="roadmap-section-title">Continue watching</h2>
          <div className="yt-grid">{continueWatching.map((v) => renderThumbCard(v, true))}</div>
        </section>
      )}

      {grouped.length === 0 ? (
        <p className="group-empty">
          {videoLibrary.length === 0
            ? 'No videos yet — tap Add video and paste a YouTube link.'
            : 'No videos match this filter.'}
        </p>
      ) : (
        grouped.map(([sec, items]) => (
          <section key={sec} className="video-section-block">
            <div className="yt-section-head">
              <h2 className="roadmap-section-title">{sec}</h2>
              <span className="muted-line">
                {items.filter((v) => v.pct >= 90).length}/{items.length} done
              </span>
            </div>
            <div className="yt-grid">{items.map((v) => renderThumbCard(v))}</div>
          </section>
        ))
      )}
    </div>
  )
}
