import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useProgress } from '../hooks/useProgress'
import { AppNavLink } from './AppNavLink'
import { AuthBar } from './AuthBar'
import { ScrollToTop } from './ScrollToTop'
import { ToastHost } from './ToastHost'
import { WeeklyDigestHost } from './WeeklyDigestHost'

const PRIMARY = [
  { to: '/', end: true, label: 'Home', short: 'Home' },
  { to: '/topics', end: false, label: 'Topics', short: 'Topics' },
  { to: '/youtube', end: false, label: 'YouTube', short: 'Watch' },
  { to: '/prep', end: false, label: 'Prep lab', short: 'Prep' },
] as const

const MORE = [
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/compare', label: 'Compare' },
  { to: '/focus', label: 'Focus' },
] as const

const BOTTOM = [
  { to: '/', end: true, label: 'Home', icon: 'home' },
  { to: '/topics', end: false, label: 'Topics', icon: 'topics' },
  { to: '/youtube', end: false, label: 'Watch', icon: 'watch' },
  { to: '/prep', end: false, label: 'Prep', icon: 'prep' },
] as const

function NavIcon({ name }: { name: (typeof BOTTOM)[number]['icon'] }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      )
    case 'topics':
      return (
        <svg {...common}>
          <path d="M8 6h12M8 12h12M8 18h12" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      )
    case 'watch':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="2.5" />
          <path d="m10 10 5 2.5L10 15v-5Z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'prep':
      return (
        <svg {...common}>
          <path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z" />
        </svg>
      )
  }
}

export function Layout() {
  const { stats, resetAll } = useProgress()
  const { user } = useAuth()
  const location = useLocation()
  const moreId = useId()
  const moreRef = useRef<HTMLDetailsElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = MORE.some(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`),
  )

  useEffect(() => {
    setMoreOpen(false)
    const el = moreRef.current
    if (el) el.open = false
  }, [location.pathname])

  useEffect(() => {
    if (!moreOpen) return
    const onPointer = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) {
        setMoreOpen(false)
        if (moreRef.current) moreRef.current.open = false
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false)
        if (moreRef.current) moreRef.current.open = false
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  return (
    <div className="app-shell">
      <ScrollToTop />
      <div className="bg-atmosphere" aria-hidden />
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">EP</span>
            <span className="brand-text">
              <strong>ExamPulse</strong>
              <em>
                {user?.displayName
                  ? `${user.displayName.split(' ')[0]} · OBC track`
                  : 'OBC · ECE/SDE · Officer track'}
              </em>
            </span>
          </Link>

          <nav className="nav-rail nav-desktop" aria-label="Primary">
            <div className="nav-rail-links">
              {PRIMARY.map((item) => (
                <AppNavLink key={item.to} to={item.to} end={item.end}>
                  {item.label}
                </AppNavLink>
              ))}
            </div>
            <details
              ref={moreRef}
              className={`nav-more${moreActive ? ' has-active' : ''}`}
              open={moreOpen}
              onToggle={(e) => setMoreOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary aria-controls={moreId}>
                More
                <span className="nav-more-caret" aria-hidden />
              </summary>
              <div id={moreId} className="nav-more-panel" role="menu">
                {MORE.map((item) => (
                  <AppNavLink key={item.to} to={item.to} className="nav-more-item">
                    {item.label}
                  </AppNavLink>
                ))}
              </div>
            </details>
          </nav>

          <div className="topbar-aside">
            <div className="pulse-meter" aria-label="Today’s pulse">
              <span className="pulse-pct">{stats.pct}%</span>
              <span className="pulse-sep" aria-hidden />
              <span>{stats.minutesToday}m</span>
              <span className="pulse-sep" aria-hidden />
              <span className="pulse-streak" title="Streak">
                {stats.streak}d
              </span>
            </div>
            <AuthBar />
            <button
              type="button"
              className="ghost topbar-reset"
              onClick={resetAll}
              title="Reset all local progress"
            >
              Reset
            </button>
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Primary">
        {BOTTOM.map((item) => (
          <AppNavLink key={item.to} to={item.to} end={item.end} className="bottom-nav-link">
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </AppNavLink>
        ))}
      </nav>
      <ToastHost />
      <WeeklyDigestHost />
      <footer className="footer">
        <p>
          Data from your OBC target jobs canvas · Syllabus aligned with EduTap,
          Oliveboard, Adda247, GATE Academy patterns · Verify each official
          notification.
        </p>
      </footer>
    </div>
  )
}
