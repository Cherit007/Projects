/** Free-tier Gemini vision helper (browser). Key stays on-device. */

const KEY_STORAGE = 'exampulse.geminiApiKey'
const MODEL_STORAGE = 'exampulse.geminiModel'
const DEFAULT_MODEL = 'gemini-3.8-flash'
/** Prefer flash models that support vision + free tier */
const MODEL_FALLBACKS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const
/** Retired ids that may still sit in localStorage from older builds */
const RETIRED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro-vision',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
])

export function getGeminiApiKey(): string {
  try {
    return (
      sanitizeGeminiKey(localStorage.getItem(KEY_STORAGE) || '') ||
      sanitizeGeminiKey(
        (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '',
      )
    )
  } catch {
    return ''
  }
}

/** Strip copy/paste junk (quotes, Bearer, zero-width, newlines). */
export function sanitizeGeminiKey(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '')
}

export function setGeminiApiKey(key: string) {
  const trimmed = sanitizeGeminiKey(key)
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
  const key = getGeminiApiKey()
  // Real AI Studio keys are long and usually start with AIza
  return key.length >= 20
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }

function parseGeminiError(status: number, errText: string): string {
  let message = ''
  let statusText = ''
  try {
    const parsed = JSON.parse(errText) as {
      error?: { message?: string; status?: string; code?: number }
    }
    message = parsed.error?.message || ''
    statusText = parsed.error?.status || ''
  } catch {
    message = errText.slice(0, 220)
  }

  const blob = `${statusText} ${message}`.toLowerCase()
  if (
    status === 401 ||
    status === 403 ||
    /api[_ ]?key[_ ]?invalid|permission_denied|consumer_invalid|unauthenticated/.test(
      blob,
    )
  ) {
    return 'Gemini rejected the API key — open PDF desk → Clear → paste the key again from AI Studio (copy icon).'
  }
  if (status === 429 || /resource_exhausted|quota|rate/.test(blob)) {
    return 'Gemini free quota hit — wait a bit or try again tomorrow.'
  }
  if (status === 404 || /not found|no longer available/.test(blob)) {
    return message || 'Gemini model not found — trying another free Flash model.'
  }
  if (message) return `Gemini: ${message.slice(0, 220)}`
  return `Gemini error ${status}`
}

function modelCandidates(preferred: string): string[] {
  const list = [preferred, ...MODEL_FALLBACKS]
  return [...new Set(list.filter((m) => m && !RETIRED_MODELS.has(m)))]
}

async function generateOnce(opts: {
  key: string
  model: string
  prompt: string
  imageBase64: string
  mimeType: string
  temperature: number
}): Promise<{ ok: true; text: string } | { ok: false; status: number; errText: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.model,
  )}:generateContent`

  const parts: GeminiPart[] = [
    { text: opts.prompt },
    {
      inline_data: {
        mime_type: opts.mimeType,
        data: opts.imageBase64,
      },
    },
  ]

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.key,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: opts.temperature,
        // snake_case also accepted; camelCase is the REST JSON form
        responseMimeType: 'application/json',
        // Keep free-tier vision extracts cheap/fast on 3.x Flash
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return { ok: false, status: res.status, errText }
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
    ''
  if (!text.trim()) {
    return {
      ok: false,
      status: 502,
      errText: JSON.stringify({
        error: { message: 'Gemini returned an empty response' },
      }),
    }
  }
  return { ok: true, text }
}

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
  if (!key.startsWith('AIza') || key.length < 20) {
    throw new Error(
      'That does not look like an AI Studio key (should start with AIza…). Clear and paste again from the copy icon.',
    )
  }

  const preferred = getGeminiModel()
  const models = modelCandidates(preferred)
  let lastStatus = 0
  let lastErr = ''

  for (const model of models) {
    const result = await generateOnce({
      key,
      model,
      prompt: opts.prompt,
      imageBase64: opts.imageBase64,
      mimeType: opts.mimeType || 'image/jpeg',
      temperature: opts.temperature ?? 0.1,
    })
    if (result.ok) {
      if (model !== preferred) setGeminiModel(model)
      try {
        return JSON.parse(result.text)
      } catch {
        const match = result.text.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Could not parse Gemini JSON')
        return JSON.parse(match[0])
      }
    }

    lastStatus = result.status
    lastErr = result.errText
    const msg = parseGeminiError(result.status, result.errText).toLowerCase()
    const tryNext =
      result.status === 404 ||
      /no longer available|not found|not supported|unknown model|invalid model/.test(
        msg,
      ) ||
      (result.status === 400 && /thinking|thinkinglevel|thinking_level/.test(msg))

    // Auth failures: don't keep trying other models
    if (
      result.status === 401 ||
      result.status === 403 ||
      /api[_ ]?key|permission_denied|unauthenticated|consumer_invalid/.test(msg)
    ) {
      throw new Error(parseGeminiError(result.status, result.errText))
    }

    if (!tryNext) {
      // Retry once without thinkingConfig for odd 400s
      if (result.status === 400) {
        const retry = await generateOnceNoThinking({
          key,
          model,
          prompt: opts.prompt,
          imageBase64: opts.imageBase64,
          mimeType: opts.mimeType || 'image/jpeg',
          temperature: opts.temperature ?? 0.1,
        })
        if (retry.ok) {
          if (model !== preferred) setGeminiModel(model)
          try {
            return JSON.parse(retry.text)
          } catch {
            const match = retry.text.match(/\{[\s\S]*\}/)
            if (!match) throw new Error('Could not parse Gemini JSON')
            return JSON.parse(match[0])
          }
        }
        lastStatus = retry.status
        lastErr = retry.errText
        const retryMsg = parseGeminiError(retry.status, retry.errText)
        if (
          retry.status === 401 ||
          retry.status === 403 ||
          /api[_ ]?key|permission_denied/i.test(retryMsg)
        ) {
          throw new Error(retryMsg)
        }
        // fall through to next model only for model/feature issues
        if (
          !(
            retry.status === 404 ||
            /no longer available|not found|not supported|unknown model/i.test(
              retryMsg,
            )
          )
        ) {
          throw new Error(retryMsg)
        }
      } else {
        throw new Error(parseGeminiError(result.status, result.errText))
      }
    }

    if (RETIRED_MODELS.has(model) || result.status === 404) {
      localStorage.setItem(MODEL_STORAGE, DEFAULT_MODEL)
    }
  }

  throw new Error(parseGeminiError(lastStatus, lastErr))
}

async function generateOnceNoThinking(opts: {
  key: string
  model: string
  prompt: string
  imageBase64: string
  mimeType: string
  temperature: number
}): Promise<{ ok: true; text: string } | { ok: false; status: number; errText: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.model,
  )}:generateContent`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.key,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: opts.prompt },
            {
              inline_data: {
                mime_type: opts.mimeType,
                data: opts.imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: opts.temperature,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return { ok: false, status: res.status, errText }
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
    ''
  if (!text.trim()) {
    return {
      ok: false,
      status: 502,
      errText: JSON.stringify({
        error: { message: 'Gemini returned an empty response' },
      }),
    }
  }
  return { ok: true, text }
}

export function canvasToJpegBase64(
  canvas: HTMLCanvasElement,
  quality = 0.72,
): { base64: string; dataUrl: string } {
  // Downscale huge pages so free-tier payloads stay under limits
  const maxEdge = 1600
  const w = canvas.width
  const h = canvas.height
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  if (scale < 0.999) {
    const off = document.createElement('canvas')
    off.width = Math.max(1, Math.round(w * scale))
    off.height = Math.max(1, Math.round(h * scale))
    const ctx = off.getContext('2d')
    if (ctx) {
      ctx.drawImage(canvas, 0, 0, off.width, off.height)
      const dataUrl = off.toDataURL('image/jpeg', quality)
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
      return { base64, dataUrl }
    }
  }
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
  return { base64, dataUrl }
}
