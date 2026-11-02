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
  /** Longest continuous position reached (seconds) */
  watchedSec: number
  /** Peak watch percent 0–100 */
  pct: number
  /** Duration from player when known */
  durationSec: number | null
  createdAt: string
  updatedAt: string
  notes?: string
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
    out.push({
      id: v.id,
      title,
      section: section || 'General',
      url,
      videoId,
      watchedSec,
      pct,
      durationSec,
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
    map.set(v.id, {
      ...other,
      ...v,
      pct: Math.max(v.pct, other.pct),
      watchedSec: Math.max(v.watchedSec, other.watchedSec),
      durationSec: v.durationSec ?? other.durationSec,
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
