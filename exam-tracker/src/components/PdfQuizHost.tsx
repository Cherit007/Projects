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
  extractQuestionsFromPageText,
  extractSolutionsFromPageText,
} from '../utils/pdfPageQuizLocal'
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
  getPageText,
}: {
  docId: string
  title: string
  page: number
  getPageCanvas: () => HTMLCanvasElement | null
  getPageText: () => Promise<string>
}) {
  const [store, setStore] = useState<PdfQuizDocStore>(() =>
    emptyQuizStore(docId, title),
  )
  const storeRef = useRef(store)
  storeRef.current = store

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [detectedQs, setDetectedQs] = useState<PdfDetectedQuestion[]>([])
  const [detectedSols, setDetectedSols] = useState<PdfDetectedSolution[]>([])
  const [pageKind, setPageKind] = useState<PdfPageKind | null>(null)
  const [keyReady, setKeyReady] = useState(() => hasGeminiKey())
  const [panel, setPanel] = useState<'review' | 'solutions'>('review')

  useEffect(() => {
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
      setInfo('')
      setError('')
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

  const applyQuestions = useCallback(
    async (
      found: PdfDetectedQuestion[],
      kind: PdfPageKind,
      note: string,
    ) => {
      setDetectedQs(found)
      setPageKind(kind)
      setInfo(note)
      await putPageExtract({
        id: pageExtractId(docId, page, 'questions'),
        docId,
        page,
        kind: 'questions',
        payload: found,
        extractedAt: new Date().toISOString(),
      })
      if (found.length) {
        await persistStore(mergeQuestionsIntoStore(storeRef.current, found))
        setError('')
      } else if (kind === 'solutions') {
        setError('')
      } else {
        setError(
          'No MCQs found on this page. Try another page, or Map solutions on an answer key.',
        )
      }
    },
    [docId, page, persistStore],
  )

  const detectOffline = useCallback(async () => {
    setError('')
    setInfo('')
    setBusy(true)
    setPanel('review')
    try {
      const text = await getPageText()
      const local = extractQuestionsFromPageText(text, page)
      await applyQuestions(
        local.questions,
        local.pageKind,
        local.questions.length
          ? `Offline text detect · ${local.questions.length} question(s) (no Gemini).`
          : 'Offline text detect found nothing — page may be image-only.',
      )
      if (local.pageKind === 'solutions' && !local.questions.length) {
        const sols = extractSolutionsFromPageText(text, page)
        if (sols.length) {
          setDetectedSols(sols)
          await persistStore(mergeSolutionsIntoStore(storeRef.current, sols))
          setPanel('solutions')
          setInfo(`Offline text detect · mapped ${sols.length} solution(s).`)
        }
      }
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Offline detect failed')
      setOpen(true)
    } finally {
      setBusy(false)
    }
  }, [applyQuestions, getPageText, page, persistStore])

  const detectQuestions = useCallback(
    async (force = false, preferAi = true) => {
      setError('')
      setInfo('')
      setBusy(true)
      setPanel('review')
      try {
        const cached = force
          ? null
          : await getPageExtract(docId, page, 'questions')
        if (cached && Array.isArray(cached.payload) && cached.payload.length) {
          await applyQuestions(
            cached.payload as PdfDetectedQuestion[],
            'questions',
            'Loaded cached detect for this page.',
          )
          setOpen(true)
          return
        }

        // Always try offline text first (works with no key / when Gemini is busy)
        const text = await getPageText()
        const local = extractQuestionsFromPageText(text, page)
        const localUsable =
          local.questions.filter((q) => Object.keys(q.options).length >= 2)
            .length >= 1

        if (!preferAi || !hasGeminiKey()) {
          await applyQuestions(
            local.questions,
            local.pageKind,
            local.questions.length
              ? `Offline text detect · ${local.questions.length} question(s).`
              : 'No Gemini key — offline text found nothing. Add a key for vision detect on image-only pages.',
          )
          setOpen(true)
          return
        }

        if (localUsable && !force) {
          // Use offline immediately; user can Re-detect with AI
          await applyQuestions(
            local.questions,
            local.pageKind,
            `Offline text detect · ${local.questions.length} question(s). Re-detect to try Gemini vision.`,
          )
          setOpen(true)
          return
        }

        try {
          const canvas = getPageCanvas()
          if (!canvas) throw new Error('Page not rendered yet — wait a moment.')
          const result = await extractQuestionsFromCanvas(canvas, page)
          if (result.questions.length) {
            await applyQuestions(
              result.questions,
              result.pageKind,
              `Gemini vision · ${result.questions.length} question(s).`,
            )
          } else if (local.questions.length) {
            await applyQuestions(
              local.questions,
              local.pageKind,
              `Gemini found none — using offline text · ${local.questions.length} question(s).`,
            )
          } else {
            await applyQuestions(result.questions, result.pageKind, '')
          }
        } catch (aiErr) {
          const msg =
            aiErr instanceof Error ? aiErr.message : 'Gemini detect failed'
          if (local.questions.length) {
            await applyQuestions(
              local.questions,
              local.pageKind,
              `Gemini busy/failed — using offline text · ${local.questions.length} question(s).`,
            )
            setError(msg)
          } else {
            throw aiErr
          }
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
    [applyQuestions, docId, getPageCanvas, getPageText, page],
  )

  const detectSolutions = useCallback(
    async (preferAi = true) => {
      setError('')
      setInfo('')
      setBusy(true)
      try {
        const text = await getPageText()
        const local = extractSolutionsFromPageText(text, page)

        const finishLocal = async (note: string) => {
          setDetectedSols(local)
          setPageKind('solutions')
          if (!local.length) {
            setError('No solution keys found on this page.')
            setPanel('review')
          } else {
            await putPageExtract({
              id: pageExtractId(docId, page, 'solutions'),
              docId,
              page,
              kind: 'solutions',
              payload: local,
              extractedAt: new Date().toISOString(),
            })
            await persistStore(mergeSolutionsIntoStore(storeRef.current, local))
            setPanel('solutions')
            setInfo(note)
          }
        }

        if (!preferAi || !hasGeminiKey()) {
          await finishLocal(
            local.length
              ? `Offline text · mapped ${local.length} solution(s).`
              : '',
          )
          setOpen(true)
          return
        }

        try {
          const canvas = getPageCanvas()
          if (!canvas) throw new Error('Page not rendered yet — wait a moment.')
          const found = await extractSolutionsFromCanvas(canvas, page)
          if (found.length) {
            setDetectedSols(found)
            setPageKind('solutions')
            await putPageExtract({
              id: pageExtractId(docId, page, 'solutions'),
              docId,
              page,
              kind: 'solutions',
              payload: found,
              extractedAt: new Date().toISOString(),
            })
            await persistStore(mergeSolutionsIntoStore(storeRef.current, found))
            setPanel('solutions')
            setInfo(`Gemini vision · mapped ${found.length} solution(s).`)
          } else if (local.length) {
            await finishLocal(
              `Gemini found none — offline text · mapped ${local.length} solution(s).`,
            )
          } else {
            setError('No solution keys found on this page.')
            setPanel('review')
          }
        } catch (aiErr) {
          const msg =
            aiErr instanceof Error ? aiErr.message : 'Solution detect failed'
          if (local.length) {
            await finishLocal(
              `Gemini busy/failed — offline text · mapped ${local.length} solution(s).`,
            )
            setError(msg)
          } else {
            throw aiErr
          }
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
    },
    [docId, getPageCanvas, getPageText, page, persistStore],
  )

  const count = listStoreQuestions(store).length
  const pageCount = detectedQs.length

  return (
    <>
      <div className="pdf-quiz-fab-row">
        <button
          type="button"
          className="pdf-quiz-fab"
          disabled={busy}
          onClick={() => void detectQuestions(false, true)}
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
          info={info}
          hasKey={keyReady}
          forceSolutions={panel === 'solutions'}
          onClose={() => setOpen(false)}
          onStartDetect={() => void detectQuestions(true, true)}
          onDetectOffline={() => void detectOffline()}
          onDetectSolutions={() => void detectSolutions(true)}
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
