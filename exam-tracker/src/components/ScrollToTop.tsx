import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/** Reset window scroll on every client-side route change. */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    // Don't fight in-page scrollIntoView for same-route anchors
    if (navType === 'POP' && hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, search, navType, hash])

  return null
}
