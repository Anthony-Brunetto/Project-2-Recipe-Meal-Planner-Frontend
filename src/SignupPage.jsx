import { useState } from 'react'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const goHome = () => {
    window.location.hash = '#/'
  }

  const goLogin = () => {
    window.location.hash = '#/login'
  }

  const onSubmit = (e) => {
    e.preventDefault()
    alert('UI shell only: implement signup/auth later.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div
          className="brand"
          role="button"
          tabIndex={0}
          onClick={goHome}
          onKeyDown={(e) => e.key === 'Enter' && goHome()}
        >
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
            <h1 className="hero-title">Create your account</h1>
            <p className="hero-copy">
              Build your recipe collection, save favorites, and start planning meals for the week.
            </p>

            <form className="login-form" onSubmit={onSubmit}>
              <label className="login-label">
                <span className="muted">Full name</span>
                <input
                  className="search-input login-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  type="text"
                  autoComplete="name"
                />
              </label>

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
                  placeholder="Create a password"
                  type="password"
                  autoComplete="new-password"
                />
              </label>

              <label className="login-label">
                <span className="muted">Confirm password</span>
                <input
                  className="search-input login-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  type="password"
                  autoComplete="new-password"
                />
              </label>

              <button className="btn btn-primary" type="submit">
                Create account
              </button>

              <div className="muted" style={{ fontSize: 13 }}>
                Already have an account?{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={goLogin}
                >
                  Log in
                </button>
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
                <div className="mini-title">With an account you can</div>

                <div className="mini-card">
                  <div className="mini-card-title">Save recipes</div>
                  <div className="mini-card-meta">Keep favorites in one place</div>
                </div>

                <div className="mini-card">
                  <div className="mini-card-title">Create meal plans</div>
                  <div className="mini-card-meta">Organize meals by day</div>
                </div>

                <div className="mini-card">
                  <div className="mini-card-title">Build collections</div>
                  <div className="mini-card-meta">Breakfast • Lunch • Dinner</div>
                </div>

                <div className="mini-hint">Auth wiring can be added next</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}