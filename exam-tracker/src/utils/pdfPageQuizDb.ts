import type {
  PdfPageExtractCache,
  PdfQuizDocStore,
  PdfQuizSession,
} from './pdfPageQuiz'

const DB_NAME = 'exampulse-pdf-quiz-v1'
const DB_VERSION = 1
const STORES = {
  docs: 'quizDocs',
  pages: 'pageExtracts',
  sessions: 'quizSessions',
} as const

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORES.docs)) {
        db.createObjectStore(STORES.docs, { keyPath: 'docId' })
      }
      if (!db.objectStoreNames.contains(STORES.pages)) {
        db.createObjectStore(STORES.pages, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        db.createObjectStore(STORES.sessions, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('quiz db open failed'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('quiz db request failed'))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('quiz db tx failed'))
    tx.onabort = () => reject(tx.error ?? new Error('quiz db tx aborted'))
  })
}

export async function getQuizStore(
  docId: string,
): Promise<PdfQuizDocStore | null> {
  const db = await openDb()
  const tx = db.transaction(STORES.docs, 'readonly')
  const row = await reqToPromise(tx.objectStore(STORES.docs).get(docId))
  await txDone(tx)
  db.close()
  return (row as PdfQuizDocStore) ?? null
}

export async function putQuizStore(store: PdfQuizDocStore): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORES.docs, 'readwrite')
  tx.objectStore(STORES.docs).put(store)
  await txDone(tx)
  db.close()
}

export function pageExtractId(
  docId: string,
  page: number,
  kind: 'questions' | 'solutions',
) {
  return `${docId}:${page}:${kind}`
}

export async function getPageExtract(
  docId: string,
  page: number,
  kind: 'questions' | 'solutions',
): Promise<PdfPageExtractCache | null> {
  const db = await openDb()
  const tx = db.transaction(STORES.pages, 'readonly')
  const row = await reqToPromise(
    tx.objectStore(STORES.pages).get(pageExtractId(docId, page, kind)),
  )
  await txDone(tx)
  db.close()
  return (row as PdfPageExtractCache) ?? null
}

export async function putPageExtract(
  row: PdfPageExtractCache,
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORES.pages, 'readwrite')
  tx.objectStore(STORES.pages).put(row)
  await txDone(tx)
  db.close()
}

export async function putQuizSession(session: PdfQuizSession): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORES.sessions, 'readwrite')
  tx.objectStore(STORES.sessions).put(session)
  await txDone(tx)
  db.close()
}

export async function getQuizSession(
  id: string,
): Promise<PdfQuizSession | null> {
  const db = await openDb()
  const tx = db.transaction(STORES.sessions, 'readonly')
  const row = await reqToPromise(tx.objectStore(STORES.sessions).get(id))
  await txDone(tx)
  db.close()
  return (row as PdfQuizSession) ?? null
}
