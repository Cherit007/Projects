import { useCallback, useEffect, useState } from 'react'
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

export function usePdfStudy() {
  const [docs, setDocs] = useState<PdfDocMeta[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setDocs(await listPdfDocs())
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
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
  }, [refresh])

  const addPdf = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Please choose a PDF file')
    }
    // Soft guard — keep browser storage healthy
    if (file.size > 80 * 1024 * 1024) {
      throw new Error('PDF is larger than 80MB — try a smaller file')
    }
    const now = new Date().toISOString()
    const meta: PdfDocMeta = {
      id: newPdfId('pdf'),
      name: file.name.replace(/\.pdf$/i, '') || 'Untitled PDF',
      sizeBytes: file.size,
      pageCount: null,
      lastPage: 1,
      zoom: 1.15,
      createdAt: now,
      updatedAt: now,
    }
    await putPdfDoc(meta, file, [], [])
    setDocs((prev) => [meta, ...prev])
    return meta
  }, [])

  const removePdf = useCallback(async (id: string) => {
    await deletePdfDoc(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const renamePdf = useCallback(async (id: string, name: string) => {
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
  }, [docs])

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
    const meta = (await listPdfDocs()).find((d) => d.id === id) ?? null
    if (!meta) return null
    const [blob, strokes, bookmarks] = await Promise.all([
      getPdfBlob(id),
      getPdfInk(id),
      getPdfBookmarks(id),
    ])
    if (!blob) return null
    return { meta, blob, strokes, bookmarks }
  }, [])

  const persistInk = useCallback(async (id: string, strokes: PdfStroke[]) => {
    await savePdfInk(id, strokes)
  }, [])

  const persistBookmarks = useCallback(
    async (id: string, bookmarks: PdfBookmark[]) => {
      await savePdfBookmarks(id, bookmarks)
    },
    [],
  )

  return {
    ready,
    error,
    docs,
    refresh,
    addPdf,
    removePdf,
    renamePdf,
    touchMeta,
    loadReader,
    persistInk,
    persistBookmarks,
  }
}
