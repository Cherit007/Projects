import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import { useAuth } from '../auth/AuthContext'
import { PdfQuizHost } from '../components/PdfQuizHost'
import { TOPICS } from '../data/topics'
import { usePdfStudy } from '../hooks/usePdfStudy'
import {
  DEFAULT_LAYER_ID,
  PDF_HIGHLIGHT_COLORS,
  PDF_PEN_COLORS,
  drawStroke,
  newPdfId,
  normalizeMeta,
  type PdfBookmark,
  type PdfDocMeta,
  type PdfFitMode,
  type PdfLayer,
  type PdfPaperTheme,
  type PdfPoint,
  type PdfStickyNote,
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
type LeftTab = 'thumbs' | 'outline' | 'search'
type RightTab = 'marks' | 'notes' | 'layers'

type OutlineNode = { title: string; page: number | null; items: OutlineNode[] }
type SearchHit = { page: number; snippet: string }

const ZOOM_MIN = 0.45
const ZOOM_MAX = 3.2
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
    persistNotes,
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
  const [notes, setNotes] = useState<PdfStickyNote[]>([])
  const [layers, setLayers] = useState<PdfLayer[]>([])
  const [activeLayerId, setActiveLayerId] = useState(DEFAULT_LAYER_ID)
  const [undoStack, setUndoStack] = useState<PdfStroke[][]>([])
  const [bookmarkName, setBookmarkName] = useState('')
  const [sidebar, setSidebar] = useState(true)
  const [leftRail, setLeftRail] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [theme, setTheme] = useState<PdfPaperTheme>('day')
  const [fitMode, setFitMode] = useState<PdfFitMode>('width')
  const [focusMode, setFocusMode] = useState(false)
  const [leftTab, setLeftTab] = useState<LeftTab>('thumbs')
  const [rightTab, setRightTab] = useState<RightTab>('marks')
  const [outline, setOutline] = useState<OutlineNode[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({})
  const [pageCssSize, setPageCssSize] = useState({ w: 0, h: 0 })

  const pdfCanvasLRef = useRef<HTMLCanvasElement>(null)
  const inkCanvasLRef = useRef<HTMLCanvasElement>(null)
  const textLayerLRef = useRef<HTMLDivElement>(null)
  const pdfCanvasRRef = useRef<HTMLCanvasElement>(null)
  const inkCanvasRRef = useRef<HTMLCanvasElement>(null)
  const textLayerRRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const strokesRef = useRef<PdfStroke[]>([])
  const bookmarksRef = useRef<PdfBookmark[]>([])
  const notesRef = useRef<PdfStickyNote[]>([])
  const layersRef = useRef<PdfLayer[]>([])
  const metaRef = useRef<PdfDocMeta | null>(null)
  const pageRef = useRef(1)
  const zoomRef = useRef(1.15)
  const pageCountRef = useRef(1)
  const spreadRef = useRef<SpreadMode>('single')
  const activeLayerRef = useRef(DEFAULT_LAYER_ID)
  const currentStrokeRef = useRef<PdfStroke | null>(null)
  const saveTimer = useRef<number | null>(null)
  const cloudTimer = useRef<number | null>(null)
  const dirtyRef = useRef(false)
  const readyRef = useRef(false)
  const basePageSize = useRef({ w: 612, h: 792 })

  const rightPage = spread === 'double' && page < pageCount ? page + 1 : null
  const visiblePages = useMemo(
    () => (rightPage ? [page, rightPage] : [page]),
    [page, rightPage],
  )
  const step = spread === 'double' ? 2 : 1
  const visibleLayerIds = useMemo(
    () => new Set(layers.filter((l) => l.visible).map((l) => l.id)),
    [layers],
  )

  strokesRef.current = strokes
  bookmarksRef.current = bookmarks
  notesRef.current = notes
  layersRef.current = layers
  metaRef.current = meta
  pageRef.current = page
  zoomRef.current = zoom
  pageCountRef.current = pageCount
  spreadRef.current = spread
  activeLayerRef.current = activeLayerId
  readyRef.current = state === 'ready'

  useEffect(() => {
    document.documentElement.classList.add('pdf-reader-active')
    if (focusMode) document.documentElement.classList.add('pdf-focus-mode')
    else document.documentElement.classList.remove('pdf-focus-mode')
    return () => {
      document.documentElement.classList.remove('pdf-reader-active')
      document.documentElement.classList.remove('pdf-focus-mode')
    }
  }, [focusMode])

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
        const m = normalizeMeta(bundle.meta)
        setMeta(m)
        setPdf(doc)
        setPageCount(doc.numPages)
        const restoredSpread = m.spread === 'double' ? 'double' : 'single'
        let startPage = Math.min(Math.max(1, m.lastPage || 1), doc.numPages)
        if (restoredSpread === 'double' && startPage % 2 === 0) {
          startPage = Math.max(1, startPage - 1)
        }
        setPage(startPage)
        setZoom(m.zoom || 1.15)
        setSpread(restoredSpread)
        setTheme(m.theme || 'day')
        setFitMode(m.fitMode || 'width')
        setStrokes(bundle.strokes)
        setBookmarks(bundle.bookmarks)
        setNotes(bundle.notes)
        setLayers(m.layers || [])
        setActiveLayerId(m.activeLayerId || DEFAULT_LAYER_ID)
        setState('ready')
        setSaveStatus('saved')

        try {
          const rawOutline = await doc.getOutline()
          setOutline(await mapOutline(doc, rawOutline))
        } catch {
          setOutline([])
        }

        if (m.pageCount !== doc.numPages) {
          void touchMeta({
            ...m,
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
      await persistNotes(docId, notesRef.current)
      const nextMeta = normalizeMeta({
        ...metaRef.current,
        lastPage: pageRef.current,
        zoom: zoomRef.current,
        pageCount: pageCountRef.current,
        spread: spreadRef.current,
        theme,
        fitMode,
        layers: layersRef.current,
        activeLayerId: activeLayerRef.current,
        updatedAt: new Date().toISOString(),
      })
      await touchMeta(nextMeta)
      setMeta(nextMeta)
      dirtyRef.current = false
      setSaveStatus('saved')
    } catch (e) {
      console.warn(e)
      setSaveStatus('error')
    }
  }, [docId, fitMode, persistBookmarks, persistInk, persistNotes, theme, touchMeta])

  const queueCloudBackup = useCallback(() => {
    if (!docId || !user) return
    if (cloudTimer.current) window.clearTimeout(cloudTimer.current)
    cloudTimer.current = window.setTimeout(() => {
      void (async () => {
        const result = await backupToCloud(
          docId,
          strokesRef.current,
          bookmarksRef.current,
          notesRef.current,
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
            notesRef.current,
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
        void backupToCloud(
          docId,
          strokesRef.current,
          bookmarksRef.current,
          notesRef.current,
        )
      }
    }
  }, [backupToCloud, docId, flushLocal, user])

  const markVisited = useCallback(
    (pages: number[]) => {
      if (!meta) return
      const set = new Set(meta.visitedPages || [])
      for (const p of pages) set.add(p)
      const visitedPages = [...set].sort((a, b) => a - b)
      if (visitedPages.length === (meta.visitedPages || []).length) return
      const next = normalizeMeta({
        ...meta,
        visitedPages,
        updatedAt: new Date().toISOString(),
      })
      setMeta(next)
      void touchMeta(next)
    },
    [meta, touchMeta],
  )

  useEffect(() => {
    if (state === 'ready') markVisited(visiblePages)
  }, [visiblePages, state]) // eslint-disable-line react-hooks/exhaustive-deps

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
        const lid = s.layerId || DEFAULT_LAYER_ID
        if (!visibleLayerIds.has(lid) && s.tool !== 'eraser') continue
        drawStroke(ctx, s, w, h)
      }
      if (
        currentStrokeRef.current &&
        currentStrokeRef.current.page === pageNum
      ) {
        drawStroke(ctx, currentStrokeRef.current, w, h)
      }
    },
    [visibleLayerIds],
  )

  const paintAllInk = useCallback(() => {
    paintInkOn(page, inkCanvasLRef.current)
    if (rightPage != null) paintInkOn(rightPage, inkCanvasRRef.current)
  }, [page, paintInkOn, rightPage])

  const renderTextLayer = useCallback(
    async (
      pageNum: number,
      viewport: { width: number; height: number },
      host: HTMLDivElement | null,
    ) => {
      if (!host || !pdf) return
      host.innerHTML = ''
      host.style.width = `${viewport.width}px`
      host.style.height = `${viewport.height}px`
      const pg = await pdf.getPage(pageNum)
      const textContent = await pg.getTextContent()
      // pdf.js TextLayer expects its PageViewport shape
      const layer = new TextLayer({
        textContentSource: textContent,
        container: host,
        viewport: viewport as never,
      })
      await layer.render()
    },
    [pdf],
  )

  const renderPage = useCallback(
    async (
      pageNum: number,
      pdfCanvas: HTMLCanvasElement | null,
      inkCanvas: HTMLCanvasElement | null,
      textHost: HTMLDivElement | null,
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
      if (pageNum === page) {
        setPageCssSize({ w: viewport.width, h: viewport.height })
        const base = pg.getViewport({ scale: 1 })
        basePageSize.current = { w: base.width, h: base.height }
      }
      const ctx = pdfCanvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      await pg.render({
        canvasContext: ctx,
        viewport,
        canvas: pdfCanvas,
      }).promise
      paintInkOn(pageNum, inkCanvas)
      await renderTextLayer(pageNum, viewport, textHost)
    },
    [page, paintInkOn, pdf, renderTextLayer, zoom],
  )

  useEffect(() => {
    if (!pdf || state !== 'ready') return
    let cancelled = false
    void (async () => {
      await renderPage(
        page,
        pdfCanvasLRef.current,
        inkCanvasLRef.current,
        textLayerLRef.current,
      )
      if (cancelled) return
      if (rightPage != null) {
        await renderPage(
          rightPage,
          pdfCanvasRRef.current,
          inkCanvasRRef.current,
          textLayerRRef.current,
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pdf, page, rightPage, zoom, state, renderPage])

  useEffect(() => {
    paintAllInk()
  }, [strokes, layers, paintAllInk])

  // Trackpad pinch zoom
  useEffect(() => {
    const el = wrapRef.current
    if (!el || state !== 'ready') return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.01)
      setFitMode('actual')
      setZoom((z) => clampZoom(z * factor))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [state])

  // Fit modes
  const applyFit = useCallback(
    (mode: PdfFitMode) => {
      const stage = wrapRef.current
      if (!stage) return
      const { w, h } = basePageSize.current
      if (mode === 'actual') {
        setZoom(1)
        return
      }
      const pad = 32
      const availW = Math.max(120, stage.clientWidth - pad)
      const availH = Math.max(120, stage.clientHeight - pad)
      if (mode === 'width') {
        const cols = spread === 'double' ? 2 : 1
        const gap = spread === 'double' ? 12 : 0
        setZoom(clampZoom((availW - gap) / (w * cols)))
      } else {
        setZoom(clampZoom(Math.min(availW / w, availH / h)))
      }
    },
    [spread],
  )

  useEffect(() => {
    if (state !== 'ready') return
    if (fitMode === 'actual') return
    applyFit(fitMode)
  }, [fitMode, state, spread, applyFit])

  useEffect(() => {
    if (!meta || state !== 'ready') return
    const t = window.setTimeout(() => {
      void touchMeta(
        normalizeMeta({
          ...meta,
          lastPage: page,
          zoom,
          pageCount,
          spread,
          theme,
          fitMode,
          layers,
          activeLayerId,
          updatedAt: new Date().toISOString(),
        }),
      )
    }, 700)
    return () => window.clearTimeout(t)
  }, [page, zoom, pageCount, spread, theme, fitMode, layers, activeLayerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy thumbs for left rail
  useEffect(() => {
    if (!pdf || state !== 'ready' || !leftRail) return
    let cancelled = false
    void (async () => {
      const start = Math.max(1, page - 4)
      const end = Math.min(pageCount, page + 8)
      for (let p = start; p <= end; p += 1) {
        if (cancelled) return
        if (thumbUrls[p]) continue
        try {
          const pg = await pdf.getPage(p)
          const vp = pg.getViewport({ scale: 0.22 })
          const canvas = document.createElement('canvas')
          canvas.width = vp.width
          canvas.height = vp.height
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await pg.render({ canvasContext: ctx, viewport: vp, canvas }).promise
          const url = canvas.toDataURL('image/jpeg', 0.65)
          if (!cancelled) {
            setThumbUrls((prev) => ({ ...prev, [p]: url }))
          }
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pdf, page, pageCount, leftRail, state, thumbUrls])

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

  const commitStroke = (finished: PdfStroke) => {
    setUndoStack((u) => [...u.slice(-30), strokesRef.current])
    const next = [...strokesRef.current, finished]
    setStrokes(next)
    queueInkSave(next)
  }

  const onPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>,
    pageNum: number,
  ) => {
    if (tool === 'hand' || tool === 'select') return
    if (tool === 'note') {
      const pt = normPoint(e)
      const text = prompt('Sticky note') || ''
      if (!text.trim() || !docId) return
      const note: PdfStickyNote = {
        id: newPdfId('note'),
        page: pageNum,
        x: pt.x,
        y: pt.y,
        text: text.trim().slice(0, 500),
        createdAt: new Date().toISOString(),
      }
      const next = [...notes, note]
      setNotes(next)
      void persistNotes(docId, next)
      queueCloudBackup()
      setRightTab('notes')
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrawing(true)
    const isShape = tool === 'rect' || tool === 'ellipse' || tool === 'line'
    const color =
      tool === 'highlighter' ? hiColor : tool === 'eraser' ? '#000' : penColor
    const width =
      tool === 'highlighter' ? 0.028 : tool === 'eraser' ? 0.035 : 0.0045
    const shape =
      tool === 'rect'
        ? 'rect'
        : tool === 'ellipse'
          ? 'ellipse'
          : tool === 'line'
            ? 'line'
            : 'freehand'
    currentStrokeRef.current = {
      id: newPdfId('ink'),
      page: pageNum,
      tool: tool === 'eraser' ? 'eraser' : tool === 'highlighter' ? 'highlighter' : 'pen',
      color,
      width: isShape ? 0.0035 : width,
      points: [normPoint(e)],
      layerId: activeLayerId,
      shape,
    }
    paintAllInk()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !currentStrokeRef.current) return
    const shape = currentStrokeRef.current.shape || 'freehand'
    if (shape === 'freehand') {
      currentStrokeRef.current.points.push(normPoint(e))
    } else {
      const start = currentStrokeRef.current.points[0]
      currentStrokeRef.current.points = [start, normPoint(e)]
    }
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
    const shape = finished.shape || 'freehand'
    if (shape === 'freehand' && finished.points.length < 2) {
      paintAllInk()
      return
    }
    if (shape !== 'freehand' && finished.points.length < 2) {
      paintAllInk()
      return
    }
    commitStroke(finished)
  }

  const onTextSelectHighlight = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const host =
      textLayerLRef.current?.contains(range.commonAncestorContainer)
        ? textLayerLRef.current
        : textLayerRRef.current?.contains(range.commonAncestorContainer)
          ? textLayerRRef.current
          : null
    if (!host) return
    const pageNum =
      host === textLayerRRef.current && rightPage != null ? rightPage : page
    const hostRect = host.getBoundingClientRect()
    const rects = [...range.getClientRects()]
    if (!rects.length) return
    setUndoStack((u) => [...u.slice(-30), strokesRef.current])
    const added: PdfStroke[] = rects.map((r) => ({
      id: newPdfId('ink'),
      page: pageNum,
      tool: 'highlighter',
      color: hiColor,
      width: 0.02,
      layerId: activeLayerId,
      shape: 'textHighlight' as const,
      points: [
        {
          x: (r.left - hostRect.left) / hostRect.width,
          y: (r.top - hostRect.top) / hostRect.height,
        },
        {
          x: (r.right - hostRect.left) / hostRect.width,
          y: (r.bottom - hostRect.top) / hostRect.height,
        },
      ],
    }))
    const next = [...strokesRef.current, ...added]
    setStrokes(next)
    queueInkSave(next)
    sel.removeAllRanges()
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
    if (!confirm('Clear marks on visible page(s) for the active layer?')) return
    setUndoStack((u) => [...u.slice(-30), strokesRef.current])
    const hide = new Set(visiblePages)
    const next = strokesRef.current.filter(
      (s) =>
        !hide.has(s.page) ||
        (s.layerId || DEFAULT_LAYER_ID) !== activeLayerId,
    )
    setStrokes(next)
    queueInkSave(next)
  }

  const addBookmark = async (kind: 'normal' | 'doubt' = 'normal') => {
    if (!docId) return
    let topicId: string | undefined
    let name = bookmarkName.trim()
    if (kind === 'doubt') {
      name = name || `Doubt · p.${page}`
      const pick = prompt(
        `Topic id for practice (e.g. ${TOPICS[0]?.id ?? 'qa-percent-pl'})`,
        TOPICS[0]?.id ?? '',
      )
      if (pick == null) return
      topicId = pick.trim() || undefined
    } else if (!name) {
      name = prompt('Bookmark name', `Page ${page}`) || ''
    }
    if (!name.trim()) return
    const bm: PdfBookmark = {
      id: newPdfId('bm'),
      name: name.trim().slice(0, 80),
      page,
      kind,
      topicId,
      createdAt: new Date().toISOString(),
    }
    const next = [...bookmarks, bm].sort(
      (a, b) => a.page - b.page || a.name.localeCompare(b.name),
    )
    setBookmarks(next)
    setBookmarkName('')
    await persistBookmarks(docId, next)
    setSaveStatus('saved')
    queueCloudBackup()
    setRightTab('marks')
  }

  const removeBookmark = async (id: string) => {
    if (!docId) return
    const next = bookmarks.filter((b) => b.id !== id)
    setBookmarks(next)
    await persistBookmarks(docId, next)
    queueCloudBackup()
  }

  const removeNote = async (id: string) => {
    if (!docId) return
    const next = notes.filter((n) => n.id !== id)
    setNotes(next)
    await persistNotes(docId, next)
    queueCloudBackup()
  }

  const runSearch = async () => {
    if (!pdf || !searchQ.trim()) {
      setSearchHits([])
      return
    }
    setSearchBusy(true)
    const q = searchQ.trim().toLowerCase()
    const hits: SearchHit[] = []
    try {
      for (let p = 1; p <= pageCount; p += 1) {
        const pg = await pdf.getPage(p)
        const tc = await pg.getTextContent()
        const text = tc.items
          .map((it) => ('str' in it ? String(it.str) : ''))
          .join(' ')
        const idx = text.toLowerCase().indexOf(q)
        if (idx >= 0) {
          hits.push({
            page: p,
            snippet: text.slice(Math.max(0, idx - 24), idx + q.length + 40).trim(),
          })
        }
        if (hits.length >= 40) break
      }
      setSearchHits(hits)
      setLeftTab('search')
    } finally {
      setSearchBusy(false)
    }
  }

  const jumpToPage = (n: number) => {
    const clamped = Math.min(pageCount, Math.max(1, n))
    if (spread === 'double') {
      const left = clamped % 2 === 0 ? clamped - 1 : clamped
      setPage(Math.max(1, left))
    } else setPage(clamped)
  }

  const goLibrary = async () => {
    await flushLocal()
    navigate('/pdf')
  }

  const getPageText = useCallback(async () => {
    if (!pdf) return ''
    try {
      const pg = await pdf.getPage(page)
      const tc = await pg.getTextContent()
      // Join tightly around math punctuation so √ / ^ / () stay intact
      const parts = tc.items.map((it) =>
        'str' in it ? String(it.str) : '',
      )
      let out = ''
      for (let i = 0; i < parts.length; i += 1) {
        const cur = parts[i]
        if (!cur) continue
        if (!out) {
          out = cur
          continue
        }
        const prev = out[out.length - 1] || ''
        const next = cur[0] || ''
        const tight =
          /[√∛^_(\[{\\/×÷+\-=]$/.test(prev) ||
          /^[√∛^_)\]}\/×÷+\-=]/.test(next) ||
          /\d$/.test(prev) && /^\d/.test(next)
        out += tight ? cur : ` ${cur}`
      }
      return out
    } catch {
      return ''
    }
  }, [pdf, page])

  const goPracticeDoubt = (bm: PdfBookmark) => {
    const topic = bm.topicId || TOPICS[0]?.id || ''
    navigate(`/practice?topic=${encodeURIComponent(topic)}&from=pdf-doubt`)
  }

  const pageInkCount = useMemo(
    () =>
      strokes.filter(
        (s) =>
          visiblePages.includes(s.page) &&
          (s.layerId || DEFAULT_LAYER_ID) === activeLayerId,
      ).length,
    [strokes, visiblePages, activeLayerId],
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

  const pageNotes = notes.filter((n) => visiblePages.includes(n.page))

  return (
    <div className={`pdf-reader theme-${theme}${focusMode ? ' focus' : ''}`}>
      {!focusMode && (
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
                ['select', 'Select'],
                ['rect', 'Box'],
                ['ellipse', 'Oval'],
                ['line', 'Line'],
                ['note', 'Note'],
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
            {tool === 'select' && (
              <button type="button" className="btn primary" onClick={onTextSelectHighlight}>
                Highlight selection
              </button>
            )}
            <button type="button" onClick={undo} disabled={!undoStack.length}>
              Undo
            </button>
            <button type="button" onClick={clearVisibleInk} disabled={!pageInkCount}>
              Clear
            </button>
          </div>

          <div className="pdf-toolbar-right">
            <div className="pdf-spread" role="group" aria-label="Page layout">
              <button
                type="button"
                className={spread === 'single' ? 'active' : ''}
                onClick={() => setSpread('single')}
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
              >
                2
              </button>
            </div>
            <div className="pdf-spread" role="group" aria-label="Fit">
              <button
                type="button"
                className={fitMode === 'width' ? 'active' : ''}
                onClick={() => setFitMode('width')}
                title="Fit width"
              >
                W
              </button>
              <button
                type="button"
                className={fitMode === 'page' ? 'active' : ''}
                onClick={() => setFitMode('page')}
                title="Fit page"
              >
                P
              </button>
              <button
                type="button"
                className={fitMode === 'actual' ? 'active' : ''}
                onClick={() => setFitMode('actual')}
                title="Actual size"
              >
                1:1
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setFitMode('actual')
                setZoom((z) => clampZoom(z / 1.12))
              }}
            >
              −
            </button>
            <span className="pdf-zoom">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => {
                setFitMode('actual')
                setZoom((z) => clampZoom(z * 1.12))
              }}
            >
              +
            </button>
            <button
              type="button"
              className={leftRail ? 'active' : ''}
              onClick={() => setLeftRail((v) => !v)}
            >
              Pages
            </button>
            <button
              type="button"
              className={sidebar ? 'active' : ''}
              onClick={() => setSidebar((s) => !s)}
            >
              Marks
            </button>
            <button type="button" onClick={() => setFocusMode(true)}>
              Focus
            </button>
          </div>
        </header>
      )}

      {!focusMode && (
        <div className="pdf-subbar">
          <div className="pdf-colors" aria-label="Colors">
            {(tool === 'highlighter' || tool === 'select'
              ? PDF_HIGHLIGHT_COLORS
              : PDF_PEN_COLORS
            ).map((c) => (
              <button
                key={c}
                type="button"
                className={`pdf-swatch${
                  (tool === 'highlighter' || tool === 'select'
                    ? hiColor
                    : penColor) === c
                    ? ' active'
                    : ''
                }`}
                style={{ background: c }}
                onClick={() =>
                  tool === 'highlighter' || tool === 'select'
                    ? setHiColor(c)
                    : setPenColor(c)
                }
              />
            ))}
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
                onChange={(e) => jumpToPage(Number(e.target.value) || 1)}
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
            <div className="pdf-spread" role="group" aria-label="Paper theme">
              {(
                [
                  ['day', 'Day'],
                  ['sepia', 'Sepia'],
                  ['night', 'Night'],
                ] as Array<[PdfPaperTheme, string]>
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={theme === t ? 'active' : ''}
                  onClick={() => setTheme(t)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {focusMode && (
        <div className="pdf-focus-bar">
          <button type="button" onClick={() => jumpToPage(page - step)}>
            Prev
          </button>
          <span>
            {page}
            {rightPage ? `–${rightPage}` : ''} / {pageCount}
          </span>
          <button type="button" onClick={() => jumpToPage(page + step)}>
            Next
          </button>
          <button type="button" className="btn primary" onClick={() => setFocusMode(false)}>
            Exit focus
          </button>
        </div>
      )}

      <div
        className={`pdf-body${sidebar && !focusMode ? '' : ' no-side'}${
          leftRail && !focusMode ? '' : ' no-left'
        }`}
      >
        {leftRail && !focusMode && (
          <aside className="pdf-left" aria-label="Pages and search">
            <div className="pdf-rail-tabs">
              <button
                type="button"
                className={leftTab === 'thumbs' ? 'active' : ''}
                onClick={() => setLeftTab('thumbs')}
              >
                Thumbs
              </button>
              <button
                type="button"
                className={leftTab === 'outline' ? 'active' : ''}
                onClick={() => setLeftTab('outline')}
              >
                Outline
              </button>
              <button
                type="button"
                className={leftTab === 'search' ? 'active' : ''}
                onClick={() => setLeftTab('search')}
              >
                Search
              </button>
            </div>
            {leftTab === 'search' && (
              <div className="pdf-search-box">
                <input
                  type="search"
                  placeholder="Find in PDF…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch()
                  }}
                />
                <button
                  type="button"
                  className="btn primary"
                  disabled={searchBusy}
                  onClick={() => void runSearch()}
                >
                  {searchBusy ? '…' : 'Go'}
                </button>
              </div>
            )}
            <div className="pdf-left-scroll">
              {leftTab === 'thumbs' && (
                <ul className="pdf-thumbs">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                    (p) => (
                      <li key={p}>
                        <button
                          type="button"
                          className={visiblePages.includes(p) ? 'active' : ''}
                          onClick={() => jumpToPage(p)}
                        >
                          {thumbUrls[p] ? (
                            <img src={thumbUrls[p]} alt="" />
                          ) : (
                            <span className="pdf-thumb-ph">{p}</span>
                          )}
                          <span>{p}</span>
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              )}
              {leftTab === 'outline' && (
                <div className="pdf-outline">
                  {outline.length === 0 ? (
                    <p className="pdf-empty-side">No outline in this PDF.</p>
                  ) : (
                    <OutlineList nodes={outline} onJump={jumpToPage} />
                  )}
                </div>
              )}
              {leftTab === 'search' && (
                <ul className="pdf-search-hits">
                  {searchHits.length === 0 ? (
                    <li className="pdf-empty-side">No hits yet.</li>
                  ) : (
                    searchHits.map((h, i) => (
                      <li key={`${h.page}-${i}`}>
                        <button type="button" onClick={() => jumpToPage(h.page)}>
                          <strong>p. {h.page}</strong>
                          <span>{h.snippet}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </aside>
        )}

        <div className="pdf-stage" ref={wrapRef}>
          <div
            className={`pdf-spread-row${spread === 'double' ? ' double' : ''}`}
          >
            <PageStack
              pageNum={page}
              tool={tool}
              pdfRef={pdfCanvasLRef}
              inkRef={inkCanvasLRef}
              textRef={textLayerLRef}
              notes={pageNotes.filter((n) => n.page === page)}
              pageCssSize={pageCssSize}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onRemoveNote={(id) => void removeNote(id)}
            />
            {rightPage != null && (
              <PageStack
                pageNum={rightPage}
                tool={tool}
                pdfRef={pdfCanvasRRef}
                inkRef={inkCanvasRRef}
                textRef={textLayerRRef}
                notes={pageNotes.filter((n) => n.page === rightPage)}
                pageCssSize={pageCssSize}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onRemoveNote={(id) => void removeNote(id)}
              />
            )}
          </div>
          {!focusMode && docId && meta && (
            <PdfQuizHost
              docId={docId}
              title={meta.name}
              page={page}
              getPageText={getPageText}
            />
          )}
        </div>

        {sidebar && !focusMode && (
          <aside className="pdf-side" aria-label="Marks and layers">
            <div className="pdf-side-fixed">
              <div className="pdf-rail-tabs">
                <button
                  type="button"
                  className={rightTab === 'marks' ? 'active' : ''}
                  onClick={() => setRightTab('marks')}
                >
                  Marks
                </button>
                <button
                  type="button"
                  className={rightTab === 'notes' ? 'active' : ''}
                  onClick={() => setRightTab('notes')}
                >
                  Notes
                </button>
                <button
                  type="button"
                  className={rightTab === 'layers' ? 'active' : ''}
                  onClick={() => setRightTab('layers')}
                >
                  Layers
                </button>
              </div>
              {rightTab === 'marks' && (
                <>
                  <div className="pdf-bm-add">
                    <input
                      type="text"
                      placeholder={`Page ${page}`}
                      value={bookmarkName}
                      maxLength={80}
                      onChange={(e) => setBookmarkName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void addBookmark('normal')
                      }}
                    />
                    <button
                      type="button"
                      className="pdf-side-btn primary"
                      onClick={() => void addBookmark('normal')}
                    >
                      Add
                    </button>
                  </div>
                  <button
                    type="button"
                    className="pdf-doubt-btn"
                    onClick={() => void addBookmark('doubt')}
                  >
                    Doubt → Practice
                  </button>
                </>
              )}
            </div>
            <div className="pdf-side-scroll">
              {rightTab === 'marks' &&
                (bookmarks.length === 0 ? (
                  <p className="pdf-empty-side">No bookmarks yet.</p>
                ) : (
                  <ul className="pdf-bm-list">
                    {bookmarks.map((b) => (
                      <li key={b.id} className={b.kind === 'doubt' ? 'doubt' : ''}>
                        <button
                          type="button"
                          className="pdf-bm-jump"
                          onClick={() => jumpToPage(b.page)}
                        >
                          <strong>
                            {b.kind === 'doubt' ? 'Doubt · ' : ''}
                            {b.name}
                          </strong>
                          <span>p. {b.page}</span>
                        </button>
                        <div className="pdf-bm-actions">
                          {b.kind === 'doubt' && (
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => goPracticeDoubt(b)}
                            >
                              Practice
                            </button>
                          )}
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
                ))}

              {rightTab === 'notes' &&
                (notes.length === 0 ? (
                  <p className="pdf-empty-side">
                    Use the Note tool and tap the page.
                  </p>
                ) : (
                  <ul className="pdf-bm-list">
                    {notes.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          className="pdf-bm-jump"
                          onClick={() => jumpToPage(n.page)}
                        >
                          <strong>{n.text.slice(0, 80)}</strong>
                          <span>p. {n.page}</span>
                        </button>
                        <div className="pdf-bm-actions">
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => void removeNote(n.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}

              {rightTab === 'layers' && (
                <ul className="pdf-layer-list">
                  {layers.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        className={activeLayerId === l.id ? 'active' : ''}
                        onClick={() => setActiveLayerId(l.id)}
                      >
                        {l.name}
                      </button>
                      <label className="pdf-check">
                        <input
                          type="checkbox"
                          checked={l.visible}
                          onChange={() => {
                            setLayers((prev) =>
                              prev.map((x) =>
                                x.id === l.id
                                  ? { ...x, visible: !x.visible }
                                  : x,
                              ),
                            )
                          }}
                        />
                        Show
                      </label>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        const name = prompt('Layer name', 'Custom') || ''
                        if (!name.trim()) return
                        const layer: PdfLayer = {
                          id: newPdfId('layer'),
                          name: name.trim().slice(0, 40),
                          visible: true,
                          createdAt: new Date().toISOString(),
                        }
                        setLayers((prev) => [...prev, layer])
                        setActiveLayerId(layer.id)
                      }}
                    >
                      + Add layer
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function PageStack({
  pageNum,
  tool,
  pdfRef,
  inkRef,
  textRef,
  notes,
  pageCssSize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRemoveNote,
}: {
  pageNum: number
  tool: PdfTool
  pdfRef: React.RefObject<HTMLCanvasElement | null>
  inkRef: React.RefObject<HTMLCanvasElement | null>
  textRef: React.RefObject<HTMLDivElement | null>
  notes: PdfStickyNote[]
  pageCssSize: { w: number; h: number }
  onPointerDown: (
    e: React.PointerEvent<HTMLCanvasElement>,
    pageNum: number,
  ) => void
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void
  onPointerUp: () => void
  onRemoveNote: (id: string) => void
}) {
  const selectMode = tool === 'select'
  return (
    <div className="pdf-page-stack" data-page={pageNum}>
      <canvas ref={pdfRef} className="pdf-page-canvas" />
      <div
        ref={textRef}
        className={`pdf-text-layer${selectMode ? ' selectable' : ''}`}
      />
      <canvas
        ref={inkRef}
        className={`pdf-ink-canvas tool-${tool}`}
        onPointerDown={(e) => onPointerDown(e, pageNum)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {notes.map((n) => (
        <div
          key={n.id}
          className="pdf-sticky"
          style={{
            left: `${n.x * 100}%`,
            top: `${n.y * 100}%`,
          }}
          title={n.text}
        >
          <button type="button" className="pdf-sticky-x" onClick={() => onRemoveNote(n.id)}>
            ×
          </button>
          {n.text}
        </div>
      ))}
      {pageCssSize.w === 0 ? null : null}
    </div>
  )
}

function OutlineList({
  nodes,
  onJump,
  depth = 0,
}: {
  nodes: OutlineNode[]
  onJump: (page: number) => void
  depth?: number
}) {
  return (
    <ul className="pdf-outline-list" style={{ paddingLeft: depth ? 0.75 : 0 }}>
      {nodes.map((n, i) => (
        <li key={`${n.title}-${i}`}>
          <button
            type="button"
            disabled={n.page == null}
            onClick={() => n.page != null && onJump(n.page)}
          >
            {n.title}
            {n.page != null ? <span>p. {n.page}</span> : null}
          </button>
          {n.items.length > 0 && (
            <OutlineList nodes={n.items} onJump={onJump} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  )
}

async function mapOutline(
  doc: PDFDocumentProxy,
  nodes: Awaited<ReturnType<PDFDocumentProxy['getOutline']>>,
): Promise<OutlineNode[]> {
  if (!nodes) return []
  const out: OutlineNode[] = []
  for (const n of nodes) {
    let page: number | null = null
    try {
      if (n.dest) {
        const dest =
          typeof n.dest === 'string' ? await doc.getDestination(n.dest) : n.dest
        if (Array.isArray(dest) && dest[0]) {
          const idx = await doc.getPageIndex(dest[0])
          page = idx + 1
        }
      }
    } catch {
      page = null
    }
    out.push({
      title: n.title || 'Section',
      page,
      items: await mapOutline(doc, n.items || []),
    })
  }
  return out
}
