import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearGeminiApiKey,
  getGeminiApiKey,
  hasGeminiKey,
  setGeminiApiKey,
} from '../lib/geminiVision'
import {
  emptyQuizStore,
  extractQuestionsFromCanvas,
  extractSolutionsFromCanvas,
  listStoreQuestions,
  mergeQuestionsIntoStore,
  mergeSolutionsIntoStore,
  type PdfDetectedQuestion,
  type PdfDetectedSolution,
  type PdfPageKind,
  type PdfQuizDocStore,
} from '../utils/pdfPageQuiz'
import {
  getPageExtract,
  getQuizStore,
  pageExtractId,
  putPageExtract,
  putQuizStore,
} from '../utils/pdfPageQuizDb'
import { PdfQuizOverlay } from './PdfQuizOverlay'

export function PdfQuizHost({
  docId,
  title,
  page,
  getPageCanvas,
}: {
  docId: string
  title: string
  page: number
  getPageCanvas: () => HTMLCanvasElement | null
}) {
  const [store, setStore] = useState<PdfQuizDocStore>(() =>
    emptyQuizStore(docId, title),
  )
  const storeRef = useRef(store)
  storeRef.current = store

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [detectedQs, setDetectedQs] = useState<PdfDetectedQuestion[]>([])
  const [detectedSols, setDetectedSols] = useState<PdfDetectedSolution[]>([])
  const [pageKind, setPageKind] = useState<PdfPageKind | null>(null)
  const [keyReady, setKeyReady] = useState(() => hasGeminiKey())
  const [panel, setPanel] = useState<'review' | 'solutions'>('review')

  useEffect(() => {
    // Drop leftover junk keys that would block Detect
    const key = getGeminiApiKey()
    if (key && key.length < 20) {
      clearGeminiApiKey()
      setKeyReady(false)
    } else {
      setKeyReady(hasGeminiKey())
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const existing = await getQuizStore(docId)
      if (!cancelled) {
        setStore(existing || emptyQuizStore(docId, title))
      }
      const cached = await getPageExtract(docId, page, 'questions')
      if (!cancelled && cached && Array.isArray(cached.payload)) {
        setDetectedQs(cached.payload as PdfDetectedQuestion[])
        setPageKind(
          (cached.payload as PdfDetectedQuestion[]).length
            ? 'questions'
            : 'other',
        )
      } else if (!cancelled) {
        setDetectedQs([])
        setPageKind(null)
      }
      setDetectedSols([])
    })()
    return () => {
      cancelled = true
    }
  }, [docId, page, title])

  const persistStore = useCallback(async (next: PdfQuizDocStore) => {
    setStore(next)
    storeRef.current = next
    await putQuizStore(next)
  }, [])

  const detectQuestions = useCallback(
    async (force = false) => {
      setError('')
      setBusy(true)
      setPanel('review')
      try {
        const canvas = getPageCanvas()
        if (!canvas) throw new Error('Page not rendered yet — wait a moment.')
        const cached = force
          ? null
          : await getPageExtract(docId, page, 'questions')
        let found: PdfDetectedQuestion[]
        let kind: PdfPageKind = 'questions'
        if (cached && Array.isArray(cached.payload) && cached.payload.length) {
          found = cached.payload as PdfDetectedQuestion[]
        } else {
          const result = await extractQuestionsFromCanvas(canvas, page)
          found = result.questions
          kind = result.pageKind
          await putPageExtract({
            id: pageExtractId(docId, page, 'questions'),
            docId,
            page,
            kind: 'questions',
            payload: found,
            extractedAt: new Date().toISOString(),
          })
        }
        setDetectedQs(found)
        setPageKind(kind)
        if (!found.length) {
          if (kind === 'solutions') {
            setError('')
          } else {
            setError(
              'No MCQs detected on this page. If this is an answer key, use Map solutions.',
            )
          }
        } else {
          const next = mergeQuestionsIntoStore(storeRef.current, found)
          await persistStore(next)
        }
        setOpen(true)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Detect failed'
        setError(msg)
        if (/api key|ai studio|add a free gemini|paste/i.test(msg)) {
          clearGeminiApiKey()
          setKeyReady(false)
        }
        setOpen(true)
      } finally {
        setBusy(false)
      }
    },
    [docId, getPageCanvas, page, persistStore],
  )

  const detectSolutions = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      const canvas = getPageCanvas()
      if (!canvas) throw new Error('Page not rendered yet — wait a moment.')
      const found = await extractSolutionsFromCanvas(canvas, page)
      await putPageExtract({
        id: pageExtractId(docId, page, 'solutions'),
        docId,
        page,
        kind: 'solutions',
        payload: found,
        extractedAt: new Date().toISOString(),
      })
      setDetectedSols(found)
      setPageKind('solutions')
      if (!found.length) {
        setError('No solution keys found on this page.')
        setPanel('review')
      } else {
        const next = mergeSolutionsIntoStore(storeRef.current, found)
        await persistStore(next)
        setPanel('solutions')
      }
      setOpen(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Solution detect failed'
      setError(msg)
      if (/api key|ai studio|add a free gemini|paste/i.test(msg)) {
        clearGeminiApiKey()
        setKeyReady(false)
      }
      setOpen(true)
    } finally {
      setBusy(false)
    }
  }, [docId, getPageCanvas, page, persistStore])

  const count = listStoreQuestions(store).length
  const pageCount = detectedQs.length

  return (
    <>
      <div className="pdf-quiz-fab-row">
        <button
          type="button"
          className="pdf-quiz-fab"
          disabled={busy}
          onClick={() => {
            if (!keyReady) {
              setOpen(true)
              setPanel('review')
              return
            }
            void detectQuestions(false)
          }}
        >
          {busy ? 'Detecting…' : pageCount ? `Test · ${pageCount} on page` : 'Detect test'}
        </button>
        {count > 0 && (
          <button
            type="button"
            className="pdf-quiz-fab secondary"
            onClick={() => {
              setPanel('review')
              setOpen(true)
            }}
          >
            Bank · {count}
          </button>
        )}
      </div>

      {open && (
        <PdfQuizOverlay
          store={store}
          page={page}
          detectedQuestions={detectedQs}
          detectedSolutions={detectedSols}
          pageKind={pageKind}
          busy={busy}
          error={error}
          hasKey={keyReady}
          forceSolutions={panel === 'solutions'}
          onClose={() => setOpen(false)}
          onStartDetect={() => void detectQuestions(true)}
          onDetectSolutions={() => void detectSolutions()}
          onSaveKey={(key) => {
            if (!key.trim()) {
              clearGeminiApiKey()
              setKeyReady(false)
              setError('')
              return
            }
            setGeminiApiKey(key)
            setKeyReady(hasGeminiKey())
            setError('')
          }}
        />
      )}
    </>
  )
}
