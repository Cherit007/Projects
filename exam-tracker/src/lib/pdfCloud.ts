import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { deleteObject, getBlob, ref, uploadBytes } from 'firebase/storage'
import type {
  PdfBookmark,
  PdfDocMeta,
  PdfStickyNote,
  PdfStroke,
} from '../utils/pdfStudy'
import {
  getPdfBlob,
  getPdfNotes,
  listPdfDocs,
  putPdfDoc,
} from '../utils/pdfStudyDb'
import { getFirebaseDb, getFirebaseStorage } from './firebase'

type CloudPdfMeta = PdfDocMeta & {
  strokes?: PdfStroke[]
  bookmarks?: PdfBookmark[]
  notes?: PdfStickyNote[]
  deleted?: boolean
}

function metaDoc(uid: string, docId: string) {
  const db = getFirebaseDb()
  if (!db) return null
  return doc(db, 'users', uid, 'pdfDocs', docId)
}

function fileRef(uid: string, docId: string) {
  const storage = getFirebaseStorage()
  if (!storage) return null
  return ref(storage, `users/${uid}/pdfs/${docId}/file.pdf`)
}

export async function pushPdfToCloud(
  uid: string,
  meta: PdfDocMeta,
  blob: Blob,
  strokes: PdfStroke[],
  bookmarks: PdfBookmark[],
  notes: PdfStickyNote[] = [],
): Promise<void> {
  const fr = fileRef(uid, meta.id)
  const mr = metaDoc(uid, meta.id)
  if (!fr || !mr) throw new Error('Cloud PDF storage unavailable')

  // Avoid huge Firestore docs — strip cover from cloud meta
  const { coverDataUrl: _c, ...cloudMeta } = meta
  await uploadBytes(fr, blob, { contentType: 'application/pdf' })
  await setDoc(
    mr,
    {
      ...cloudMeta,
      strokes,
      bookmarks,
      notes,
      deleted: false,
    } satisfies CloudPdfMeta,
    { merge: true },
  )
}

export async function pushPdfMarksToCloud(
  uid: string,
  meta: PdfDocMeta,
  strokes: PdfStroke[],
  bookmarks: PdfBookmark[],
  notes: PdfStickyNote[] = [],
): Promise<void> {
  const mr = metaDoc(uid, meta.id)
  if (!mr) throw new Error('Cloud PDF storage unavailable')
  const { coverDataUrl: _c, ...cloudMeta } = meta
  await setDoc(
    mr,
    {
      ...cloudMeta,
      strokes,
      bookmarks,
      notes,
      deleted: false,
    } satisfies CloudPdfMeta,
    { merge: true },
  )
}

async function pullOne(
  uid: string,
  docId: string,
  data: CloudPdfMeta,
): Promise<boolean> {
  if (data.deleted) return false
  const fr = fileRef(uid, docId)
  if (!fr) return false
  const blob = await getBlob(fr)
  const { strokes = [], bookmarks = [], notes = [], deleted: _d, ...rest } =
    data
  const meta = rest as PdfDocMeta
  await putPdfDoc(
    meta,
    blob,
    Array.isArray(strokes) ? strokes : [],
    Array.isArray(bookmarks) ? bookmarks : [],
    Array.isArray(notes) ? notes : [],
  )
  return true
}

export async function syncPdfsFromCloud(uid: string): Promise<number> {
  const db = getFirebaseDb()
  if (!db) return 0
  const snap = await getDocs(collection(db, 'users', uid, 'pdfDocs'))
  const local = await listPdfDocs()
  const localMap = new Map(local.map((d) => [d.id, d]))
  let imported = 0

  for (const row of snap.docs) {
    const data = row.data() as CloudPdfMeta
    if (data.deleted) continue
    const existing = localMap.get(row.id)
    if (existing && existing.updatedAt >= (data.updatedAt || '')) continue
    try {
      const ok = await pullOne(uid, row.id, { ...data, id: row.id })
      if (ok) imported += 1
    } catch (e) {
      console.warn('PDF cloud pull failed', row.id, e)
    }
  }
  return imported
}

export async function deletePdfFromCloud(
  uid: string,
  docId: string,
): Promise<void> {
  const mr = metaDoc(uid, docId)
  const fr = fileRef(uid, docId)
  if (mr) {
    try {
      await deleteDoc(mr)
    } catch {
      await setDoc(mr, { deleted: true }, { merge: true })
    }
  }
  if (fr) await deleteObject(fr).catch(() => undefined)
}

export async function ensurePdfCloudBackup(
  uid: string,
  docId: string,
  strokes: PdfStroke[],
  bookmarks: PdfBookmark[],
  notes?: PdfStickyNote[],
): Promise<'ok' | 'skipped' | 'error'> {
  try {
    const meta = (await listPdfDocs()).find((d) => d.id === docId)
    if (!meta) return 'skipped'
    const blob = await getPdfBlob(docId)
    if (!blob) return 'skipped'
    const noteList = notes ?? (await getPdfNotes(docId))
    const mr = metaDoc(uid, docId)
    if (mr) {
      const snap = await getDoc(mr)
      if (snap.exists()) {
        const remote = snap.data() as CloudPdfMeta
        if (!remote.deleted && (remote.updatedAt || '') >= meta.updatedAt) {
          await pushPdfMarksToCloud(uid, meta, strokes, bookmarks, noteList)
          return 'ok'
        }
      }
    }
    await pushPdfToCloud(uid, meta, blob, strokes, bookmarks, noteList)
    return 'ok'
  } catch (e) {
    console.warn('PDF cloud backup failed', e)
    return 'error'
  }
}
