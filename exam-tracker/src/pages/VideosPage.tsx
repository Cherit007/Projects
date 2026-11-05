import { useEffect, useMemo, useRef, useState } from 'react'
import { YouTubeProgressPlayer } from '../components/YouTubeProgressPlayer'
import { useProgress } from '../hooks/useProgress'
import {
  VIDEO_SECTION_SUGGESTIONS,
  fetchYoutubeDetails,
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
  const [channel, setChannel] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [filter, setFilter] = useState('All')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [manualOpenId, setManualOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'ok' | 'fail'>(
    'idle',
  )
  const [livePct, setLivePct] = useState<number | null>(null)
  const titleTouched = useRef(false)
  const activeRef = useRef<VideoEntry | null>(null)

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
      return `${v.title} ${v.section} ${v.channel ?? ''} ${v.notes ?? ''}`
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
  activeRef.current = active

  const totals = useMemo(() => {
    const n = videoLibrary.length
    if (!n) return { n: 0, avg: 0, done: 0, leftSec: 0 }
    const avg = Math.round(videoLibrary.reduce((s, v) => s + v.pct, 0) / n)
    const done = videoLibrary.filter((v) => v.pct >= 90).length
    const leftSec = videoLibrary.reduce((s, v) => {
      if (!v.durationSec || v.pct >= 90) return s
      return s + Math.max(0, v.durationSec - v.watchedSec)
    }, 0)
    return { n, avg, done, leftSec }
  }, [videoLibrary])

  // Auto-fetch YouTube title + channel when a valid link is pasted
  useEffect(() => {
    const id = parseYouTubeId(url)
    if (!id) {
      setLookupState('idle')
      return
    }
    let cancelled = false
    setLookupState('loading')
    const t = window.setTimeout(() => {
      void fetchYoutubeDetails(url).then((meta) => {
        if (cancelled) return
        if (!meta) {
          setLookupState('fail')
          return
        }
        setLookupState('ok')
        if (!titleTouched.current) {
          setTitle(meta.title)
        }
        if (meta.channel) setChannel(meta.channel)
      })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [url])

  useEffect(() => {
    setLivePct(null)
  }, [activeId])

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
      channel: channel.trim() || undefined,
    })
    if (!created) {
      setError('Could not save that video.')
      return
    }
    setTitle('')
    setUrl('')
    setChannel('')
    setNotesDraft('')
    setCustomSection('')
    titleTouched.current = false
    setLookupState('idle')
    setComposerOpen(false)
    setActiveId(created.id)
  }

  const refreshMeta = async (v: VideoEntry) => {
    if (!v.videoId && !v.url) return
    const meta = await fetchYoutubeDetails(v.videoId || v.url)
    if (!meta) return
    updateVideo(v.id, {
      title: v.title.trim() ? v.title : meta.title,
      channel: meta.channel || v.channel,
    })
  }

  const renderThumbCard = (v: VideoEntry, compact = false) => {
    const thumb = v.videoId ? youtubeThumbnailUrl(v.videoId) : null
    const done = v.pct >= 90
    const left =
      v.durationSec && v.pct < 90
        ? Math.max(0, v.durationSec - v.watchedSec)
        : null
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
          {left != null && left > 0 && !done && (
            <span className="yt-badge left">{formatDuration(left)} left</span>
          )}
        </button>

        <div className="yt-card-body">
          <p className="yt-card-section">{v.section}</p>
          <h3 className="yt-card-title">{v.title}</h3>
          {v.channel && <p className="yt-card-channel">{v.channel}</p>}
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
                updateVideo(v.id, {
                  pct: done ? 0 : 100,
                  watchedSec: done ? 0 : v.durationSec ?? v.watchedSec,
                })
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
            {!v.channel && (
              <button
                type="button"
                className="ghost"
                onClick={() => void refreshMeta(v)}
              >
                Fetch info
              </button>
            )}
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

          <details
            className="yt-manual-details"
            open={manualOpenId === v.id}
            onToggle={(e) => {
              const open = (e.target as HTMLDetailsElement).open
              setManualOpenId(open ? v.id : manualOpenId === v.id ? null : manualOpenId)
            }}
          >
            <summary>Watched outside ExamPulse? Adjust %</summary>
            <label className="video-manual yt-manual">
              <span>Set progress</span>
              <input
                type="range"
                min={0}
                max={100}
                value={v.pct}
                onChange={(e) =>
                  updateVideo(v.id, {
                    pct: Number(e.target.value),
                    watchedSec:
                      v.durationSec != null
                        ? (Number(e.target.value) / 100) * v.durationSec
                        : v.watchedSec,
                  })
                }
              />
            </label>
          </details>

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

  const displayPct = livePct ?? active?.pct ?? 0

  return (
    <div className="videos-page yt-library">
      <header className="section-head stack">
        <div>
          <h1>YouTube library</h1>
          <p className="lede">
            Paste a link — title and channel fill in from YouTube. Watch here and
            progress updates automatically from the player.
          </p>
        </div>
        <div className="yt-header-actions">
          {totals.n > 0 && (
            <p className="videos-summary">
              {totals.n} videos · avg {totals.avg}% · {totals.done} done
              {totals.leftSec > 0
                ? ` · ~${formatDuration(totals.leftSec)} left`
                : ''}
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
            <label className="video-url-field">
              <span>YouTube link</span>
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  titleTouched.current = false
                }}
                placeholder="https://youtu.be/… or youtube.com/watch?v=…"
                autoFocus
              />
              {lookupState === 'loading' && (
                <em className="yt-lookup">Fetching title from YouTube…</em>
              )}
              {lookupState === 'ok' && (
                <em className="yt-lookup ok">Details loaded from YouTube</em>
              )}
              {lookupState === 'fail' && (
                <em className="yt-lookup fail">
                  Couldn’t fetch details — type a title manually.
                </em>
              )}
            </label>
            <label>
              <span>Topic / title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  titleTouched.current = true
                  setTitle(e.target.value)
                }}
                placeholder="Auto-fills from the link"
                maxLength={120}
              />
            </label>
            <label>
              <span>Channel</span>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Auto-fills from YouTube"
                maxLength={80}
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
              placeholder="Search title, channel, section, notes…"
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
              <p className="muted-line">
                {active.section}
                {active.channel ? ` · ${active.channel}` : ''}
              </p>
              <h2>{active.title}</h2>
            </div>
            <div className="yt-watch-actions">
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  updateVideo(active.id, {
                    pct: 100,
                    watchedSec: active.durationSec ?? active.watchedSec,
                  })
                }
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
            startSeconds={
              active.pct >= 90
                ? 0
                : Math.max(0, active.watchedSec - 3)
            }
            initialPeakSec={active.watchedSec}
            onProgress={({ watchedSec, durationSec, pct }) => {
              setLivePct(pct)
              const cur = activeRef.current
              if (!cur || cur.id !== active.id) return
              if (
                pct > cur.pct ||
                watchedSec > cur.watchedSec + 1 ||
                (durationSec && durationSec !== cur.durationSec)
              ) {
                updateVideo(cur.id, {
                  watchedSec,
                  durationSec,
                  pct: Math.max(cur.pct, pct),
                })
              }
            }}
          />
          <div className="video-progress-row">
            <div className="video-progress-track" aria-hidden>
              <span style={{ width: `${displayPct}%` }} />
            </div>
            <span>
              <span className="yt-auto-pill">Auto</span>
              {displayPct}% watched
              {active.durationSec
                ? ` · ${formatDuration(
                    Math.max(active.watchedSec, (displayPct / 100) * active.durationSec),
                  )} / ${formatDuration(active.durationSec)}`
                : ''}
            </span>
          </div>
          <p className="muted-line video-progress-hint">
            Progress is read live from the YouTube player (time watched ÷ length).
            YouTube doesn’t share watch history from the YouTube app — use
            “Adjust %” on a card only if you finished it elsewhere.
          </p>
        </section>
      )}

      {continueWatching.length > 0 &&
        filter === 'All' &&
        !query &&
        status === 'All' && (
          <section className="yt-continue" aria-label="Continue watching">
            <h2 className="roadmap-section-title">Continue watching</h2>
            <div className="yt-grid">
              {continueWatching.map((v) => renderThumbCard(v, true))}
            </div>
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
