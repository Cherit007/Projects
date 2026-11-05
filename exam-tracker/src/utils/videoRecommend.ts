import type { VideoEntry } from './videoLibrary'

export type RecReason =
  | 'Same section'
  | 'Related section'
  | 'In progress'
  | 'Not started'
  | 'Shared topic'
  | 'Recently added'
  | 'Rewatch due'
  | 'Daily mix'

export type VideoRec = {
  video: VideoEntry
  reason: RecReason
  score: number
}

export type UpNextMode = 'section' | 'related' | 'all'

/** Section families used for “related” recommendations. */
const SECTION_FAMILIES: string[][] = [
  ['English · Vocab', 'English · Grammar', 'English · RC'],
  ['Quant · Number System', 'Quant · DI', 'Quant · Arithmetic'],
  ['Reasoning · Puzzles', 'Reasoning · Misc'],
  ['GA / Current Affairs', 'Banking Awareness'],
  ['Computer / IT', 'Interview'],
]

function sectionFamily(section: string): string[] {
  for (const fam of SECTION_FAMILIES) {
    if (fam.includes(section)) return fam
  }
  const prefix = section.split('·')[0]?.trim().toLowerCase()
  if (!prefix) return [section]
  return SECTION_FAMILIES.find((fam) =>
    fam.some((s) => s.toLowerCase().startsWith(prefix)),
  ) ?? [section]
}

function isRelatedSection(a: string, b: string): boolean {
  if (a === b) return false
  return sectionFamily(a).includes(b)
}

function sharesTopic(a: VideoEntry, b: VideoEntry): boolean {
  const left = a.topicIds ?? []
  const right = b.topicIds ?? []
  if (!left.length || !right.length) return false
  return left.some((id) => right.includes(id))
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Spaced rewatch schedule after marking done: 3 → 7 → 21 days. */
export const REWATCH_INTERVALS = [3, 7, 21] as const

export function nextRewatchAfterDone(
  prevInterval?: number | null,
): { due: string; interval: number } {
  const prev = prevInterval ?? 0
  const next =
    REWATCH_INTERVALS.find((n) => n > prev) ??
    REWATCH_INTERVALS[REWATCH_INTERVALS.length - 1]
  return { due: daysFromNow(next), interval: next }
}

export function isRewatchDue(v: VideoEntry, today = todayIso()): boolean {
  return !!v.rewatchDue && v.rewatchDue <= today
}

/**
 * Rank library videos for the Up next rail.
 * Higher score = better next pick.
 */
export function rankUpNext(
  library: VideoEntry[],
  active: VideoEntry,
  mode: UpNextMode,
): VideoRec[] {
  const today = todayIso()
  const recs: VideoRec[] = []

  for (const v of library) {
    if (v.id === active.id || !v.videoId) continue
    if (mode === 'section' && v.section !== active.section) continue
    if (
      mode === 'related' &&
      v.section !== active.section &&
      !isRelatedSection(active.section, v.section) &&
      !sharesTopic(active, v)
    ) {
      continue
    }

    let score = 0
    let reason: RecReason = 'Recently added'

    if (v.section === active.section) {
      score += 100
      reason = 'Same section'
    } else if (isRelatedSection(active.section, v.section)) {
      score += 70
      reason = 'Related section'
    } else if (sharesTopic(active, v)) {
      score += 65
      reason = 'Shared topic'
    }

    if (v.pct > 0 && v.pct < 90) {
      score += 40
      if (reason !== 'Same section') reason = 'In progress'
    } else if (v.pct === 0) {
      score += 25
      if (score < 90) reason = 'Not started'
    } else if (v.pct >= 90) {
      if (isRewatchDue(v, today)) {
        score += 35
        reason = 'Rewatch due'
      } else {
        score -= 50 // deprioritize freshly finished
      }
    }

    if (sharesTopic(active, v) && reason === 'Same section') {
      score += 15
    }

    // Recency bump
    const age = Date.parse(v.updatedAt) || 0
    score += Math.min(10, age / 1e12)

    recs.push({ video: v, reason, score })
  }

  return recs.sort((a, b) => b.score - a.score || b.video.updatedAt.localeCompare(a.video.updatedAt))
}

/** Daily Mix: unfinished + due rewatches, capped. */
export function buildDailyMix(
  library: VideoEntry[],
  limit = 6,
): VideoRec[] {
  const today = todayIso()
  const scored: VideoRec[] = []

  for (const v of library) {
    if (!v.videoId) continue
    let score = 0
    let reason: RecReason = 'Daily mix'

    if (isRewatchDue(v, today)) {
      score += 90
      reason = 'Rewatch due'
    } else if (v.pct > 0 && v.pct < 90) {
      score += 80
      reason = 'In progress'
    } else if (v.pct === 0) {
      score += 50
      reason = 'Not started'
    } else {
      continue
    }

    // Prefer shorter remaining when known
    if (v.durationSec && v.pct < 90) {
      const left = v.durationSec * (1 - v.pct / 100)
      score += Math.max(0, 20 - left / 120)
    }

    scored.push({ video: v, reason, score })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function dueRewatches(
  library: VideoEntry[],
  today = todayIso(),
): VideoEntry[] {
  return library
    .filter((v) => isRewatchDue(v, today))
    .sort((a, b) => (a.rewatchDue ?? '').localeCompare(b.rewatchDue ?? ''))
}

/** Parse mm:ss or h:mm:ss timestamps in notes. */
export function parseNoteTimestamps(
  notes: string,
): Array<{ label: string; seconds: number; index: number }> {
  const re = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/g
  const out: Array<{ label: string; seconds: number; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(notes))) {
    const h = m[1] ? Number(m[1]) : 0
    const min = Number(m[2])
    const sec = Number(m[3])
    if (min > 59 || sec > 59) continue
    const seconds = h * 3600 + min * 60 + sec
    out.push({ label: m[0], seconds, index: m.index })
  }
  return out
}
