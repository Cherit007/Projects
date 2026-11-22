import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

/** Small JPEG cover for library cards. */
export async function makePdfCover(
  blob: Blob,
  maxEdge = 180,
): Promise<string | undefined> {
  try {
    const data = await blob.arrayBuffer()
    const doc = await pdfjs.getDocument({ data }).promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = maxEdge / Math.max(base.width, base.height)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      await doc.destroy()
      return undefined
    }
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    const url = canvas.toDataURL('image/jpeg', 0.72)
    await doc.destroy()
    return url
  } catch (e) {
    console.warn('PDF cover failed', e)
    return undefined
  }
}
