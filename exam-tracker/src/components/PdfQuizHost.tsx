import { useCallback, useEffect, useRef, useState } from 'react'
import {
  emptyQuizStore,
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
  getPageText,
}: {
  docId: string
  title: string
  page: number
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
  const [panel, setPanel] = useState<'review' | 'solutions'>('review')

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

  const detectQuestions = useCallback(
    async (force = false) => {
      setError('')
      setInfo('')
      setBusy(true)
      setPanel('review')
      try {
        const cached = force
          ? null
          : await getPageExtract(docId, page, 'questions')
        let found: PdfDetectedQuestion[] = []
        let kind: PdfPageKind = 'questions'
        let sols: PdfDetectedSolution[] = []
        if (cached && Array.isArray(cached.payload) && cached.payload.length) {
          found = cached.payload as PdfDetectedQuestion[]
          setInfo('Loaded saved detect for this page.')
        } else {
          const text = await getPageText()
          const local = extractQuestionsFromPageText(text, page)
          found = local.questions
          kind = local.pageKind
          sols = extractSolutionsFromPageText(text, page)
          await putPageExtract({
            id: pageExtractId(docId, page, 'questions'),
            docId,
            page,
            kind: 'questions',
            payload: found,
            extractedAt: new Date().toISOString(),
          })
          if (sols.length) {
            setDetectedSols(sols)
            await putPageExtract({
              id: pageExtractId(docId, page, 'solutions'),
              docId,
              page,
              kind: 'solutions',
              payload: sols,
              extractedAt: new Date().toISOString(),
            })
          }

          if (kind === 'solutions' && !found.length && sols.length) {
            await persistStore(mergeSolutionsIntoStore(storeRef.current, sols))
            setPanel('solutions')
            setPageKind('solutions')
            setInfo(`Mapped ${sols.length} solution(s) from this page.`)
            setDetectedQs([])
            setOpen(true)
            return
          }

          if (found.length) {
            const keyed = found.filter((q) => q.guessedAnswer).length
            setInfo(
              `Detected ${found.length} question(s)${
                keyed ? ` · ${keyed} with answer key` : ''
              } from page text.`,
            )
          }
        }
        setDetectedQs(found)
        setPageKind(kind)
        if (!found.length) {
          setError(
            'No MCQs found in page text. Multi-column pages need selectable text — try Re-detect, or Map solutions on the answer strip.',
          )
        } else {
          let next = mergeQuestionsIntoStore(storeRef.current, found)
          if (sols.length) next = mergeSolutionsIntoStore(next, sols)
          await persistStore(next)
        }
        setOpen(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Detect failed')
        setOpen(true)
      } finally {
        setBusy(false)
      }
    },
    [docId, getPageText, page, persistStore],
  )

  const detectSolutions = useCallback(async () => {
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const text = await getPageText()
      const found = extractSolutionsFromPageText(text, page)
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
        await persistStore(mergeSolutionsIntoStore(storeRef.current, found))
        setPanel('solutions')
        setInfo(`Mapped ${found.length} solution(s).`)
      }
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Solution detect failed')
      setOpen(true)
    } finally {
      setBusy(false)
    }
  }, [docId, getPageText, page, persistStore])

  const count = listStoreQuestions(store).length
  const pageCount = detectedQs.length

  return (
    <>
      <div className="pdf-quiz-fab-row">
        <button
          type="button"
          className="pdf-quiz-fab"
          disabled={busy}
          onClick={() => void detectQuestions(false)}
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
          forceSolutions={panel === 'solutions'}
          onClose={() => setOpen(false)}
          onStartDetect={() => void detectQuestions(true)}
          onDetectSolutions={() => void detectSolutions()}
        />
      )}
    </>
  )
}
