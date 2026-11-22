import { useCallback, useEffect, useState } from 'react'
import {
  deletePdfFromCloud,
  ensurePdfCloudBackup,
  pushPdfMarksToCloud,
  pushPdfToCloud,
  syncPdfsFromCloud,
} from '../lib/pdfCloud'
import {
  defaultLayers,
  newPdfId,
  normalizeMeta,
  type PdfBookmark,
  type PdfDocMeta,
  type PdfStickyNote,
  type PdfStroke,
} from '../utils/pdfStudy'
import { makePdfCover } from '../utils/pdfThumb'
import {
  deletePdfDoc,
  getPdfBlob,
  getPdfBookmarks,
  getPdfInk,
  getPdfNotes,
  listPdfDocs,
  putPdfDoc,
  savePdfBookmarks,
  savePdfInk,
  savePdfNotes,
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
    async (file: File, extras?: { folder?: string; tags?: string[] }) => {
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
      const layers = defaultLayers(now)
      let meta: PdfDocMeta = normalizeMeta({
        id: newPdfId('pdf'),
        name: file.name.replace(/\.pdf$/i, '') || 'Untitled PDF',
        sizeBytes: file.size,
        pageCount: null,
        lastPage: 1,
        zoom: 1.1,
        folder: extras?.folder || 'Unfiled',
        tags: extras?.tags || [],
        layers,
        activeLayerId: layers[0].id,
        createdAt: now,
        updatedAt: now,
      })
      const cover = await makePdfCover(file)
      if (cover) meta = { ...meta, coverDataUrl: cover }
      await putPdfDoc(meta, file, [], [], [])
      const check = await getPdfBlob(meta.id)
      if (!check || check.size !== file.size) {
        throw new Error('Could not verify PDF save — try again')
      }
      setDocs((prev) => [meta, ...prev])

      if (uid) {
        try {
          await pushPdfToCloud(uid, meta, file, [], [], [])
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
      if (uid) void deletePdfFromCloud(uid, id)
    },
    [uid],
  )

  const renamePdf = useCallback(
    async (id: string, name: string) => {
      const cleaned = name.trim().slice(0, 120)
      if (!cleaned) return
      const current = docs.find((d) => d.id === id)
      if (!current) return
      const next = normalizeMeta({
        ...current,
        name: cleaned,
        updatedAt: new Date().toISOString(),
      })
      await updatePdfMeta(next)
      setDocs((prev) => prev.map((d) => (d.id === id ? next : d)))
      if (uid) {
        const strokes = await getPdfInk(id)
        const bookmarks = await getPdfBookmarks(id)
        const notes = await getPdfNotes(id)
        void pushPdfMarksToCloud(uid, next, strokes, bookmarks, notes).catch(
          console.warn,
        )
      }
    },
    [docs, uid],
  )

  const patchDoc = useCallback(
    async (id: string, patch: Partial<PdfDocMeta>) => {
      const current = docs.find((d) => d.id === id)
      if (!current) return
      const next = normalizeMeta({
        ...current,
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      })
      await updatePdfMeta(next)
      setDocs((prev) =>
        prev
          .map((d) => (d.id === id ? next : d))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      )
      return next
    },
    [docs],
  )

  const touchMeta = useCallback(async (patch: PdfDocMeta) => {
    const next = normalizeMeta(patch)
    await updatePdfMeta(next)
    setDocs((prev) => {
      const i = prev.findIndex((d) => d.id === next.id)
      if (i < 0) return [next, ...prev]
      const copy = [...prev]
      copy[i] = next
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    })
  }, [])

  const loadReader = useCallback(
    async (id: string) => {
      let meta = (await listPdfDocs()).find((d) => d.id === id) ?? null
      let blob = await getPdfBlob(id)
      let strokes = await getPdfInk(id)
      let bookmarks = await getPdfBookmarks(id)
      let notes = await getPdfNotes(id)

      if ((!meta || !blob) && uid) {
        await syncPdfsFromCloud(uid)
        meta = (await listPdfDocs()).find((d) => d.id === id) ?? null
        blob = await getPdfBlob(id)
        strokes = await getPdfInk(id)
        bookmarks = await getPdfBookmarks(id)
        notes = await getPdfNotes(id)
      }

      if (!meta || !blob) return null
      if (!meta.coverDataUrl) {
        const cover = await makePdfCover(blob)
        if (cover) {
          meta = normalizeMeta({
            ...meta,
            coverDataUrl: cover,
            updatedAt: new Date().toISOString(),
          })
          await updatePdfMeta(meta)
        }
      }
      return {
        meta: normalizeMeta(meta),
        blob,
        strokes,
        bookmarks,
        notes,
      }
    },
    [uid],
  )

  const persistInk = useCallback(async (id: string, strokes: PdfStroke[]) => {
    await savePdfInk(id, strokes)
  }, [])

  const persistBookmarks = useCallback(
    async (id: string, bookmarks: PdfBookmark[]) => {
      await savePdfBookmarks(id, bookmarks)
    },
    [],
  )

  const persistNotes = useCallback(
    async (id: string, notes: PdfStickyNote[]) => {
      await savePdfNotes(id, notes)
    },
    [],
  )

  const backupToCloud = useCallback(
    async (
      id: string,
      strokes: PdfStroke[],
      bookmarks: PdfBookmark[],
      notes: PdfStickyNote[] = [],
    ): Promise<'ok' | 'skipped' | 'error' | 'signed-out'> => {
      if (!uid) return 'signed-out'
      return ensurePdfCloudBackup(uid, id, strokes, bookmarks, notes)
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
    patchDoc,
    touchMeta,
    loadReader,
    persistInk,
    persistBookmarks,
    persistNotes,
    backupToCloud,
  }
}
