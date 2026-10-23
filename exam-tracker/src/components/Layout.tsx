import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useProgress } from '../hooks/useProgress'
import { AuthBar } from './AuthBar'
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
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/topics">Topics</NavLink>
          <NavLink to="/roadmap">Roadmap</NavLink>
          <NavLink to="/compare">Compare</NavLink>
          <NavLink to="/focus">Focus</NavLink>
          <NavLink to="/prep">Prep lab</NavLink>
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
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
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
