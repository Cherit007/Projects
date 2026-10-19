import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AuthBar() {
  const { configured, user, loading, syncing, error, signInWithGoogle, signOutUser } =
    useAuth()

  if (!configured) {
    return (
      <div className="auth-bar">
        <Link className="btn ghost-btn auth-setup" to="/prep">
          Setup cloud login
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="auth-bar">
        <span className="auth-muted">Checking login…</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-bar">
        <button
          type="button"
          className="btn primary auth-login"
          onClick={() => void signInWithGoogle()}
          disabled={syncing}
        >
          {syncing ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {error && <span className="auth-error" title={error}>Sign-in issue</span>}
      </div>
    )
  }

  const label = user.displayName?.split(' ')[0] || user.email || 'You'

  return (
    <div className="auth-bar">
      {user.photoURL ? (
        <img className="auth-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="auth-avatar fallback">{label.slice(0, 1).toUpperCase()}</span>
      )}
      <span className="auth-name" title={user.email ?? undefined}>
        {label}
        {syncing ? ' · syncing' : ''}
      </span>
      <button type="button" className="ghost" onClick={() => void signOutUser()}>
        Sign out
      </button>
      {error && <span className="auth-error" title={error}>Sync issue</span>}
    </div>
  )
}
