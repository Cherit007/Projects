/**
 * Turn messy PDF-extracted exam math into readable HTML
 * (√, powers, BODMAS-friendly spacing) without KaTeX.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Clean raw PDF text before display / parse. */
export function tidyMathPlain(raw: string): string {
  let s = raw
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    // Common PDF OCR / extract spellings
    .replace(/\bsqrt\b/gi, '√')
    .replace(/\bcube\s*root\b/gi, '∛')
    .replace(/\bsquare\s*root\b/gi, '√')
    .replace(/\bdiv(?:ided)?\s*by\b/gi, '÷')
    // BODMAS "of" / "into" between quantities only
    .replace(/(\d|(?:\)))\s+of\s+(\d|(?:\())/gi, '$1 × $2')
    .replace(/(\d|(?:\)))\s+into\s+(\d|(?:\())/gi, '$1 × $2')
    // Operators
    .replace(/\*/g, '×')
    .replace(/(\d|\))\s*[xX]\s*(\d|\()/g, '$1 × $2')
    .replace(/!=/g, '≠')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/=\s*=/g, '=')
    // Spaces around binary ops (not touching parentheses)
    .replace(/([^\s])([+\-×÷=≠≤≥])([^\s])/g, '$1 $2 $3')
    .replace(/([^\s])([+\-×÷=≠≤≥])\s+/g, '$1 $2 ')
    .replace(/\s+([+\-×÷=≠≤≥])([^\s])/g, ' $1 $2')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*\^\s*/g, '^')
    .replace(/√\s*\(/g, '√(')
    .replace(/√\s+/g, '√')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return s
}

function wrapSup(inner: string): string {
  return `<sup class="qmath-sup">${inner}</sup>`
}

function wrapSub(inner: string): string {
  return `<sub class="qmath-sub">${inner}</sub>`
}

function wrapSqrt(inner: string): string {
  return `<span class="qmath-sqrt"><span class="qmath-sqrt-sym" aria-hidden="true">√</span><span class="qmath-sqrt-rad">${inner}</span></span>`
}

function wrapCbrt(inner: string): string {
  return `<span class="qmath-sqrt qmath-cbrt"><span class="qmath-sqrt-sym" aria-hidden="true">∛</span><span class="qmath-sqrt-rad">${inner}</span></span>`
}

function wrapFrac(num: string, den: string): string {
  return `<span class="qmath-frac"><span class="qmath-num">${num}</span><span class="qmath-bar"></span><span class="qmath-den">${den}</span></span>`
}

function wrapGroup(inner: string): string {
  return `<span class="qmath-group">(${inner})</span>`
}

/**
 * Convert a tidy plain string into HTML with math spans.
 * Safe: escapes first, then injects only our tags.
 */
export function formatQuizMathHtml(raw: string): string {
  let s = escapeHtml(tidyMathPlain(raw))

  // √( ... ) and ∛( ... ) — balanced-ish single level
  const radicalPass = (
    input: string,
    sym: '√' | '∛',
    wrap: (inner: string) => string,
  ) => {
    let out = ''
    let i = 0
    while (i < input.length) {
      if (input[i] === sym && input[i + 1] === '(') {
        let depth = 0
        let j = i + 1
        for (; j < input.length; j += 1) {
          if (input[j] === '(') depth += 1
          else if (input[j] === ')') {
            depth -= 1
            if (depth === 0) {
              j += 1
              break
            }
          }
        }
        const inner = input.slice(i + 2, j - 1)
        out += wrap(inner)
        i = j
        continue
      }
      if (input[i] === sym) {
        // √16 or √x — take following atom
        const m = input.slice(i + 1).match(/^([0-9]+|[A-Za-z]+)/)
        if (m) {
          out += wrap(m[1])
          i += 1 + m[1].length
          continue
        }
      }
      out += input[i]
      i += 1
    }
    return out
  }

  s = radicalPass(s, '√', wrapSqrt)
  s = radicalPass(s, '∛', wrapCbrt)

  // a^(...) or a^b  (after radicals so √ isn't broken)
  // Also allow power right after a closed radical span
  s = s.replace(
    /(<\/span>|<\/sup>|[A-Za-z0-9)\]}])\^\(([^)]{1,48})\)/g,
    (_, base: string, exp: string) => `${base}${wrapSup(exp)}`,
  )
  s = s.replace(
    /(<\/span>|<\/sup>|[A-Za-z0-9)\]}])\^([A-Za-z0-9±+\-]{1,8})/g,
    (_, base: string, exp: string) => `${base}${wrapSup(exp)}`,
  )

  // Underscore subscripts: a_n, x_1
  s = s.replace(
    /([A-Za-z0-9)])_([A-Za-z0-9]{1,6})/g,
    (_, base: string, sub: string) => `${base}${wrapSub(sub)}`,
  )

  // Simple stacked fractions: (a)/(b) or number/number when short
  s = s.replace(
    /\(([^()]{1,40})\)\s*\/\s*\(([^()]{1,40})\)/g,
    (_, num: string, den: string) => wrapFrac(num.trim(), den.trim()),
  )
  s = s.replace(
    /(^|[^\w./])(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?![\w./])/g,
    (_, pre: string, num: string, den: string) => `${pre}${wrapFrac(num, den)}`,
  )

  // Emphasize top-level operators for BODMAS readability
  s = s.replace(
    / (×|÷|\+|−|-|=|≠|≤|≥) /g,
    ' <span class="qmath-op">$1</span> ',
  )

  // Nested paren groups (visual cue) — only plain (...) left
  s = s.replace(/\(([^<>()]{1,60})\)/g, (_, inner: string) => wrapGroup(inner))

  return s
}

export function looksLikeMath(raw: string): boolean {
  const s = raw || ''
  return /[√∛^×÷≤≥≠]|sqrt|\d\s*\/\s*\d|\^[(\d]|_\d/i.test(s)
}
