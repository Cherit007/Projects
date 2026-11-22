/** Free-tier Gemini vision helper (browser). Key stays on-device. */

const KEY_STORAGE = 'exampulse.geminiApiKey'
const MODEL_STORAGE = 'exampulse.geminiModel'
/** Prefer lighter free Flash models — 3.8 often returns 503 under load */
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const MODEL_FALLBACKS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
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

/**
 * Strip copy/paste junk. New AI Studio keys look like `AQ.…`;
 * older ones look like `AIza…`. Headers must be Latin-1, so drop
 * anything outside printable ASCII.
 */
export function sanitizeGeminiKey(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '')
    .replace(/[^\x20-\x7E]/g, '')
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
  // AI Studio: AIza… (classic) or AQ.… (newer)
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
    return 'Gemini rejected the API key — PDF desk → Clear → paste again from AI Studio copy icon.'
  }
  if (status === 429 || /resource_exhausted|quota|rate/.test(blob)) {
    return 'Gemini free quota hit — wait a bit or try again later.'
  }
  if (status === 503 || /unavailable|high demand/.test(blob)) {
    return 'Gemini is busy (high demand) — try Detect again in a minute.'
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

type GenResult =
  | { ok: true; text: string }
  | { ok: false; status: number; errText: string }

async function generateOnce(opts: {
  key: string
  model: string
  prompt: string
  imageBase64: string
  mimeType: string
  temperature: number
  withThinking: boolean
}): Promise<GenResult> {
  // Put key in query string — avoids browser "non ISO-8859-1" header errors
  // with some pasted AQ.… keys / invisible unicode leftovers.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.model,
  )}:generateContent?key=${encodeURIComponent(opts.key)}`

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature,
    responseMimeType: 'application/json',
  }
  if (opts.withThinking) {
    generationConfig.thinkingConfig = { thinkingLevel: 'low' }
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
            ] satisfies GeminiPart[],
          },
        ],
        generationConfig,
      }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      status: 0,
      errText: JSON.stringify({
        error: {
          message: msg.includes('ISO-8859-1')
            ? 'Bad characters in the API key — Clear key and paste again from the AI Studio copy icon.'
            : msg,
        },
      }),
    }
  }

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

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse Gemini JSON')
    return JSON.parse(match[0])
  }
}

export async function geminiJsonFromImage(opts: {
  prompt: string
  /** raw base64 without data: prefix */
  imageBase64: string
  mimeType?: string
  temperature?: number
}): Promise<unknown> {
  const key = getGeminiApiKey()
  if (!key || key.length < 20) {
    throw new Error(
      'Add a free Gemini API key (PDF desk → Replace key, or Change API key here).',
    )
  }

  const preferred = getGeminiModel()
  const models = modelCandidates(preferred)
  let lastStatus = 0
  let lastErr = ''

  for (const model of models) {
    let result = await generateOnce({
      key,
      model,
      prompt: opts.prompt,
      imageBase64: opts.imageBase64,
      mimeType: opts.mimeType || 'image/jpeg',
      temperature: opts.temperature ?? 0.1,
      withThinking: true,
    })

    if (
      !result.ok &&
      result.status === 400 &&
      /thinking|thinkinglevel|thinking_level/i.test(result.errText)
    ) {
      result = await generateOnce({
        key,
        model,
        prompt: opts.prompt,
        imageBase64: opts.imageBase64,
        mimeType: opts.mimeType || 'image/jpeg',
        temperature: opts.temperature ?? 0.1,
        withThinking: false,
      })
    }

    if (result.ok) {
      if (model !== preferred) setGeminiModel(model)
      return parseJsonText(result.text)
    }

    lastStatus = result.status
    lastErr = result.errText
    const msg = parseGeminiError(result.status, result.errText).toLowerCase()

    if (
      result.status === 401 ||
      result.status === 403 ||
      result.status === 0 ||
      /api[_ ]?key|permission_denied|unauthenticated|consumer_invalid|bad characters/.test(
        msg,
      )
    ) {
      throw new Error(parseGeminiError(result.status, result.errText))
    }

    const tryNext =
      result.status === 404 ||
      result.status === 503 ||
      /no longer available|not found|not supported|unknown model|invalid model|high demand|unavailable/.test(
        msg,
      )

    if (!tryNext) {
      // one more attempt without thinking for generic 400s
      if (result.status === 400) {
        const retry = await generateOnce({
          key,
          model,
          prompt: opts.prompt,
          imageBase64: opts.imageBase64,
          mimeType: opts.mimeType || 'image/jpeg',
          temperature: opts.temperature ?? 0.1,
          withThinking: false,
        })
        if (retry.ok) {
          if (model !== preferred) setGeminiModel(model)
          return parseJsonText(retry.text)
        }
        lastStatus = retry.status
        lastErr = retry.errText
        if (
          retry.status === 404 ||
          retry.status === 503 ||
          /no longer available|not found|high demand/i.test(
            parseGeminiError(retry.status, retry.errText),
          )
        ) {
          continue
        }
        throw new Error(parseGeminiError(retry.status, retry.errText))
      }
      throw new Error(parseGeminiError(result.status, result.errText))
    }

    if (RETIRED_MODELS.has(model) || result.status === 404) {
      localStorage.setItem(MODEL_STORAGE, DEFAULT_MODEL)
    }
  }

  throw new Error(parseGeminiError(lastStatus, lastErr))
}

export function canvasToJpegBase64(
  canvas: HTMLCanvasElement,
  quality = 0.72,
): { base64: string; dataUrl: string } {
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
