/** User-curated YouTube study videos with watch progress. */

export type VideoEntry = {
  id: string
  /** Freeform topic label, e.g. "Vocab – root words" */
  title: string
  /** Bucket, e.g. "English", "Quant · DI" */
  section: string
  url: string
  /** Parsed YouTube id when URL is valid */
  videoId: string | null
  /** Channel / uploader from YouTube oEmbed when known */
  channel?: string
  /** Optional links to ExamPulse syllabus topic ids */
  topicIds?: string[]
  /** Longest continuous position reached (seconds) */
  watchedSec: number
  /** Peak watch percent 0–100 */
  pct: number
  /** Duration from player when known */
  durationSec: number | null
  /** When first marked done (≥90%) */
  completedAt?: string
  /** ISO date (yyyy-mm-dd) when a spaced rewatch is due */
  rewatchDue?: string
  /** Last spaced interval used (3 / 7 / 21) */
  rewatchInterval?: number
  createdAt: string
  updatedAt: string
  notes?: string
}

export type YoutubeOEmbed = {
  title: string
  channel: string
  thumbnailUrl?: string
}

/** Pull title + channel from YouTube (no API key). Browser CORS OK. */
export async function fetchYoutubeDetails(
  urlOrId: string,
): Promise<YoutubeOEmbed | null> {
  const id = parseYouTubeId(urlOrId)
  if (!id) return null
  const watch = youtubeWatchUrl(id)
  const endpoints = [
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(watch)}`,
  ]
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint)
      if (!res.ok) continue
      const data = (await res.json()) as {
        title?: string
        author_name?: string
        thumbnail_url?: string
        error?: string
      }
      if (data.error || !data.title) continue
      return {
        title: data.title.trim().slice(0, 120),
        channel: (data.author_name ?? '').trim().slice(0, 80),
        thumbnailUrl: data.thumbnail_url,
      }
    } catch {
      /* try next */
    }
  }
  return null
}

const YT_HOST =
  /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i

/** Extract 11-char video id from common YouTube URL shapes. */
export function parseYouTubeId(raw: string): string | null {
  const input = raw.trim()
  if (!input) return null
  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`
    const u = new URL(withProto)
    if (!YT_HOST.test(u.hostname)) {
      // bare id
      if (/^[\w-]{11}$/.test(input)) return input
      return null
    }
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    const v = u.searchParams.get('v')
    if (v && /^[\w-]{11}$/.test(v)) return v
    const parts = u.pathname.split('/').filter(Boolean)
    const embedIdx = parts.findIndex((p) => p === 'embed' || p === 'shorts' || p === 'live')
    if (embedIdx >= 0 && parts[embedIdx + 1] && /^[\w-]{11}$/.test(parts[embedIdx + 1])) {
      return parts[embedIdx + 1]
    }
    return null
  } catch {
    return /^[\w-]{11}$/.test(input) ? input : null
  }
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/** Extract playlist id (PL… / UU… / OL…) from playlist or watch?list= URLs. */
export function parseYouTubePlaylistId(raw: string): string | null {
  const input = raw.trim()
  if (!input) return null
  if (/^(PL|UU|OL|RD)[\w-]{10,}$/i.test(input)) return input
  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`
    const u = new URL(withProto)
    if (!YT_HOST.test(u.hostname)) return null
    const list = u.searchParams.get('list')
    if (list && /^(PL|UU|OL|RD)[\w-]{10,}$/i.test(list)) return list
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'playlist')
    if (idx >= 0) {
      const fromPath = u.searchParams.get('list')
      if (fromPath && /^(PL|UU|OL|RD)[\w-]{10,}$/i.test(fromPath)) return fromPath
    }
    return null
  } catch {
    return null
  }
}

export type YoutubePlaylistItem = {
  videoId: string
  title: string
  channel?: string
  url: string
}

export type YoutubePlaylist = {
  playlistId: string
  title: string
  channel?: string
  items: YoutubePlaylistItem[]
  /** true when import may be truncated (RSS / free proxy caps) */
  truncated: boolean
}

function youtubePlaylistFeedUrl(playlistId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`
}

async function fetchPlaylistViaDataApi(
  playlistId: string,
  apiKey: string,
): Promise<YoutubePlaylist | null> {
  const items: YoutubePlaylistItem[] = []
  let title = 'YouTube playlist'
  let channel: string | undefined
  let pageToken = ''
  const maxPages = 4 // up to ~200 videos

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      part: 'snippet',
      maxResults: '50',
      playlistId,
      key: apiKey,
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
    )
    if (!res.ok) return items.length ? { playlistId, title, channel, items, truncated: false } : null
    const data = (await res.json()) as {
      nextPageToken?: string
      items?: Array<{
        snippet?: {
          title?: string
          channelTitle?: string
          videoOwnerChannelTitle?: string
          resourceId?: { videoId?: string }
        }
      }>
    }
    for (const row of data.items ?? []) {
      const sn = row.snippet
      const videoId = sn?.resourceId?.videoId
      if (!videoId || !/^[\w-]{11}$/.test(videoId)) continue
      const t = (sn?.title ?? '').trim()
      if (!t || t === 'Private video' || t === 'Deleted video') continue
      items.push({
        videoId,
        title: t.slice(0, 120),
        channel: (sn?.videoOwnerChannelTitle || sn?.channelTitle || '')
          .trim()
          .slice(0, 80) || undefined,
        url: youtubeWatchUrl(videoId),
      })
      if (!channel && sn?.channelTitle) channel = sn.channelTitle.trim().slice(0, 80)
    }
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }

  // Playlist title from playlists.list
  try {
    const metaRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${encodeURIComponent(playlistId)}&key=${encodeURIComponent(apiKey)}`,
    )
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as {
        items?: Array<{ snippet?: { title?: string; channelTitle?: string } }>
      }
      const sn = meta.items?.[0]?.snippet
      if (sn?.title) title = sn.title.trim().slice(0, 120)
      if (sn?.channelTitle) channel = sn.channelTitle.trim().slice(0, 80)
    }
  } catch {
    /* keep defaults */
  }

  if (!items.length) return null
  return { playlistId, title, channel, items, truncated: false }
}

async function fetchPlaylistViaRss(playlistId: string): Promise<YoutubePlaylist | null> {
  const feed = youtubePlaylistFeedUrl(playlistId)
  const proxy = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`
  const res = await fetch(proxy)
  if (!res.ok) return null
  const data = (await res.json()) as {
    status?: string
    feed?: { title?: string; author?: string }
    items?: Array<{
      title?: string
      link?: string
      author?: string
      guid?: string
    }>
  }
  if (data.status !== 'ok') return null
  const items: YoutubePlaylistItem[] = []
  for (const row of data.items ?? []) {
    const videoId =
      parseYouTubeId(row.link ?? '') ||
      (typeof row.guid === 'string' && row.guid.includes('yt:video:')
        ? row.guid.replace(/^yt:video:/, '')
        : null)
    if (!videoId) continue
    const t = (row.title ?? '').trim()
    if (!t) continue
    items.push({
      videoId,
      title: t.slice(0, 120),
      channel: (row.author ?? data.feed?.author ?? '').trim().slice(0, 80) || undefined,
      url: youtubeWatchUrl(videoId),
    })
  }
  if (!items.length) return null

  let title = (data.feed?.title ?? 'YouTube playlist').trim().slice(0, 120)
  let channel = (data.feed?.author ?? '').trim().slice(0, 80) || undefined
  try {
    const oe = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/playlist?list=${playlistId}`)}&format=json`,
    )
    if (oe.ok) {
      const meta = (await oe.json()) as { title?: string; author_name?: string }
      if (meta.title) title = meta.title.trim().slice(0, 120)
      if (meta.author_name) channel = meta.author_name.trim().slice(0, 80)
    }
  } catch {
    /* keep rss title */
  }

  return {
    playlistId,
    title,
    channel,
    items,
    truncated: items.length >= 10,
  }
}

/** Load playlist videos (Data API if VITE_YOUTUBE_API_KEY, else public RSS via rss2json). */
export async function fetchYoutubePlaylist(
  urlOrId: string,
): Promise<YoutubePlaylist | null> {
  const playlistId = parseYouTubePlaylistId(urlOrId)
  if (!playlistId) return null
  const apiKey = String(import.meta.env.VITE_YOUTUBE_API_KEY || '').trim()
  if (apiKey) {
    try {
      const viaApi = await fetchPlaylistViaDataApi(playlistId, apiKey)
      if (viaApi) return viaApi
    } catch {
      /* fall through to RSS */
    }
  }
  try {
    return await fetchPlaylistViaRss(playlistId)
  } catch {
    return null
  }
}

/** Public thumbnail (no API key). Falls back gracefully if video is private. */
export function youtubeThumbnailUrl(
  videoId: string,
  quality: 'hq' | 'mq' | 'sd' = 'hq',
): string {
  const q =
    quality === 'mq'
      ? 'mqdefault'
      : quality === 'sd'
        ? 'sddefault'
        : 'hqdefault'
  return `https://i.ytimg.com/vi/${videoId}/${q}.jpg`
}

export function youtubeEmbedUrl(videoId: string, origin?: string): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
  })
  if (origin) params.set('origin', origin)
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

export function normalizeVideoEntries(raw: unknown): VideoEntry[] {
  if (!Array.isArray(raw)) return []
  const out: VideoEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const v = item as Partial<VideoEntry>
    if (typeof v.id !== 'string' || !v.id) continue
    const title = typeof v.title === 'string' ? v.title.trim().slice(0, 120) : ''
    const section =
      typeof v.section === 'string' ? v.section.trim().slice(0, 64) : ''
    const url = typeof v.url === 'string' ? v.url.trim() : ''
    if (!title || !url) continue
    const videoId =
      typeof v.videoId === 'string' && v.videoId
        ? v.videoId
        : parseYouTubeId(url)
    const pct = Math.max(0, Math.min(100, Math.round(Number(v.pct) || 0)))
    const watchedSec = Math.max(0, Number(v.watchedSec) || 0)
    const durationSec =
      typeof v.durationSec === 'number' && v.durationSec > 0
        ? v.durationSec
        : null
    const topicIds = Array.isArray(v.topicIds)
      ? [...new Set(v.topicIds.filter((id): id is string => typeof id === 'string' && !!id))].slice(
          0,
          8,
        )
      : undefined
    out.push({
      id: v.id,
      title,
      section: section || 'General',
      url,
      videoId,
      channel:
        typeof v.channel === 'string' && v.channel.trim()
          ? v.channel.trim().slice(0, 80)
          : undefined,
      topicIds: topicIds?.length ? topicIds : undefined,
      watchedSec,
      pct,
      durationSec,
      completedAt:
        typeof v.completedAt === 'string' ? v.completedAt : undefined,
      rewatchDue:
        typeof v.rewatchDue === 'string' ? v.rewatchDue.slice(0, 10) : undefined,
      rewatchInterval:
        typeof v.rewatchInterval === 'number' && v.rewatchInterval > 0
          ? v.rewatchInterval
          : undefined,
      createdAt:
        typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
      updatedAt:
        typeof v.updatedAt === 'string' ? v.updatedAt : new Date().toISOString(),
      notes: typeof v.notes === 'string' ? v.notes.slice(0, 400) : undefined,
    })
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Prefer higher watch progress when ids collide. */
export function mergeVideoEntries(
  local: VideoEntry[],
  cloud: VideoEntry[],
): VideoEntry[] {
  const map = new Map<string, VideoEntry>()
  for (const v of cloud) map.set(v.id, v)
  for (const v of local) {
    const other = map.get(v.id)
    if (!other) {
      map.set(v.id, v)
      continue
    }
    const richer =
      v.pct > other.pct ||
      (v.pct === other.pct && v.watchedSec >= other.watchedSec)
        ? v
        : other
    const topicIds = [
      ...new Set([...(other.topicIds ?? []), ...(v.topicIds ?? [])]),
    ].slice(0, 8)
    map.set(v.id, {
      ...other,
      ...v,
      pct: Math.max(v.pct, other.pct),
      watchedSec: Math.max(v.watchedSec, other.watchedSec),
      durationSec: v.durationSec ?? other.durationSec,
      channel: v.channel || other.channel,
      topicIds: topicIds.length ? topicIds : undefined,
      completedAt: v.completedAt || other.completedAt,
      rewatchDue:
        v.rewatchDue && other.rewatchDue
          ? v.rewatchDue < other.rewatchDue
            ? v.rewatchDue
            : other.rewatchDue
          : v.rewatchDue || other.rewatchDue,
      rewatchInterval: Math.max(
        v.rewatchInterval ?? 0,
        other.rewatchInterval ?? 0,
      ) || undefined,
      updatedAt:
        v.updatedAt > other.updatedAt ? v.updatedAt : other.updatedAt,
      title: richer.title,
      section: richer.section,
      url: richer.url,
      videoId: richer.videoId ?? other.videoId,
    })
  }
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}h ${mm}m`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export const VIDEO_SECTION_SUGGESTIONS = [
  'English · Vocab',
  'English · Grammar',
  'English · RC',
  'Quant · Number System',
  'Quant · DI',
  'Quant · Arithmetic',
  'Reasoning · Puzzles',
  'Reasoning · Misc',
  'GA / Current Affairs',
  'Banking Awareness',
  'Computer / IT',
  'Interview',
] as const
