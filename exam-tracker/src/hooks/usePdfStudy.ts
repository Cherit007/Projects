import { useCallback, useEffect, useState } from 'react'
import {
  deletePdfFromCloud,
  ensurePdfCloudBackup,
  pushPdfMarksToCloud,
  pushPdfToCloud,
  syncPdfsFromCloud,
} from '../lib/pdfCloud'
import {
  newPdfId,
  type PdfBookmark,
  type PdfDocMeta,
  type PdfStroke,
} from '../utils/pdfStudy'
import {
  deletePdfDoc,
  getPdfBlob,
  getPdfBookmarks,
  getPdfInk,
  listPdfDocs,
  putPdfDoc,
  savePdfBookmarks,
  savePdfInk,
  updatePdfMeta,
} from '../utils/pdfStudyDb'

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist()
    }
  } catch {
    /* ignore */
  }
}

type UsePdfStudyOpts = {
  /** Pull remote PDFs into IndexedDB (library page only). */
  syncOnMount?: boolean
}

export function usePdfStudy(
  uid?: string | null,
  opts: UsePdfStudyOpts = {},
) {
  const syncOnMount = opts.syncOnMount === true
  const [docs, setDocs] = useState<PdfDocMeta[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [cloudNote, setCloudNote] = useState('')

  const refresh = useCallback(async () => {
    setDocs(await listPdfDocs())
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await requestPersistentStorage()
        if (syncOnMount && uid) {
          try {
            const n = await syncPdfsFromCloud(uid)
            if (!cancelled && n > 0) {
              setCloudNote(`Restored ${n} PDF${n === 1 ? '' : 's'} from cloud`)
            }
          } catch (e) {
            console.warn(e)
            if (!cancelled) {
              setCloudNote(
                'Cloud PDF sync unavailable — using this device storage',
              )
            }
          }
        }
        await refresh()
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load PDF desk')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, uid, syncOnMount])

  const addPdf = useCallback(
    async (file: File) => {
      if (
        file.type !== 'application/pdf' &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {
        throw new Error('Please choose a PDF file')
      }
      if (file.size > 200 * 1024 * 1024) {
        throw new Error(
          'PDF is larger than 200MB — compress it or split chapters',
        )
      }
      await requestPersistentStorage()
      const now = new Date().toISOString()
      const meta: PdfDocMeta = {
        id: newPdfId('pdf'),
        name: file.name.replace(/\.pdf$/i, '') || 'Untitled PDF',
        sizeBytes: file.size,
        pageCount: null,
        lastPage: 1,
        zoom: 1.1,
        createdAt: now,
        updatedAt: now,
      }
      await putPdfDoc(meta, file, [], [])
      // Verify round-trip so revisit won't hit a missing blob
      const check = await getPdfBlob(meta.id)
      if (!check || check.size !== file.size) {
        throw new Error('Could not verify PDF save — try again')
      }
      setDocs((prev) => [meta, ...prev])

      if (uid) {
        try {
          await pushPdfToCloud(uid, meta, file, [], [])
          setCloudNote('Uploaded to your cloud library')
        } catch (e) {
          console.warn(e)
          setCloudNote(
            'Saved on this device — cloud upload failed (sign-in / Storage rules)',
          )
        }
      } else {
        setCloudNote('Saved on this device — sign in to back up to cloud')
      }
      return meta
    },
    [uid],
  )

  const removePdf = useCallback(
    async (id: string) => {
      await deletePdfDoc(id)
      setDocs((prev) => prev.filter((d) => d.id !== id))
      if (uid) {
        void deletePdfFromCloud(uid, id)
      }
    },
    [uid],
  )

  const renamePdf = useCallback(
    async (id: string, name: string) => {
      const cleaned = name.trim().slice(0, 120)
      if (!cleaned) return
      const current = docs.find((d) => d.id === id)
      if (!current) return
      const next = {
        ...current,
        name: cleaned,
        updatedAt: new Date().toISOString(),
      }
      await updatePdfMeta(next)
      setDocs((prev) => prev.map((d) => (d.id === id ? next : d)))
      if (uid) {
        const strokes = await getPdfInk(id)
        const bookmarks = await getPdfBookmarks(id)
        void pushPdfMarksToCloud(uid, next, strokes, bookmarks).catch(
          console.warn,
        )
      }
    },
    [docs, uid],
  )

  const touchMeta = useCallback(async (patch: PdfDocMeta) => {
    await updatePdfMeta(patch)
    setDocs((prev) => {
      const i = prev.findIndex((d) => d.id === patch.id)
      if (i < 0) return [patch, ...prev]
      const next = [...prev]
      next[i] = patch
      return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    })
  }, [])

  const loadReader = useCallback(async (id: string) => {
    let meta = (await listPdfDocs()).find((d) => d.id === id) ?? null
    let blob = await getPdfBlob(id)
    let strokes = await getPdfInk(id)
    let bookmarks = await getPdfBookmarks(id)

    // If local blob missing but user signed in, try cloud
    if ((!meta || !blob) && uid) {
      const n = await syncPdfsFromCloud(uid)
      if (n >= 0) {
        meta = (await listPdfDocs()).find((d) => d.id === id) ?? null
        blob = await getPdfBlob(id)
        strokes = await getPdfInk(id)
        bookmarks = await getPdfBookmarks(id)
      }
    }

    if (!meta || !blob) return null
    return { meta, blob, strokes, bookmarks }
  }, [uid])

  const persistInk = useCallback(async (id: string, strokes: PdfStroke[]) => {
    await savePdfInk(id, strokes)
  }, [])

  const persistBookmarks = useCallback(
    async (id: string, bookmarks: PdfBookmark[]) => {
      await savePdfBookmarks(id, bookmarks)
    },
    [],
  )

  const backupToCloud = useCallback(
    async (
      id: string,
      strokes: PdfStroke[],
      bookmarks: PdfBookmark[],
    ): Promise<'ok' | 'skipped' | 'error' | 'signed-out'> => {
      if (!uid) return 'signed-out'
      return ensurePdfCloudBackup(uid, id, strokes, bookmarks)
    },
    [uid],
  )

  return {
    ready,
    error,
    cloudNote,
    docs,
    refresh,
    addPdf,
    removePdf,
    renamePdf,
    touchMeta,
    loadReader,
    persistInk,
    persistBookmarks,
    backupToCloud,
  }
}
