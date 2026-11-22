/** Free-tier Gemini vision helper (browser). Key stays on-device. */

const KEY_STORAGE = 'exampulse.geminiApiKey'
const MODEL_STORAGE = 'exampulse.geminiModel'
const DEFAULT_MODEL = 'gemini-2.0-flash'

export function getGeminiApiKey(): string {
  try {
    return (
      localStorage.getItem(KEY_STORAGE)?.trim() ||
      (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ||
      ''
    )
  } catch {
    return ''
  }
}

export function setGeminiApiKey(key: string) {
  localStorage.setItem(KEY_STORAGE, key.trim())
}

export function getGeminiModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE)?.trim() || DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
}

export function setGeminiModel(model: string) {
  localStorage.setItem(MODEL_STORAGE, model.trim() || DEFAULT_MODEL)
}

export function hasGeminiKey(): boolean {
  return getGeminiApiKey().length > 10
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }

export async function geminiJsonFromImage(opts: {
  prompt: string
  /** raw base64 without data: prefix */
  imageBase64: string
  mimeType?: string
  temperature?: number
}): Promise<unknown> {
  const key = getGeminiApiKey()
  if (!key) {
    throw new Error(
      'Add a free Gemini API key (PDF desk → Gemini key) to auto-detect questions.',
    )
  }
  const model = getGeminiModel()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(key)}`

  const parts: GeminiPart[] = [
    { text: opts.prompt },
    {
      inline_data: {
        mime_type: opts.mimeType || 'image/jpeg',
        data: opts.imageBase64,
      },
    },
  ]

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.1,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    if (res.status === 429) {
      throw new Error('Gemini free quota hit — try again later or use another key.')
    }
    if (res.status === 400 || res.status === 403) {
      throw new Error(
        'Gemini rejected the request — check the API key and that Vision is enabled.',
      )
    }
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 180)}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  if (!text.trim()) throw new Error('Gemini returned an empty response')

  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse Gemini JSON')
    return JSON.parse(match[0])
  }
}

export function canvasToJpegBase64(
  canvas: HTMLCanvasElement,
  quality = 0.72,
): { base64: string; dataUrl: string } {
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
  return { base64, dataUrl }
}
