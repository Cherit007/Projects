import { Link, NavLink, Outlet } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'

export function Layout() {
  const { stats, resetAll } = useProgress()

  return (
    <div className="app-shell">
      <div className="bg-atmosphere" aria-hidden />
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">EP</span>
          <span className="brand-text">
            <strong>ExamPulse</strong>
            <em>OBC · ECE/SDE · Officer track</em>
          </span>
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/topics">Topics</NavLink>
          <NavLink to="/compare">Compare</NavLink>
          <NavLink to="/focus">Focus</NavLink>
          <NavLink to="/prep">Prep lab</NavLink>
        </nav>
        <div className="topbar-stats">
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
