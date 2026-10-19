import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getFirebaseDb } from './firebase'
import type { AppState, ErrorEntry, MockScore } from '../hooks/useProgress'
import type { RevisionCard } from '../utils/spacedRepetition'

let cloudUid: string | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedJson = ''

export function setCloudUser(uid: string | null) {
  cloudUid = uid
  if (!uid) lastSavedJson = ''
}

export function getCloudUser() {
  return cloudUid
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function asBoolMap(v: unknown): Record<string, boolean> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val) out[k] = true
  }
  return out
}

function asRevisionMap(v: unknown): Record<string, RevisionCard> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, RevisionCard> = {}
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const c = raw as Partial<RevisionCard>
    if (typeof c.due !== 'string') continue
    out[k] = {
      topicId: typeof c.topicId === 'string' ? c.topicId : k,
      due: c.due,
      interval: typeof c.interval === 'number' ? c.interval : 1,
      ease: typeof c.ease === 'number' ? c.ease : 2.5,
      reps: typeof c.reps === 'number' ? c.reps : 0,
    }
  }
  return out
}

export function normalizeCloudState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<AppState>
  return {
    completed: asBoolMap(p.completed),
    starred: asStringArray(p.starred),
    deprioritized: asStringArray(p.deprioritized),
    studyLog: Array.isArray(p.studyLog) ? p.studyLog : [],
    mockScores: Array.isArray(p.mockScores) ? (p.mockScores as MockScore[]) : [],
    errorLog: Array.isArray(p.errorLog) ? (p.errorLog as ErrorEntry[]) : [],
    revision: asRevisionMap(p.revision),
    focusExamId: typeof p.focusExamId === 'string' ? p.focusExamId : null,
    remindersEnabled: !!p.remindersEnabled,
    docs: asBoolMap(p.docs),
  }
}

/** Prefer union of progress; keep richer logs by id. */
export function mergeAppState(local: AppState, cloud: AppState): AppState {
  const completed = { ...cloud.completed, ...local.completed }
  const docs = { ...cloud.docs, ...local.docs }

  const starred = [...new Set([...cloud.starred, ...local.starred])]
  const deprioritized = [...new Set([...cloud.deprioritized, ...local.deprioritized])].filter(
    (id) => !starred.includes(id),
  )

  const studyMap = new Map<string, AppState['studyLog'][number]>()
  for (const e of [...cloud.studyLog, ...local.studyLog]) studyMap.set(e.id, e)
  const mockMap = new Map<string, AppState['mockScores'][number]>()
  for (const e of [...cloud.mockScores, ...local.mockScores]) mockMap.set(e.id, e)
  const errorMap = new Map<string, AppState['errorLog'][number]>()
  for (const e of [...cloud.errorLog, ...local.errorLog]) errorMap.set(e.id, e)

  const revision: Record<string, RevisionCard> = { ...cloud.revision }
  for (const [id, card] of Object.entries(local.revision)) {
    const other = revision[id]
    if (!other || card.due > other.due || card.reps >= other.reps) {
      revision[id] = card
    }
  }

  return {
    completed,
    starred,
    deprioritized,
    studyLog: [...studyMap.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200),
    mockScores: [...mockMap.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200),
    errorLog: [...errorMap.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 300),
    revision,
    focusExamId: local.focusExamId ?? cloud.focusExamId,
    remindersEnabled: local.remindersEnabled || cloud.remindersEnabled,
    docs,
  }
}

export async function pullCloudState(uid: string): Promise<AppState | null> {
  const db = getFirebaseDb()
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  return normalizeCloudState(data.app ?? data)
}

export async function pushCloudState(
  uid: string,
  state: AppState,
  meta?: { email?: string | null; displayName?: string | null },
): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return
  const json = JSON.stringify(state)
  if (json === lastSavedJson && !meta) return
  await setDoc(
    doc(db, 'users', uid),
    {
      app: state,
      ...(meta?.email ? { email: meta.email } : {}),
      ...(meta?.displayName ? { displayName: meta.displayName } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  lastSavedJson = json
}

export function scheduleCloudSave(state: AppState) {
  if (!cloudUid) return
  if (saveTimer) clearTimeout(saveTimer)
  const uid = cloudUid
  saveTimer = setTimeout(() => {
    void pushCloudState(uid, state).catch((err) => {
      console.warn('Cloud sync failed', err)
    })
  }, 700)
}

export async function flushCloudSave(
  state: AppState,
  meta?: { email?: string | null; displayName?: string | null },
) {
  if (!cloudUid) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await pushCloudState(cloudUid, state, meta)
}
