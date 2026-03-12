// src/LoginPage.jsx
import { useMemo, useState } from 'react'

function getApiBaseUrl() {
  // Backend OAuth base URL (optional)
  // Example: VITE_API_BASE_URL=http://localhost:8080
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const apiBase = useMemo(() => getApiBaseUrl(), [])

  const goHome = () => {
    window.location.hash = '#/'
  }

  const startOAuth = (provider) => {
    // Backend should implement:
    // /oauth2/authorization/google
    // /oauth2/authorization/github
    window.location.href = `${apiBase}/oauth2/authorization/${provider}`
  }

  const onSubmit = (e) => {
    e.preventDefault()
    alert('UI shell only: implement auth/OAuth in backend next.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" role="button" tabIndex={0} onClick={goHome} onKeyDown={(e) => e.key === 'Enter' && goHome()}>
          <div className="brand-mark" aria-hidden="true">🍳</div>
          <div className="brand-text">
            <div className="brand-name">Recipe Meal Planner</div>
            <div className="brand-sub">Find recipes • Save favorites • Plan your week</div>
          </div>
        </div>

        <nav className="topnav">
          <button className="nav-link" type="button" title="Coming soon">Browse</button>
          <button className="nav-link" type="button" title="Coming soon">Ingredients</button>
          <button className="nav-link" type="button" title="Coming soon">Meal Plans</button>
        </nav>

        <div className="auth">
          <button className="btn btn-ghost" type="button" onClick={goHome}>
            Back
          </button>
        </div>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero-card">
            <h1 className="hero-title">Log in</h1>
            <p className="hero-copy">
              This page is a UI shell so someone can implement OAuth in the backend next.
            </p>

            <div className="login-actions">
              <button className="btn btn-primary" type="button" onClick={() => startOAuth('google')}>
                Continue with Google
              </button>
              <button className="btn btn-outline" type="button" onClick={() => startOAuth('github')}>
                Continue with GitHub
              </button>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            <form className="login-form" onSubmit={onSubmit}>
              <label className="login-label">
                <span className="muted">Email</span>
                <input
                  className="search-input login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
              </label>

              <label className="login-label">
                <span className="muted">Password</span>
                <input
                  className="search-input login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                />
              </label>

              <button className="btn btn-primary" type="submit">
                Log in (stub)
              </button>

              <div className="muted" style={{ fontSize: 13 }}>
                Backend note: wire OAuth providers to <code>/oauth2/authorization/&lt;provider&gt;</code> and redirect back to the frontend.
              </div>
            </form>
          </div>

          <div className="hero-aside">
            <div className="mock phone">
              <div className="phone-top">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
              <div className="phone-body">
                <div className="mini-title">After login</div>
                <div className="mini-card">
                  <div className="mini-card-title">Save recipes</div>
                  <div className="mini-card-meta">Favorites • Collections</div>
                </div>
                <div className="mini-card">
                  <div className="mini-card-title">Build meal plans</div>
                  <div className="mini-card-meta">Drag recipes into your week</div>
                </div>
                <div className="mini-hint">OAuth backend implementation next</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}