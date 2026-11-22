import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useAuth } from '../auth/AuthContext'
import { usePdfStudy } from '../hooks/usePdfStudy'
import {
  PDF_HIGHLIGHT_COLORS,
  PDF_PEN_COLORS,
  drawStroke,
  newPdfId,
  type PdfBookmark,
  type PdfDocMeta,
  type PdfPoint,
  type PdfStroke,
  type PdfTool,
} from '../utils/pdfStudy'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type ReaderState = 'loading' | 'ready' | 'missing' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'cloud' | 'error'
type SpreadMode = 'single' | 'double'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const clampZoom = (z: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +z.toFixed(3)))

export function PdfReaderPage() {
  const { docId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    loadReader,
    persistInk,
    persistBookmarks,
    touchMeta,
    backupToCloud,
  } = usePdfStudy(user?.uid)

  const [state, setState] = useState<ReaderState>('loading')
  const [error, setError] = useState('')
  const [meta, setMeta] = useState<PdfDocMeta | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [zoom, setZoom] = useState(1.15)
  const [spread, setSpread] = useState<SpreadMode>('single')
  const [tool, setTool] = useState<PdfTool>('pen')
  const [penColor, setPenColor] = useState<string>(PDF_PEN_COLORS[0])
  const [hiColor, setHiColor] = useState<string>(PDF_HIGHLIGHT_COLORS[0])
  const [strokes, setStrokes] = useState<PdfStroke[]>([])
  const [bookmarks, setBookmarks] = useState<PdfBookmark[]>([])
  const [undoStack, setUndoStack] = useState<PdfStroke[][]>([])
  const [bookmarkName, setBookmarkName] = useState('')
  const [sidebar, setSidebar] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [drawPage, setDrawPage] = useState(1)

  const pdfCanvasLRef = useRef<HTMLCanvasElement>(null)
  const inkCanvasLRef = useRef<HTMLCanvasElement>(null)
  const pdfCanvasRRef = useRef<HTMLCanvasElement>(null)
  const inkCanvasRRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const strokesRef = useRef<PdfStroke[]>([])
  const bookmarksRef = useRef<PdfBookmark[]>([])
  const metaRef = useRef<PdfDocMeta | null>(null)
  const pageRef = useRef(1)
  const zoomRef = useRef(1.15)
  const pageCountRef = useRef(1)
  const spreadRef = useRef<SpreadMode>('single')
  const currentStrokeRef = useRef<PdfStroke | null>(null)
  const saveTimer = useRef<number | null>(null)
  const cloudTimer = useRef<number | null>(null)
  const dirtyRef = useRef(false)
  const readyRef = useRef(false)

  const rightPage = spread === 'double' && page < pageCount ? page + 1 : null
  const visiblePages = useMemo(
    () => (rightPage ? [page, rightPage] : [page]),
    [page, rightPage],
  )
  const step = spread === 'double' ? 2 : 1

  strokesRef.current = strokes
  bookmarksRef.current = bookmarks
  metaRef.current = meta
  pageRef.current = page
  zoomRef.current = zoom
  pageCountRef.current = pageCount
  spreadRef.current = spread
  readyRef.current = state === 'ready'

  useEffect(() => {
    document.documentElement.classList.add('pdf-reader-active')
    return () => {
      document.documentElement.classList.remove('pdf-reader-active')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!docId) {
          setState('missing')
          return
        }
        const bundle = await loadReader(docId)
        if (!bundle) {
          setState('missing')
          return
        }
        const data = await bundle.blob.arrayBuffer()
        const doc = await pdfjs.getDocument({ data }).promise
        if (cancelled) {
          void doc.destroy()
          return
        }
        setMeta(bundle.meta)
        setPdf(doc)
        setPageCount(doc.numPages)
        const restoredSpread =
          bundle.meta.spread === 'double' ? 'double' : 'single'
        let startPage = Math.min(
          Math.max(1, bundle.meta.lastPage || 1),
          doc.numPages,
        )
        if (restoredSpread === 'double' && startPage % 2 === 0) {
          startPage = Math.max(1, startPage - 1)
        }
        setPage(startPage)
        setZoom(bundle.meta.zoom || 1.15)
        setSpread(restoredSpread)
        setStrokes(bundle.strokes)
        setBookmarks(bundle.bookmarks)
        setState('ready')
        setSaveStatus('saved')
        if (bundle.meta.pageCount !== doc.numPages) {
          void touchMeta({
            ...bundle.meta,
            pageCount: doc.numPages,
            updatedAt: new Date().toISOString(),
          })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to open PDF')
          setState('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [docId, loadReader, touchMeta])

  const flushLocal = useCallback(async () => {
    if (!docId || !metaRef.current || !readyRef.current) return
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    setSaveStatus('saving')
    try {
      await persistInk(docId, strokesRef.current)
      await persistBookmarks(docId, bookmarksRef.current)
      const nextMeta: PdfDocMeta = {
        ...metaRef.current,
        lastPage: pageRef.current,
        zoom: zoomRef.current,
        pageCount: pageCountRef.current,
        spread: spreadRef.current,
        updatedAt: new Date().toISOString(),
      }
      await touchMeta(nextMeta)
      setMeta(nextMeta)
      dirtyRef.current = false
      setSaveStatus('saved')
    } catch (e) {
      console.warn(e)
      setSaveStatus('error')
    }
  }, [docId, persistInk, persistBookmarks, touchMeta])

  const queueCloudBackup = useCallback(() => {
    if (!docId || !user) return
    if (cloudTimer.current) window.clearTimeout(cloudTimer.current)
    cloudTimer.current = window.setTimeout(() => {
      void (async () => {
        const result = await backupToCloud(
          docId,
          strokesRef.current,
          bookmarksRef.current,
        )
        if (result === 'ok') setSaveStatus('cloud')
        else if (result === 'error') setSaveStatus('error')
      })()
    }, 1800)
  }, [backupToCloud, docId, user])

  const queueInkSave = useCallback(
    (next: PdfStroke[]) => {
      if (!docId) return
      dirtyRef.current = true
      setSaveStatus('saving')
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        void (async () => {
          try {
            await persistInk(docId, next)
            dirtyRef.current = false
            setSaveStatus('saved')
            queueCloudBackup()
          } catch (e) {
            console.warn(e)
            setSaveStatus('error')
          }
        })()
      }, 350)
    },
    [docId, persistInk, queueCloudBackup],
  )

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' || dirtyRef.current) {
        void flushLocal()
        if (user && docId) {
          void backupToCloud(
            docId,
            strokesRef.current,
            bookmarksRef.current,
          )
        }
      }
    }
    const onPageHide = () => {
      void flushLocal()
    }
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onHide)
      void flushLocal()
      if (cloudTimer.current) window.clearTimeout(cloudTimer.current)
      if (user && docId) {
        void backupToCloud(docId, strokesRef.current, bookmarksRef.current)
      }
    }
  }, [backupToCloud, docId, flushLocal, user])

  const paintInkOn = useCallback(
    (pageNum: number, canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const w = canvas.width
      const h = canvas.height
      for (const s of strokesRef.current) {
        if (s.page !== pageNum) continue
        drawStroke(ctx, s, w, h)
      }
      if (
        currentStrokeRef.current &&
        currentStrokeRef.current.page === pageNum
      ) {
        drawStroke(ctx, currentStrokeRef.current, w, h)
      }
    },
    [],
  )

  const paintAllInk = useCallback(() => {
    paintInkOn(page, inkCanvasLRef.current)
    if (rightPage != null) paintInkOn(rightPage, inkCanvasRRef.current)
  }, [page, paintInkOn, rightPage])

  const renderPage = useCallback(
    async (
      pageNum: number,
      pdfCanvas: HTMLCanvasElement | null,
      inkCanvas: HTMLCanvasElement | null,
    ) => {
      if (!pdf || !pdfCanvas || !inkCanvas) return
      const pg = await pdf.getPage(pageNum)
      const viewport = pg.getViewport({ scale: zoom })
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      pdfCanvas.width = Math.floor(viewport.width * dpr)
      pdfCanvas.height = Math.floor(viewport.height * dpr)
      pdfCanvas.style.width = `${viewport.width}px`
      pdfCanvas.style.height = `${viewport.height}px`
      inkCanvas.width = pdfCanvas.width
      inkCanvas.height = pdfCanvas.height
      inkCanvas.style.width = `${viewport.width}px`
      inkCanvas.style.height = `${viewport.height}px`
      const ctx = pdfCanvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      await pg.render({
        canvasContext: ctx,
        viewport,
        canvas: pdfCanvas,
      }).promise
      paintInkOn(pageNum, inkCanvas)
    },
    [paintInkOn, pdf, zoom],
  )

  useEffect(() => {
    if (!pdf || state !== 'ready') return
    let cancelled = false
    void (async () => {
      await renderPage(page, pdfCanvasLRef.current, inkCanvasLRef.current)
      if (cancelled) return
      if (rightPage != null) {
        await renderPage(
          rightPage,
          pdfCanvasRRef.current,
          inkCanvasRRef.current,
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pdf, page, rightPage, zoom, state, renderPage])

  useEffect(() => {
    paintAllInk()
  }, [strokes, paintAllInk])

  // Trackpad pinch / ctrl+wheel zoom on the stage
  useEffect(() => {
    const el = wrapRef.current
    if (!el || state !== 'ready') return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.01)
      setZoom((z) => clampZoom(z * factor))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [state])

  useEffect(() => {
    if (!meta || state !== 'ready') return
    const t = window.setTimeout(() => {
      void touchMeta({
        ...meta,
        lastPage: page,
        zoom,
        pageCount,
        spread,
        updatedAt: new Date().toISOString(),
      })
    }, 600)
    return () => window.clearTimeout(t)
  }, [page, zoom, pageCount, spread]) // eslint-disable-line react-hooks/exhaustive-deps

  const normPoint = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): PdfPoint => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }

  const onPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>,
    pageNum: number,
  ) => {
    if (tool === 'hand') return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrawing(true)
    setDrawPage(pageNum)
    const color = tool === 'highlighter' ? hiColor : penColor
    const width =
      tool === 'highlighter' ? 0.028 : tool === 'eraser' ? 0.035 : 0.0045
    currentStrokeRef.current = {
      id: newPdfId('ink'),
      page: pageNum,
      tool,
      color,
      width,
      points: [normPoint(e)],
    }
    paintAllInk()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !currentStrokeRef.current) return
    currentStrokeRef.current.points.push(normPoint(e))
    paintAllInk()
  }

  const onPointerUp = () => {
    if (!currentStrokeRef.current) {
      setDrawing(false)
      return
    }
    const finished = currentStrokeRef.current
    currentStrokeRef.current = null
    setDrawing(false)
    if (finished.points.length < 2) {
      paintAllInk()
      return
    }
    setUndoStack((u) => [...u.slice(-30), strokesRef.current])
    const next = [...strokesRef.current, finished]
    setStrokes(next)
    queueInkSave(next)
  }

  const undo = () => {
    setUndoStack((u) => {
      if (!u.length) return u
      const prev = u[u.length - 1]
      setStrokes(prev)
      queueInkSave(prev)
      return u.slice(0, -1)
    })
  }

  const clearVisibleInk = () => {
    const label =
      visiblePages.length > 1
        ? `Clear marks on pages ${visiblePages[0]}–${visiblePages[1]}?`
        : 'Clear all marks on this page?'
    if (!confirm(label)) return
    setUndoStack((u) => [...u.slice(-30), strokesRef.current])
    const hide = new Set(visiblePages)
    const next = strokesRef.current.filter((s) => !hide.has(s.page))
    setStrokes(next)
    queueInkSave(next)
  }

  const addBookmark = async () => {
    const target = drawPage || page
    const name =
      bookmarkName.trim() ||
      prompt('Bookmark name', `Page ${target}`) ||
      ''
    if (!name.trim() || !docId) return
    const bm: PdfBookmark = {
      id: newPdfId('bm'),
      name: name.trim().slice(0, 80),
      page: target,
      createdAt: new Date().toISOString(),
    }
    const next = [...bookmarks, bm].sort(
      (a, b) => a.page - b.page || a.name.localeCompare(b.name),
    )
    setBookmarks(next)
    setBookmarkName('')
    setSaveStatus('saving')
    try {
      await persistBookmarks(docId, next)
      setSaveStatus('saved')
      queueCloudBackup()
    } catch {
      setSaveStatus('error')
    }
  }

  const removeBookmark = async (id: string) => {
    if (!docId) return
    const next = bookmarks.filter((b) => b.id !== id)
    setBookmarks(next)
    await persistBookmarks(docId, next)
    queueCloudBackup()
  }

  const renameBookmark = async (id: string) => {
    const bm = bookmarks.find((b) => b.id === id)
    if (!bm || !docId) return
    const name = prompt('Rename bookmark', bm.name)
    if (name == null || !name.trim()) return
    const next = bookmarks.map((b) =>
      b.id === id ? { ...b, name: name.trim().slice(0, 80) } : b,
    )
    setBookmarks(next)
    await persistBookmarks(docId, next)
    queueCloudBackup()
  }

  const goLibrary = async () => {
    await flushLocal()
    if (user && docId) {
      void backupToCloud(docId, strokesRef.current, bookmarksRef.current)
    }
    navigate('/pdf')
  }

  const jumpToPage = (n: number) => {
    const clamped = Math.min(pageCount, Math.max(1, n))
    if (spread === 'double') {
      // Snap to odd-left pairing: 1-2, 3-4, …
      const left = clamped % 2 === 0 ? clamped - 1 : clamped
      setPage(Math.max(1, left))
    } else {
      setPage(clamped)
    }
  }

  const pageInkCount = useMemo(
    () => strokes.filter((s) => visiblePages.includes(s.page)).length,
    [strokes, visiblePages],
  )

  const saveLabel =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'cloud'
        ? 'Saved · cloud'
        : saveStatus === 'error'
          ? 'Save failed'
          : saveStatus === 'saved'
            ? 'Saved'
            : ''

  const pageLabel =
    rightPage != null ? `${page}–${rightPage}` : String(page)

  if (state === 'loading') {
    return (
      <div className="pdf-reader">
        <p className="lede pdf-reader-msg">Opening PDF…</p>
      </div>
    )
  }

  if (state === 'missing' || state === 'error') {
    return (
      <div className="pdf-reader">
        <p className="lede pdf-reader-msg">
          {error || 'PDF not found — it may not be on this device yet.'}
        </p>
        <Link className="btn primary" to="/pdf">
          Back to PDF desk
        </Link>
      </div>
    )
  }

  return (
    <div className="pdf-reader">
      <header className="pdf-toolbar">
        <div className="pdf-toolbar-left">
          <button type="button" className="ghost" onClick={() => void goLibrary()}>
            Library
          </button>
          <strong className="pdf-title" title={meta?.name}>
            {meta?.name}
          </strong>
          {saveLabel && (
            <span
              className={`pdf-save-pill${saveStatus === 'error' ? ' err' : ''}`}
              aria-live="polite"
            >
              {saveLabel}
            </span>
          )}
        </div>

        <div className="pdf-toolbar-center" role="group" aria-label="Tools">
          {(
            [
              ['pen', 'Pen'],
              ['highlighter', 'Mark'],
              ['eraser', 'Erase'],
              ['hand', 'Pan'],
            ] as Array<[PdfTool, string]>
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              className={tool === t ? 'active' : ''}
              onClick={() => setTool(t)}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={undo} disabled={!undoStack.length}>
            Undo
          </button>
          <button
            type="button"
            onClick={clearVisibleInk}
            disabled={!pageInkCount}
          >
            Clear
          </button>
        </div>

        <div className="pdf-toolbar-right">
          <div className="pdf-spread" role="group" aria-label="Page layout">
            <button
              type="button"
              className={spread === 'single' ? 'active' : ''}
              onClick={() => setSpread('single')}
              title="One page"
            >
              1
            </button>
            <button
              type="button"
              className={spread === 'double' ? 'active' : ''}
              onClick={() => {
                setSpread('double')
                setPage((p) => (p % 2 === 0 ? p - 1 : p))
              }}
              title="Two pages"
            >
              2
            </button>
          </div>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z / 1.12))}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="pdf-zoom">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z * 1.12))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={sidebar ? 'active' : ''}
            onClick={() => setSidebar((s) => !s)}
          >
            Marks
          </button>
        </div>
      </header>

      <div className="pdf-subbar">
        <div className="pdf-colors" aria-label="Colors">
          {(tool === 'highlighter' ? PDF_HIGHLIGHT_COLORS : PDF_PEN_COLORS).map(
            (c) => (
              <button
                key={c}
                type="button"
                className={`pdf-swatch${
                  (tool === 'highlighter' ? hiColor : penColor) === c
                    ? ' active'
                    : ''
                }`}
                style={{ background: c }}
                onClick={() =>
                  tool === 'highlighter' ? setHiColor(c) : setPenColor(c)
                }
                aria-label="Color"
              />
            ),
          )}
        </div>
        <div className="pdf-pager">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => jumpToPage(page - step)}
          >
            Prev
          </button>
          <label>
            <span className="sr-only">Page</span>
            <input
              type="number"
              min={1}
              max={pageCount}
              value={page}
              onChange={(e) => {
                const n = Number(e.target.value) || 1
                jumpToPage(n)
              }}
            />
            <span>
              {rightPage != null ? `–${rightPage}` : ''} / {pageCount}
            </span>
          </label>
          <button
            type="button"
            disabled={page + (step - 1) >= pageCount}
            onClick={() => jumpToPage(page + step)}
          >
            Next
          </button>
          <span className="pdf-zoom-hint">Pinch / ⌃+scroll to zoom</span>
        </div>
      </div>

      <div className={`pdf-body${sidebar ? '' : ' no-side'}`}>
        <div className="pdf-stage" ref={wrapRef}>
          <div
            className={`pdf-spread-row${spread === 'double' ? ' double' : ''}`}
          >
            <div className="pdf-page-stack" data-page={page}>
              <canvas ref={pdfCanvasLRef} className="pdf-page-canvas" />
              <canvas
                ref={inkCanvasLRef}
                className={`pdf-ink-canvas tool-${tool}`}
                onPointerDown={(e) => onPointerDown(e, page)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>
            {rightPage != null && (
              <div className="pdf-page-stack" data-page={rightPage}>
                <canvas ref={pdfCanvasRRef} className="pdf-page-canvas" />
                <canvas
                  ref={inkCanvasRRef}
                  className={`pdf-ink-canvas tool-${tool}`}
                  onPointerDown={(e) => onPointerDown(e, rightPage)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                />
              </div>
            )}
          </div>
        </div>

        {sidebar && (
          <aside className="pdf-side" aria-label="Bookmarks">
            <div className="pdf-side-fixed">
              <h2>Bookmarks</h2>
              <div className="pdf-bm-add">
                <input
                  type="text"
                  placeholder={`Page ${pageLabel}`}
                  value={bookmarkName}
                  maxLength={80}
                  onChange={(e) => setBookmarkName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addBookmark()
                  }}
                />
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void addBookmark()}
                >
                  Add
                </button>
              </div>
            </div>
            <div className="pdf-side-scroll">
              {bookmarks.length === 0 ? (
                <p className="pdf-empty-side">No bookmarks yet.</p>
              ) : (
                <ul className="pdf-bm-list">
                  {bookmarks.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="pdf-bm-jump"
                        onClick={() => jumpToPage(b.page)}
                      >
                        <strong>{b.name}</strong>
                        <span>p. {b.page}</span>
                      </button>
                      <div className="pdf-bm-actions">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => void renameBookmark(b.id)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => void removeBookmark(b.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
