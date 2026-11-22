/** Free-tier Gemini vision helper (browser). Key stays on-device. */

const KEY_STORAGE = 'exampulse.geminiApiKey'
const MODEL_STORAGE = 'exampulse.geminiModel'
const DEFAULT_MODEL = 'gemini-3.8-flash'
/** Retired ids that may still sit in localStorage from older builds */
const RETIRED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro-vision',
])

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
  const trimmed = key.trim()
  if (!trimmed) {
    localStorage.removeItem(KEY_STORAGE)
    return
  }
  localStorage.setItem(KEY_STORAGE, trimmed)
}

export function clearGeminiApiKey() {
  localStorage.removeItem(KEY_STORAGE)
}

/** Mask for UI — never re-show the full stored key. */
export function geminiKeyHint(): string {
  const key = getGeminiApiKey()
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

export function getGeminiModel(): string {
  try {
    const stored = localStorage.getItem(MODEL_STORAGE)?.trim() || ''
    if (!stored || RETIRED_MODELS.has(stored)) {
      if (stored && RETIRED_MODELS.has(stored)) {
        localStorage.setItem(MODEL_STORAGE, DEFAULT_MODEL)
      }
      return DEFAULT_MODEL
    }
    return stored
  } catch {
    return DEFAULT_MODEL
  }
}

export function setGeminiModel(model: string) {
  const next = model.trim() || DEFAULT_MODEL
  localStorage.setItem(
    MODEL_STORAGE,
    RETIRED_MODELS.has(next) ? DEFAULT_MODEL : next,
  )
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
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error(
        'Gemini rejected the API key — use Change API key / Replace key and paste a valid AI Studio key.',
      )
    }
    if (res.status === 404) {
      // Auto-heal retired model ids stuck in localStorage
      if (RETIRED_MODELS.has(model) || /no longer available/i.test(errText)) {
        localStorage.setItem(MODEL_STORAGE, DEFAULT_MODEL)
      }
      throw new Error(
        `Gemini model unavailable — switched default to ${DEFAULT_MODEL}. Tap Detect again.`,
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
