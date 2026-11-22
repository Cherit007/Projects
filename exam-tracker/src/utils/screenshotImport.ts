/** OCR screenshots → English MCQs + answer-key mapping for the practice bank. */

import {
  extractQuestionsFromPageText,
  extractSolutionsFromPageText,
  pickBestQuestionsFromTexts,
  pickBestSolutionsFromTexts,
} from './pdfPageQuizLocal'
import type { AnswerKey } from './questionBank'
import type { PdfDetectedQuestion } from './pdfPageQuiz'

export type ImportedMcq = {
  number: number
  stem: string
  options: Partial<Record<AnswerKey, string>>
  answerKey: AnswerKey
  explanation?: string
  /** Source screenshot kept for review */
  imageDataUrl: string
  solutionImageDataUrl?: string
  confidence: number
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const maxW = 1600
  const scale = Math.min(1, maxW / Math.max(1, bitmap.width))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas unavailable')
  }
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

async function ocrFile(
  file: File,
  onProgress?: (label: string) => void,
): Promise<{ text: string; dataUrl: string }> {
  onProgress?.(`OCR ${file.name}…`)
  const canvas = await fileToCanvas(file)
  const { ocrCanvasToText } = await import('./pdfPageOcr')
  const text = await ocrCanvasToText(canvas, (pct) => {
    onProgress?.(`OCR ${file.name}… ${pct}%`)
  })
  const dataUrl = canvas.toDataURL('image/jpeg', 0.72)
  return { text, dataUrl }
}

function defaultKey(q: PdfDetectedQuestion): AnswerKey {
  if (q.guessedAnswer) return q.guessedAnswer
  return 'A'
}

/**
 * Scan question screenshots (+ optional answer-key / solution shots).
 * English only — Hindi OCR noise is stripped by the shared parsers.
 * Solutions are optional — pass `answerKeyByNumber` to map keys without solution text.
 */
export async function importMcqsFromScreenshots(opts: {
  questionFiles: File[]
  solutionFiles?: File[]
  /** Optional pre-known answer key by question number (solutions not required). */
  answerKeyByNumber?: Partial<Record<number, AnswerKey>>
  onProgress?: (label: string) => void
}): Promise<{ items: ImportedMcq[]; preview: string }> {
  const qFiles = opts.questionFiles.filter((f) => f.type.startsWith('image/'))
  const sFiles = (opts.solutionFiles || []).filter((f) =>
    f.type.startsWith('image/'),
  )
  if (!qFiles.length) throw new Error('Pick at least one question screenshot.')

  const qTexts: string[] = []
  const qImages: string[] = []
  for (const f of qFiles) {
    const { text, dataUrl } = await ocrFile(f, opts.onProgress)
    if (text.trim().length >= 20) qTexts.push(text)
    qImages.push(dataUrl)
  }

  const sTexts: string[] = []
  let solutionImage: string | undefined
  for (const f of sFiles) {
    const { text, dataUrl } = await ocrFile(f, opts.onProgress)
    if (text.trim().length >= 8) sTexts.push(text)
    if (!solutionImage) solutionImage = dataUrl
  }

  opts.onProgress?.('Parsing English MCQs…')
  const parsed = pickBestQuestionsFromTexts(qTexts, 1)
  const sols = pickBestSolutionsFromTexts(
    [...sTexts, ...qTexts],
    1,
  )
  const solByNum = new Map(sols.map((s) => [s.number, s]))

  // Also try per-file parse so page-local numbering maps cleanly
  const perFile: PdfDetectedQuestion[] = []
  for (let i = 0; i < qTexts.length; i += 1) {
    const local = extractQuestionsFromPageText(qTexts[i], i + 1)
    for (const q of local.questions) {
      if (!perFile.some((p) => p.number === q.number && p.stem === q.stem)) {
        perFile.push(q)
      }
    }
  }

  const pool =
    parsed.questions.length >= perFile.length ? parsed.questions : perFile

  const keyMap = opts.answerKeyByNumber ?? {}

  const items: ImportedMcq[] = pool
    .filter((q) => Object.keys(q.options).length >= 2 && q.stem.length >= 20)
    .map((q, idx) => {
      const sol = solByNum.get(q.number)
      const fromMap = keyMap[q.number]
      const answerKey = fromMap || (sol?.answer ? sol.answer : defaultKey(q))
      // Attach nearest screenshot (multi-Q page → first image; else by index)
      const imageDataUrl =
        qImages[Math.min(idx, qImages.length - 1)] || qImages[0]
      return {
        number: q.number,
        stem: q.stem,
        options: q.options as Partial<Record<AnswerKey, string>>,
        answerKey,
        explanation: sol
          ? `Answer key: (${sol.answer.toLowerCase()})`
          : fromMap
            ? `Answer key: (${fromMap.toLowerCase()})`
            : undefined,
        imageDataUrl,
        solutionImageDataUrl: solutionImage,
        confidence: q.confidence,
      }
    })

  // Fallback: if page-level parse failed, try raw single extracts
  if (!items.length) {
    for (let i = 0; i < qTexts.length; i += 1) {
      const local = extractQuestionsFromPageText(qTexts[i], 1)
      for (const q of local.questions) {
        if (Object.keys(q.options).length < 2) continue
        const sol = extractSolutionsFromPageText(qTexts[i], 1).find(
          (s) => s.number === q.number,
        )
        items.push({
          number: q.number || i + 1,
          stem: q.stem,
          options: q.options as Partial<Record<AnswerKey, string>>,
          answerKey: sol?.answer || defaultKey(q),
          imageDataUrl: qImages[i] || qImages[0],
          solutionImageDataUrl: solutionImage,
          confidence: q.confidence,
        })
      }
    }
  }

  const preview = qTexts.join('\n---\n').slice(0, 1200)
  return { items, preview }
}
