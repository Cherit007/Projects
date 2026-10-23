import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode, MouseEvent } from 'react'

type Props = {
  to: string
  end?: boolean
  children: ReactNode
  className?: string
}

/**
 * Nav helper that always preventDefault + navigate().
 * Avoids bare hash <a> fallbacks that change the URL without updating RR7 state.
 */
export function AppNavLink({ to, end = false, children, className }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname || '/'
  const active = end
    ? pathname === to
    : to === '/'
      ? pathname === '/'
      : pathname === to || pathname.startsWith(`${to}/`)

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (pathname === to) return
    navigate(to)
  }

  return (
    <a
      href={`#${to === '/' ? '/' : to}`}
      className={[className, active ? 'active' : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </a>
  )
}
