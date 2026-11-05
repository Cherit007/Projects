/** Named study queues of library video ids (ordered). */

export type VideoQueue = {
  id: string
  name: string
  videoIds: string[]
  createdAt: string
  updatedAt: string
}

export function normalizeVideoQueues(raw: unknown): VideoQueue[] {
  if (!Array.isArray(raw)) return []
  const out: VideoQueue[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const q = item as Partial<VideoQueue>
    if (typeof q.id !== 'string' || !q.id) continue
    const name = typeof q.name === 'string' ? q.name.trim().slice(0, 80) : ''
    if (!name) continue
    const videoIds = Array.isArray(q.videoIds)
      ? q.videoIds.filter((id): id is string => typeof id === 'string' && !!id)
      : []
    out.push({
      id: q.id,
      name,
      videoIds,
      createdAt:
        typeof q.createdAt === 'string' ? q.createdAt : new Date().toISOString(),
      updatedAt:
        typeof q.updatedAt === 'string' ? q.updatedAt : new Date().toISOString(),
    })
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function mergeVideoQueues(
  local: VideoQueue[],
  cloud: VideoQueue[],
): VideoQueue[] {
  const map = new Map<string, VideoQueue>()
  for (const q of cloud) map.set(q.id, q)
  for (const q of local) {
    const other = map.get(q.id)
    if (!other) {
      map.set(q.id, q)
      continue
    }
    const newer = q.updatedAt >= other.updatedAt ? q : other
    map.set(q.id, {
      ...other,
      ...newer,
      // Prefer longer ordered list when timestamps tie
      videoIds:
        q.updatedAt === other.updatedAt
          ? q.videoIds.length >= other.videoIds.length
            ? q.videoIds
            : other.videoIds
          : newer.videoIds,
    })
  }
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
