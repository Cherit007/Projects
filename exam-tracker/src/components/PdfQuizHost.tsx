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
  pickBestQuestionsFromTexts,
  pickBestSolutionsFromTexts,
} from '../utils/pdfPageQuizLocal'
import {
  getPageExtract,
  getQuizStore,
  pageExtractId,
  putPageExtract,
  putQuizStore,
} from '../utils/pdfPageQuizDb'
import type { PageTextVariants } from '../utils/pdfPageText'
import { PdfQuizOverlay } from './PdfQuizOverlay'

function isCleanDetect(qs: PdfDetectedQuestion[]): boolean {
  const good = qs.filter((q) => {
    const opts = Object.values(q.options)
    return (
      opts.length >= 3 &&
      opts.every((t) => !!t && t.length <= 48) &&
      q.stem.length >= 40 &&
      q.stem.length <= 420 &&
      !/[\u0900-\u097F]/.test(q.stem) &&
      !/\b(?:ops|HCE|www|demi|Te fm|sd wd)\b/i.test(q.stem) &&
      !/SSC|CGL|MAINS/i.test(q.stem)
    )
  })
  return good.length >= Math.min(2, qs.length) && good.length > 0
}

export function PdfQuizHost({
  docId,
  title,
  page,
  getPageVariants,
  getPageCanvas,
}: {
  docId: string
  title: string
  page: number
  getPageVariants: () => Promise<PageTextVariants>
  getPageCanvas: () => Promise<HTMLCanvasElement | null>
}) {
  const [store, setStore] = useState<PdfQuizDocStore>(() =>
    emptyQuizStore(docId, title),
  )
  const storeRef = useRef(store)
  storeRef.current = store

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('Reading page…')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [extractPreview, setExtractPreview] = useState('')
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
      setExtractPreview('')
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

  const runEnglishColumnOcr = useCallback(async () => {
    setBusyLabel('OCR English column…')
    const canvas = await getPageCanvas()
    if (!canvas) return ''
    const { ocrEnglishColumn } = await import('../utils/pdfPageOcr')
    return ocrEnglishColumn(canvas, (pct) => {
      setBusyLabel(`OCR English column… ${pct}%`)
    }, 0.48)
  }, [getPageCanvas])

  const collectTexts = useCallback(
    async (withOcr: boolean) => {
      setBusyLabel('Reading English column…')
      const variants = await getPageVariants()
      const texts = [...variants.variants]
      if (variants.primary && !texts.includes(variants.primary)) {
        texts.unshift(variants.primary)
      }

      let usedOcr = false
      if (withOcr) {
        try {
          const ocr = await runEnglishColumnOcr()
          if (ocr.length >= 40) {
            texts.unshift(ocr) // prefer OCR English column when requested
            usedOcr = true
          }
        } catch {
          // keep text-layer variants
        }
      }

      const preview =
        texts.find((t) => t.trim().length >= 40)?.trim().slice(0, 900) ||
        variants.primary.trim().slice(0, 900) ||
        ''

      return { texts, usedOcr, preview, itemCount: variants.itemCount }
    },
    [getPageVariants, runEnglishColumnOcr],
  )

  const finishDetect = useCallback(
    async (
      found: PdfDetectedQuestion[],
      kind: PdfPageKind,
      sols: PdfDetectedSolution[],
      pack: { preview: string; usedOcr: boolean },
    ) => {
      setExtractPreview(pack.preview)
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
          }${pack.usedOcr ? ' · English OCR' : ' · page text'}.`,
        )
      }

      setDetectedQs(found)
      setPageKind(kind)
      if (!found.length) {
        setError(
          'No MCQs found. Try “OCR English column” — it reads only the left English side.',
        )
      } else {
        let next = mergeQuestionsIntoStore(storeRef.current, found)
        if (sols.length) next = mergeSolutionsIntoStore(next, sols)
        await persistStore(next)
      }
      setOpen(true)
    },
    [docId, page, persistStore],
  )

  const detectQuestions = useCallback(
    async (force = false, preferOcr = false) => {
      setError('')
      setInfo('')
      setExtractPreview('')
      setBusy(true)
      setBusyLabel('Reading page…')
      setPanel('review')
      try {
        const cached = force
          ? null
          : await getPageExtract(docId, page, 'questions')
        if (cached && Array.isArray(cached.payload) && cached.payload.length) {
          setDetectedQs(cached.payload as PdfDetectedQuestion[])
          setPageKind('questions')
          setInfo('Loaded saved detect for this page.')
          setOpen(true)
          return
        }

        // 1) Text-layer English columns
        let pack = await collectTexts(preferOcr)
        let local = pickBestQuestionsFromTexts(pack.texts, page)
        let sols = pickBestSolutionsFromTexts(pack.texts, page)

        // 2) If messy / empty → accurate path: OCR left English column only
        if (!isCleanDetect(local.questions) && !pack.usedOcr) {
          pack = await collectTexts(true)
          local = pickBestQuestionsFromTexts(pack.texts, page)
          sols = pickBestSolutionsFromTexts(pack.texts, page)
        }

        await finishDetect(local.questions, local.pageKind, sols, pack)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Detect failed')
        setOpen(true)
      } finally {
        setBusy(false)
      }
    },
    [collectTexts, docId, finishDetect, page],
  )

  const detectSolutions = useCallback(async () => {
    setError('')
    setInfo('')
    setBusy(true)
    setBusyLabel('Reading page…')
    try {
      let pack = await collectTexts(false)
      let found = pickBestSolutionsFromTexts(pack.texts, page)
      if (!found.length) {
        pack = await collectTexts(true)
        found = pickBestSolutionsFromTexts(pack.texts, page)
      }
      setExtractPreview(pack.preview)
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
  }, [collectTexts, docId, page, persistStore])

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
          busyLabel={busyLabel}
          error={error}
          info={info}
          extractPreview={extractPreview}
          forceSolutions={panel === 'solutions'}
          onClose={() => setOpen(false)}
          onStartDetect={() => void detectQuestions(true)}
          onOcrEnglish={() => void detectQuestions(true, true)}
          onDetectSolutions={() => void detectSolutions()}
        />
      )}
    </>
  )
}
