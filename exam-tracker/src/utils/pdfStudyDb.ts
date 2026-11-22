import type {
  PdfBookmark,
  PdfDocMeta,
  PdfStroke,
} from './pdfStudy'

const DB_NAME = 'exampulse-pdf-study-v1'
const DB_VERSION = 1
const META = 'docs'
const BLOBS = 'blobs'
const INK = 'ink'
const MARKS = 'bookmarks'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(BLOBS)) {
        db.createObjectStore(BLOBS) // key = docId, value = Blob
      }
      if (!db.objectStoreNames.contains(INK)) {
        db.createObjectStore(INK) // key = docId, value = PdfStroke[]
      }
      if (!db.objectStoreNames.contains(MARKS)) {
        db.createObjectStore(MARKS) // key = docId, value = PdfBookmark[]
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('PDF IDB open failed'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('PDF IDB request failed'))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('PDF IDB tx failed'))
    tx.onabort = () => reject(tx.error ?? new Error('PDF IDB tx aborted'))
  })
}

export async function listPdfDocs(): Promise<PdfDocMeta[]> {
  const db = await openDb()
  const tx = db.transaction(META, 'readonly')
  const rows = await reqToPromise(tx.objectStore(META).getAll())
  await txDone(tx)
  db.close()
  return (rows as PdfDocMeta[]).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

export async function getPdfBlob(id: string): Promise<Blob | null> {
  const db = await openDb()
  const tx = db.transaction(BLOBS, 'readonly')
  const row = await reqToPromise(tx.objectStore(BLOBS).get(id))
  await txDone(tx)
  db.close()
  return (row as Blob) ?? null
}

export async function getPdfInk(id: string): Promise<PdfStroke[]> {
  const db = await openDb()
  const tx = db.transaction(INK, 'readonly')
  const row = await reqToPromise(tx.objectStore(INK).get(id))
  await txDone(tx)
  db.close()
  return Array.isArray(row) ? (row as PdfStroke[]) : []
}

export async function getPdfBookmarks(id: string): Promise<PdfBookmark[]> {
  const db = await openDb()
  const tx = db.transaction(MARKS, 'readonly')
  const row = await reqToPromise(tx.objectStore(MARKS).get(id))
  await txDone(tx)
  db.close()
  const list = Array.isArray(row) ? (row as PdfBookmark[]) : []
  return list.sort((a, b) => a.page - b.page || a.name.localeCompare(b.name))
}

export async function putPdfDoc(
  meta: PdfDocMeta,
  blob: Blob,
  strokes: PdfStroke[] = [],
  bookmarks: PdfBookmark[] = [],
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([META, BLOBS, INK, MARKS], 'readwrite')
  tx.objectStore(META).put(meta)
  tx.objectStore(BLOBS).put(blob, meta.id)
  tx.objectStore(INK).put(strokes, meta.id)
  tx.objectStore(MARKS).put(bookmarks, meta.id)
  await txDone(tx)
  db.close()
}

export async function updatePdfMeta(meta: PdfDocMeta): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(META, 'readwrite')
  tx.objectStore(META).put(meta)
  await txDone(tx)
  db.close()
}

export async function savePdfInk(id: string, strokes: PdfStroke[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([INK, META], 'readwrite')
  tx.objectStore(INK).put(strokes, id)
  const meta = (await reqToPromise(
    tx.objectStore(META).get(id),
  )) as PdfDocMeta | undefined
  if (meta) {
    tx.objectStore(META).put({
      ...meta,
      updatedAt: new Date().toISOString(),
    })
  }
  await txDone(tx)
  db.close()
}

export async function savePdfBookmarks(
  id: string,
  bookmarks: PdfBookmark[],
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([MARKS, META], 'readwrite')
  tx.objectStore(MARKS).put(bookmarks, id)
  const meta = (await reqToPromise(
    tx.objectStore(META).get(id),
  )) as PdfDocMeta | undefined
  if (meta) {
    tx.objectStore(META).put({
      ...meta,
      updatedAt: new Date().toISOString(),
    })
  }
  await txDone(tx)
  db.close()
}

export async function deletePdfDoc(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([META, BLOBS, INK, MARKS], 'readwrite')
  tx.objectStore(META).delete(id)
  tx.objectStore(BLOBS).delete(id)
  tx.objectStore(INK).delete(id)
  tx.objectStore(MARKS).delete(id)
  await txDone(tx)
  db.close()
}
