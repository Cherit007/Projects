import type { BankQuestion, PracticeAttempt } from './questionBank'

const DB_NAME = 'exampulse-qbank-v1'
const DB_VERSION = 1
const Q_STORE = 'questions'
const A_STORE = 'attempts'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(Q_STORE)) {
        const qs = db.createObjectStore(Q_STORE, { keyPath: 'id' })
        qs.createIndex('topicId', 'topicId', { unique: false })
      }
      if (!db.objectStoreNames.contains(A_STORE)) {
        const as = db.createObjectStore(A_STORE, { keyPath: 'id' })
        as.createIndex('topicId', 'topicId', { unique: false })
        as.createIndex('status', 'status', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'))
  })
}

export async function listQuestions(): Promise<BankQuestion[]> {
  const db = await openDb()
  const tx = db.transaction(Q_STORE, 'readonly')
  const rows = await reqToPromise(tx.objectStore(Q_STORE).getAll())
  await txDone(tx)
  db.close()
  return (rows as BankQuestion[]).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

export async function putQuestion(q: BankQuestion): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(Q_STORE, 'readwrite')
  tx.objectStore(Q_STORE).put(q)
  await txDone(tx)
  db.close()
}

export async function deleteQuestion(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(Q_STORE, 'readwrite')
  tx.objectStore(Q_STORE).delete(id)
  await txDone(tx)
  db.close()
}

export async function getQuestionsByIds(ids: string[]): Promise<BankQuestion[]> {
  if (!ids.length) return []
  const db = await openDb()
  const tx = db.transaction(Q_STORE, 'readonly')
  const store = tx.objectStore(Q_STORE)
  const rows = await Promise.all(ids.map((id) => reqToPromise(store.get(id))))
  await txDone(tx)
  db.close()
  const map = new Map(
    (rows.filter(Boolean) as BankQuestion[]).map((q) => [q.id, q]),
  )
  return ids.map((id) => map.get(id)).filter(Boolean) as BankQuestion[]
}

export async function listAttempts(): Promise<PracticeAttempt[]> {
  const db = await openDb()
  const tx = db.transaction(A_STORE, 'readonly')
  const rows = await reqToPromise(tx.objectStore(A_STORE).getAll())
  await txDone(tx)
  db.close()
  return (rows as PracticeAttempt[]).sort((a, b) =>
    (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt),
  )
}

export async function getAttempt(id: string): Promise<PracticeAttempt | null> {
  const db = await openDb()
  const tx = db.transaction(A_STORE, 'readonly')
  const row = await reqToPromise(tx.objectStore(A_STORE).get(id))
  await txDone(tx)
  db.close()
  return (row as PracticeAttempt) ?? null
}

export async function putAttempt(a: PracticeAttempt): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(A_STORE, 'readwrite')
  tx.objectStore(A_STORE).put(a)
  await txDone(tx)
  db.close()
}

export async function deleteAttempt(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(A_STORE, 'readwrite')
  tx.objectStore(A_STORE).delete(id)
  await txDone(tx)
  db.close()
}
