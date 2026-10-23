/**
 * HashRouter owns `location.hash` for routes (`#/topics`).
 * Bare anchors like `#targets` steal the hash, break SPA nav, and scroll the page.
 * Convert leftover anchor-only hashes back to `#/` (optionally return the id to scroll).
 */
export function normalizeHashRoute(): string | null {
  if (typeof window === 'undefined') return null
  const { hash, pathname, search } = window.location
  if (!hash || hash === '#' || hash.startsWith('#/')) return null

  // e.g. #targets → route #/, remember "targets" for optional scroll
  const anchorId = decodeURIComponent(hash.slice(1).split('?')[0] || '')
  const base = `${pathname}${search}#/`
  window.history.replaceState(window.history.state, '', base)
  return anchorId || null
}
