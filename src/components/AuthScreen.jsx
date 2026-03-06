import React, { useState } from 'react';

const AuthScreen = ({ onLogin, onRegister, onContinueAsViewer, loading }) => {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mode === 'login') {
      await onLogin({ email, password });
      return;
    }
    await onRegister({ name, email, password });
  };

  return (
    <div className="theme-page auth-page min-h-screen flex items-center justify-center p-4">
      <div className="theme-card auth-card w-full max-w-md rounded-3xl p-6 sm:p-8">
        <p className="text-xs uppercase tracking-widest text-slate-500 auth-kicker">Welcome</p>
        <h1 className="theme-title text-3xl font-bold mt-1">Badminton Dashboard</h1>
        <p className="text-sm text-slate-600 mt-2 auth-subtitle">Sign in to manage groups or continue as viewer.</p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setMode('login')}
            className={`auth-mode-btn flex-1 py-2 rounded-xl border ${mode === 'login' ? 'auth-mode-btn-active btn-brand border-transparent' : 'auth-mode-btn-inactive'}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            className={`auth-mode-btn flex-1 py-2 rounded-xl border ${mode === 'register' ? 'auth-mode-btn-active btn-brand border-transparent' : 'auth-mode-btn-inactive'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/85 auth-input"
              required
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/85 auth-input"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/85 auth-input"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-brand w-full py-2.5 rounded-xl font-semibold disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
          <p className="text-xs text-slate-500 text-center px-1 auth-help">
            {mode === 'login'
              ? 'After login, if your name matches an existing player/member in the selected group, you will get a link prompt.'
              : 'After register and group selection, if your name matches an existing player/member, you will get a link prompt.'}
          </p>
        </form>

        <button
          onClick={onContinueAsViewer}
          disabled={loading}
          className="mt-3 w-full py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold bg-white/80 disabled:opacity-50 auth-viewer-btn"
        >
          Continue as Viewer
        </button>
      </div>
    </div>
  );
};

export default AuthScreen;
