import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useProgress } from '../hooks/useProgress'
import { AppNavLink } from './AppNavLink'
import { AuthBar } from './AuthBar'
import { ScrollToTop } from './ScrollToTop'
import { ToastHost } from './ToastHost'
import { WeeklyDigestHost } from './WeeklyDigestHost'

const BOTTOM = [
  { to: '/', end: true, label: 'Targets' },
  { to: '/topics', end: false, label: 'Topics' },
  { to: '/roadmap', end: false, label: 'Roadmap' },
  { to: '/prep', end: false, label: 'Prep' },
] as const

export function Layout() {
  const { stats, resetAll } = useProgress()
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <ScrollToTop />
      <div className="bg-atmosphere" aria-hidden />
      <header className="topbar">
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
        <nav className="nav nav-desktop">
          <AppNavLink to="/" end>
            Dashboard
          </AppNavLink>
          <AppNavLink to="/topics">Topics</AppNavLink>
          <AppNavLink to="/roadmap">Roadmap</AppNavLink>
          <AppNavLink to="/compare">Compare</AppNavLink>
          <AppNavLink to="/focus">Focus</AppNavLink>
          <AppNavLink to="/prep">Prep lab</AppNavLink>
        </nav>
        <div className="topbar-stats">
          <AuthBar />
          <span>
            {stats.pct}% · {stats.minutesToday}m · 🔥{stats.streak}
          </span>
          <button type="button" className="ghost" onClick={resetAll}>
            Reset
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Primary">
        {BOTTOM.map((item) => (
          <AppNavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
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
