import { useEffect, useMemo, useRef, useState } from 'react'
import { YouTubeProgressPlayer } from '../components/YouTubeProgressPlayer'
import { useProgress } from '../hooks/useProgress'
import {
  VIDEO_SECTION_SUGGESTIONS,
  fetchYoutubeDetails,
  fetchYoutubePlaylist,
  formatDuration,
  parseYouTubeId,
  parseYouTubePlaylistId,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type VideoEntry,
  type YoutubePlaylist,
} from '../utils/videoLibrary'

type StatusFilter = 'All' | 'In progress' | 'Done' | 'Not started'
type ComposerMode = 'video' | 'playlist'

export function VideosPage() {
  const { videoLibrary, addVideo, addVideos, updateVideo, removeVideo } =
    useProgress()
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
  const [menuId, setMenuId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerMode, setComposerMode] = useState<ComposerMode>('video')
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [playlistPreview, setPlaylistPreview] = useState<YoutubePlaylist | null>(
    null,
  )
  const [playlistState, setPlaylistState] = useState<
    'idle' | 'loading' | 'ok' | 'fail'
  >('idle')
  const [playlistMsg, setPlaylistMsg] = useState('')
  const [usePlaylistTitle, setUsePlaylistTitle] = useState(true)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'ok' | 'fail'>(
    'idle',
  )
  const [livePct, setLivePct] = useState<number | null>(null)
  const titleTouched = useRef(false)
  const activeRef = useRef<VideoEntry | null>(null)
  const watchRef = useRef<HTMLElement | null>(null)

  const openWatch = (id: string) => {
    setMenuId(null)
    setActiveId(id)
  }

  const sections = useMemo(() => {
    const set = new Set<string>()
    for (const v of videoLibrary) set.add(v.section)
    return ['All', ...[...set].sort((a, b) => a.localeCompare(b))]
  }, [videoLibrary])

  const continueWatching = useMemo(() => {
    return videoLibrary
      .filter((v) => v.pct > 0 && v.pct < 90 && v.id !== activeId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8)
  }, [videoLibrary, activeId])

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

  const upNext = useMemo(() => {
    if (!active) return []
    const same = videoLibrary.filter(
      (v) =>
        v.id !== active.id &&
        v.section === active.section &&
        v.pct < 90 &&
        v.videoId,
    )
    const rest = videoLibrary.filter(
      (v) =>
        v.id !== active.id &&
        v.section !== active.section &&
        v.pct < 90 &&
        v.videoId &&
        !same.some((s) => s.id === v.id),
    )
    return [...same, ...rest].slice(0, 10)
  }, [videoLibrary, active])

  const totals = useMemo(() => {
    const n = videoLibrary.length
    if (!n) return { n: 0, avg: 0, done: 0, leftSec: 0, inProgress: 0 }
    const avg = Math.round(videoLibrary.reduce((s, v) => s + v.pct, 0) / n)
    const done = videoLibrary.filter((v) => v.pct >= 90).length
    const inProgress = videoLibrary.filter((v) => v.pct > 0 && v.pct < 90).length
    const leftSec = videoLibrary.reduce((s, v) => {
      if (!v.durationSec || v.pct >= 90) return s
      return s + Math.max(0, v.durationSec - v.watchedSec)
    }, 0)
    return { n, avg, done, leftSec, inProgress }
  }, [videoLibrary])

  const statusCounts = useMemo(() => {
    let inProgress = 0
    let done = 0
    let notStarted = 0
    for (const v of videoLibrary) {
      if (v.pct >= 90) done += 1
      else if (v.pct > 0) inProgress += 1
      else notStarted += 1
    }
    return {
      All: videoLibrary.length,
      'In progress': inProgress,
      Done: done,
      'Not started': notStarted,
    } as Record<StatusFilter, number>
  }, [videoLibrary])

  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of videoLibrary) {
      map.set(v.section, (map.get(v.section) ?? 0) + 1)
    }
    return map
  }, [videoLibrary])

  const filtersActive =
    status !== 'All' || filter !== 'All' || query.trim().length > 0

  const clearFilters = () => {
    setStatus('All')
    setFilter('All')
    setQuery('')
  }

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
        if (!titleTouched.current) setTitle(meta.title)
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

  useEffect(() => {
    if (!activeId) return
    const node = watchRef.current
    if (!node) return
    const id = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [activeId])

  // Preview playlist when URL looks valid
  useEffect(() => {
    if (composerMode !== 'playlist') return
    const id = parseYouTubePlaylistId(playlistUrl)
    if (!id) {
      setPlaylistState('idle')
      setPlaylistPreview(null)
      return
    }
    let cancelled = false
    setPlaylistState('loading')
    setPlaylistPreview(null)
    const t = window.setTimeout(() => {
      void fetchYoutubePlaylist(playlistUrl).then((pl) => {
        if (cancelled) return
        if (!pl) {
          setPlaylistState('fail')
          return
        }
        setPlaylistPreview(pl)
        setPlaylistState('ok')
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [playlistUrl, composerMode])

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
    openWatch(created.id)
  }

  const onImportPlaylist = () => {
    setError('')
    setPlaylistMsg('')
    if (!playlistPreview?.items.length) {
      setError('Paste a playlist link and wait for the preview.')
      return
    }
    const sec = (
      usePlaylistTitle && playlistPreview.title
        ? playlistPreview.title
        : customSection.trim() || section
    )
      .trim()
      .slice(0, 64)
    if (!sec) {
      setError('Pick a section for the imported videos.')
      return
    }
    const result = addVideos(
      playlistPreview.items.map((item) => ({
        title: item.title,
        section: sec,
        url: item.url,
        channel: item.channel || playlistPreview.channel,
        notes: `Playlist: ${playlistPreview.title}`,
      })),
    )
    setPlaylistMsg(
      `Imported ${result.added} video${result.added === 1 ? '' : 's'}${
        result.skipped ? ` · skipped ${result.skipped} already saved` : ''
      }${playlistPreview.truncated ? ' · recent items only (public feed limit)' : ''}.`,
    )
    if (result.added > 0) {
      setPlaylistUrl('')
      setPlaylistPreview(null)
      setPlaylistState('idle')
      setComposerOpen(false)
      if (result.created[0]) openWatch(result.created[0].id)
    }
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

  const markDone = (v: VideoEntry, done: boolean) => {
    updateVideo(v.id, {
      pct: done ? 100 : 0,
      watchedSec: done ? (v.durationSec ?? v.watchedSec) : 0,
    })
  }

  const renderUpNextRow = (v: VideoEntry, index: number) => {
    const thumb = v.videoId ? youtubeThumbnailUrl(v.videoId, 'mq') : null
    return (
      <button
        key={v.id}
        type="button"
        className="yt-upnext-row"
        onClick={() => openWatch(v.id)}
      >
        <span className="yt-upnext-index" aria-hidden>
          {index + 1}
        </span>
        <span className="yt-upnext-thumb">
          {thumb ? <img src={thumb} alt="" loading="lazy" /> : null}
          {v.pct > 0 && (
            <i className="yt-upnext-bar" style={{ width: `${v.pct}%` }} />
          )}
        </span>
        <span className="yt-upnext-copy">
          <strong>{v.title}</strong>
          <em>
            {v.section}
            {v.channel ? ` · ${v.channel}` : ''}
          </em>
          <em>
            {v.pct > 0 ? `${v.pct}%` : 'Not started'}
            {v.durationSec ? ` · ${formatDuration(v.durationSec)}` : ''}
          </em>
        </span>
      </button>
    )
  }

  const renderThumbCard = (v: VideoEntry, compact = false) => {
    const thumb = v.videoId ? youtubeThumbnailUrl(v.videoId) : null
    const done = v.pct >= 90
    const left =
      v.durationSec && v.pct < 90
        ? Math.max(0, v.durationSec - v.watchedSec)
        : null
    const menuOpen = menuId === v.id
    return (
      <article
        key={v.id}
        className={`yt-card${compact ? ' compact' : ''}${done ? ' done' : ''}${
          activeId === v.id ? ' playing' : ''
        }`}
      >
        <button
          type="button"
          className="yt-thumb"
          disabled={!v.videoId}
          onClick={() => v.videoId && openWatch(v.id)}
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
          {activeId === v.id && <span className="yt-badge now">Now</span>}
        </button>

        <div className="yt-card-body">
          <p className="yt-card-section">{v.section}</p>
          <h3 className="yt-card-title">
            <button type="button" onClick={() => v.videoId && openWatch(v.id)}>
              {v.title}
            </button>
          </h3>
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
                onClick={() => openWatch(v.id)}
              >
                {v.pct > 0 && v.pct < 90 ? 'Resume' : 'Watch'}
              </button>
            )}
            <button
              type="button"
              className="ghost"
              onClick={() => markDone(v, !done)}
            >
              {done ? 'Reset' : 'Done'}
            </button>
            <button
              type="button"
              className={`ghost${menuOpen ? ' active' : ''}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuId(menuOpen ? null : v.id)}
            >
              More
            </button>
          </div>

          {menuOpen && (
            <div className="yt-card-menu">
              <a
                href={v.videoId ? youtubeWatchUrl(v.videoId) : v.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open on YouTube ↗
              </a>
              <button
                type="button"
                onClick={() => {
                  setEditingNotesId(editingNotesId === v.id ? null : v.id)
                  setMenuId(null)
                }}
              >
                Edit notes
              </button>
              {!v.channel && (
                <button
                  type="button"
                  onClick={() => {
                    void refreshMeta(v)
                    setMenuId(null)
                  }}
                >
                  Fetch title / channel
                </button>
              )}
              <label className="yt-menu-slider">
                <span>Adjust % (watched elsewhere)</span>
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
              <button
                type="button"
                className="danger-text"
                onClick={() => {
                  if (confirm(`Remove “${v.title}”?`)) removeVideo(v.id)
                  if (activeId === v.id) setActiveId(null)
                  setMenuId(null)
                }}
              >
                Delete
              </button>
            </div>
          )}

          {editingNotesId === v.id && (
            <div className="yt-notes-edit">
              <textarea
                defaultValue={v.notes ?? ''}
                rows={3}
                placeholder="Timestamps, weak spots, what to revise…"
                onBlur={(e) => {
                  updateVideo(v.id, {
                    notes: e.target.value.trim() || undefined,
                  })
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
  const watchedLabel = active?.durationSec
    ? `${formatDuration(
        Math.max(
          active.watchedSec,
          (displayPct / 100) * active.durationSec,
        ),
      )} / ${formatDuration(active.durationSec)}`
    : null

  return (
    <div className={`videos-page yt-library${active ? ' is-watching' : ''}`}>
      <header className="section-head yt-page-head">
        <div>
          <h1>YouTube library</h1>
          {!active && (
            <p className="lede">
              Add a video or import a whole playlist. Progress updates while you
              watch here.
            </p>
          )}
        </div>
        <div className="yt-header-actions">
          {totals.n > 0 && (
            <div className="yt-stat-chips" aria-label="Library summary">
              <span>
                <strong>{totals.n}</strong> videos
              </span>
              <span>
                <strong>{totals.avg}%</strong> avg
              </span>
              <span>
                <strong>{totals.done}</strong> done
              </span>
              {totals.inProgress > 0 && (
                <span>
                  <strong>{totals.inProgress}</strong> in progress
                </span>
              )}
              {totals.leftSec > 0 && (
                <span>
                  <strong>~{formatDuration(totals.leftSec)}</strong> left
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            className="btn primary"
            onClick={() => setComposerOpen((o) => !o)}
          >
            {composerOpen ? 'Close' : 'Add'}
          </button>
        </div>
      </header>

      {composerOpen && (
        <section className="video-composer" aria-label="Add to YouTube library">
          <div className="yt-composer-top">
            <h2>{composerMode === 'playlist' ? 'Import playlist' : 'Add video'}</h2>
            <div className="yt-mode-toggle" role="tablist" aria-label="Add mode">
              <button
                type="button"
                role="tab"
                aria-selected={composerMode === 'video'}
                className={composerMode === 'video' ? 'active' : ''}
                onClick={() => {
                  setComposerMode('video')
                  setError('')
                }}
              >
                Single video
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={composerMode === 'playlist'}
                className={composerMode === 'playlist' ? 'active' : ''}
                onClick={() => {
                  setComposerMode('playlist')
                  setError('')
                }}
              >
                Playlist
              </button>
            </div>
          </div>

          {composerMode === 'video' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="video-composer-grid">
                <label className="video-url-field">
                  <span>Playlist link</span>
                  <input
                    type="url"
                    value={playlistUrl}
                    onChange={(e) => {
                      setPlaylistUrl(e.target.value)
                      setPlaylistMsg('')
                    }}
                    placeholder="youtube.com/playlist?list=PL… or watch?v=…&list=PL…"
                    autoFocus
                  />
                  {playlistState === 'loading' && (
                    <em className="yt-lookup">Loading playlist…</em>
                  )}
                  {playlistState === 'ok' && playlistPreview && (
                    <em className="yt-lookup ok">
                      Found “{playlistPreview.title}” · {playlistPreview.items.length}{' '}
                      video{playlistPreview.items.length === 1 ? '' : 's'}
                      {playlistPreview.truncated ? ' (recent items)' : ''}
                    </em>
                  )}
                  {playlistState === 'fail' && (
                    <em className="yt-lookup fail">
                      Couldn’t load that playlist — check the link is public.
                    </em>
                  )}
                </label>
                <label className="yt-check-label">
                  <input
                    type="checkbox"
                    checked={usePlaylistTitle}
                    onChange={(e) => setUsePlaylistTitle(e.target.checked)}
                  />
                  <span>Use playlist name as section</span>
                </label>
                {!usePlaylistTitle && (
                  <>
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
                  </>
                )}
              </div>

              {playlistPreview && playlistPreview.items.length > 0 && (
                <div className="yt-playlist-preview" aria-label="Playlist preview">
                  <p className="yt-playlist-preview-head">
                    Preview
                    {playlistPreview.channel
                      ? ` · ${playlistPreview.channel}`
                      : ''}
                  </p>
                  <ul>
                    {playlistPreview.items.slice(0, 8).map((item) => (
                      <li key={item.videoId}>
                        <img
                          src={youtubeThumbnailUrl(item.videoId, 'mq')}
                          alt=""
                          loading="lazy"
                        />
                        <span>{item.title}</span>
                      </li>
                    ))}
                  </ul>
                  {playlistPreview.items.length > 8 && (
                    <p className="muted-line">
                      +{playlistPreview.items.length - 8} more will import
                    </p>
                  )}
                </div>
              )}

              {error && <p className="video-error">{error}</p>}
              {playlistMsg && <p className="yt-lookup ok">{playlistMsg}</p>}
              <button
                type="button"
                className="btn primary"
                disabled={!playlistPreview?.items.length || playlistState === 'loading'}
                onClick={onImportPlaylist}
              >
                Import {playlistPreview?.items.length ?? 0} to library
              </button>
            </>
          )}
        </section>
      )}

      {active && active.videoId && (
        <section
          ref={watchRef}
          className="yt-theater"
          aria-label="Now watching"
          tabIndex={-1}
        >
          <div className="yt-theater-main">
            <div className="yt-stage">
              <YouTubeProgressPlayer
                videoId={active.videoId}
                startSeconds={
                  active.pct >= 90 ? 0 : Math.max(0, active.watchedSec - 3)
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
              <div className="yt-stage-progress" aria-hidden>
                <span style={{ width: `${displayPct}%` }} />
              </div>
            </div>

            <div className="yt-now-meta">
              <div className="yt-now-tags">
                <span className="yt-tag">{active.section}</span>
                {active.channel && (
                  <span className="yt-tag soft">{active.channel}</span>
                )}
                <span className="yt-auto-pill">Auto tracking</span>
              </div>
              <div className="yt-now-title-row">
                <h2>{active.title}</h2>
                <div className="yt-watch-actions">
                  <a
                    className="yt-action"
                    href={youtubeWatchUrl(active.videoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    YouTube ↗
                  </a>
                  <button
                    type="button"
                    className="yt-action"
                    onClick={() => markDone(active, active.pct < 90)}
                  >
                    {active.pct >= 90 ? 'Reset' : 'Mark done'}
                  </button>
                  <button
                    type="button"
                    className="yt-action solid"
                    onClick={() => setActiveId(null)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="yt-progress-panel">
                <div className="yt-progress-meta">
                  <strong>{displayPct}%</strong>
                  {watchedLabel && <span>{watchedLabel}</span>}
                  {active.durationSec && displayPct < 100 && (
                    <span className="yt-left">
                      {formatDuration(
                        Math.max(
                          0,
                          active.durationSec -
                            Math.max(
                              active.watchedSec,
                              (displayPct / 100) * active.durationSec,
                            ),
                        ),
                      )}{' '}
                      left
                    </span>
                  )}
                </div>
                <div className="video-progress-track" aria-hidden>
                  <span style={{ width: `${displayPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <aside className="yt-upnext" aria-label="Up next">
            <div className="yt-upnext-head">
              <h3>Up next</h3>
              <span>{upNext.length} queued</span>
            </div>
            <div className="yt-upnext-list">
              {upNext.length === 0 ? (
                <p className="yt-upnext-empty">All caught up — nice work.</p>
              ) : (
                upNext.map((v, i) => renderUpNextRow(v, i))
              )}
            </div>
          </aside>
        </section>
      )}

      {videoLibrary.length > 0 && !active && (
        <div className="yt-filters">
          <div className="yt-filters-top">
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
              {query && (
                <button
                  type="button"
                  className="yt-search-clear"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                >
                  ×
                </button>
              )}
            </label>
            {filtersActive && (
              <button
                type="button"
                className="yt-clear-filters"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="yt-filter-group">
            <p className="yt-filter-label">Status</p>
            <div className="yt-seg" role="tablist" aria-label="Status">
              {(
                ['All', 'In progress', 'Done', 'Not started'] as StatusFilter[]
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={status === s}
                  className={status === s ? 'active' : ''}
                  onClick={() => setStatus(s)}
                >
                  {s}
                  <em>{statusCounts[s]}</em>
                </button>
              ))}
            </div>
          </div>

          {sections.length > 1 && (
            <div className="yt-filter-group">
              <p className="yt-filter-label">Section</p>
              <div className="yt-chips" role="tablist" aria-label="Section">
                {sections.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={filter === s}
                    className={filter === s ? 'active' : ''}
                    onClick={() => setFilter(s)}
                  >
                    {s}
                    <em>
                      {s === 'All'
                        ? videoLibrary.length
                        : (sectionCounts.get(s) ?? 0)}
                    </em>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtersActive && (
            <p className="yt-filter-result">
              Showing {filtered.length} of {videoLibrary.length}
            </p>
          )}
        </div>
      )}

      {!active &&
        continueWatching.length > 0 &&
        filter === 'All' &&
        !query &&
        status === 'All' && (
          <section className="yt-continue" aria-label="Continue watching">
            <h2 className="roadmap-section-title">Continue watching</h2>
            <div className="yt-rail">
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
        !active &&
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

      {active && grouped.length > 0 && (
        <section className="yt-library-rest" aria-label="Library">
          <div className="yt-section-head">
            <h2 className="roadmap-section-title">Library</h2>
            <button
              type="button"
              className="ghost"
              onClick={() => setActiveId(null)}
            >
              Browse all
            </button>
          </div>
          <div className="yt-rail">
            {filtered.slice(0, 12).map((v) => renderThumbCard(v, true))}
          </div>
        </section>
      )}
    </div>
  )
}
