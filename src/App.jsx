import { useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'

function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [recipes, setRecipes] = useState([])
  const [error, setError] = useState('')

  const featured = useMemo(
    () => [
      { id: 1, title: 'Lemon Garlic Chicken', time: '25 min', tag: 'High Protein' },
      { id: 2, title: 'Creamy Tomato Pasta', time: '20 min', tag: 'Comfort' },
      { id: 3, title: 'Veggie Burrito Bowl', time: '30 min', tag: 'Meal Prep' },
      { id: 4, title: 'Honey Soy Salmon', time: '18 min', tag: 'Weeknight' },
      { id: 5, title: 'Greek Salad Wraps', time: '12 min', tag: 'Fresh' },
    ],
    []
  )

  const quickFilters = useMemo(
    () => ['Popular', 'Under 30 min', 'Vegetarian', 'High Protein', 'Budget', 'Meal Prep'],
    []
  )

  const onSearch = (e) => {
    e.preventDefault()
    alert(`Search (UI only for now): "${query}"`)
  }

  const loadRecipes = async () => {
    setError('')
    if (!supabase) {
      setError('Supabase is not configured yet. Make sure your .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart.')
      return
    }

    setLoading(true)
    try {
      // Match your schema: recipe_id, user_id, name, description, instructions
      const { data, error } = await supabase
        .from('Recipes')
        .select('recipe_id, user_id, name, description, instructions')
        .limit(20)

      if (error) throw error
      setRecipes(data ?? [])
    } catch (err) {
      console.error(err)
      setError('Could not load recipes from Supabase yet.')
      setRecipes([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
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
          <button className="btn btn-ghost" type="button" onClick={() => alert('Login page (next)')}>
            Log in
          </button>
          <button className="btn btn-primary" type="button" onClick={() => alert('Sign up page (next)')}>
            Sign up
          </button>
        </div>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero-card">
            <h1 className="hero-title">Cook something delicious tonight.</h1>
            <p className="hero-copy">
              Search recipes, save favorites, and drag them into a weekly meal plan.
              (Supabase wiring is in progress.)
            </p>

            <form className="search" onSubmit={onSearch}>
              <input
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes or ingredients… (e.g., chicken, rice, tomato)"
              />
              <button className="btn btn-primary" type="submit">Search</button>
            </form>

            <div className="chips">
              {quickFilters.map((f) => (
                <button key={f} type="button" className="chip" onClick={() => setQuery(f)}>
                  {f}
                </button>
              ))}
            </div>

            <div className="hero-actions">
              <button className="btn btn-ghost" type="button" onClick={() => alert('Guest browsing (next)')}>
                Browse as guest
              </button>

              <button className="btn btn-outline" type="button" onClick={loadRecipes} disabled={loading}>
                {loading ? 'Loading…' : 'Test Load: Recipes table'}
              </button>
            </div>

            {error && <div className="banner banner-warn">{error}</div>}
            {!!recipes.length && (
              <div className="banner banner-ok">
                Loaded <strong>{recipes.length}</strong> recipe{recipes.length === 1 ? '' : 's'} from Supabase ✅
              </div>
            )}
          </div>

          <div className="hero-aside">
            <div className="mock phone">
              <div className="phone-top">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
              <div className="phone-body">
                <div className="mini-title">Featured today</div>
                {featured.slice(0, 3).map((r) => (
                  <div key={r.id} className="mini-card">
                    <div className="mini-card-title">{r.title}</div>
                    <div className="mini-card-meta">{r.time} • {r.tag}</div>
                  </div>
                ))}
                <div className="mini-hint">Log in to save recipes → meal plans</div>
              </div>
            </div>
          </div>
        </section>

        {/* NEW: Real UI for loaded Supabase recipes */}
        {!!recipes.length && (
          <section className="section">
            <div className="section-head">
              <h2 className="section-title">Loaded from Supabase</h2>
              <p className="section-sub">This is what your “Test Load” returned.</p>
            </div>

            <div className="recipe-grid">
              {recipes.map((r) => (
                <article key={r.recipe_id} className="recipe-card2">
                  <div className="recipe-thumb2" aria-hidden="true">
                    <span className="pill">Recipe #{r.recipe_id}</span>
                  </div>

                  <div className="recipe-body2">
                    <div className="recipe-title2">{r.name}</div>
                    {r.description && <div className="recipe-desc2">{r.description}</div>}

                    {r.instructions && (
                      <div className="recipe-instructions2">
                        <strong>Instructions:</strong>
                        <div className="muted">{r.instructions}</div>
                      </div>
                    )}

                    <div className="recipe-actions2">
                      <button className="btn btn-small btn-ghost" type="button" onClick={() => alert(`View recipe ${r.recipe_id} (next)`)}>
                        View
                      </button>
                      <button className="btn btn-small btn-outline" type="button" onClick={() => alert('Save (requires login)')}>
                        Save
                      </button>
                    </div>

                    <div className="recipe-footnote">
                      <span className="muted">User: {r.user_id}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Featured recipes</h2>
            <p className="section-sub">Will be tied into Supabase soon.</p>
          </div>

          <div className="carousel">
            {featured.map((r) => (
              <article key={r.id} className="recipe-card">
                <div className="recipe-thumb" aria-hidden="true">
                  <span className="recipe-tag">{r.tag}</span>
                </div>
                <div className="recipe-body">
                  <div className="recipe-title">{r.title}</div>
                  <div className="recipe-meta">{r.time}</div>
                  <div className="recipe-actions">
                    <button className="btn btn-small btn-ghost" type="button" onClick={() => alert('View recipe (next)')}>
                      View
                    </button>
                    <button className="btn btn-small btn-outline" type="button" onClick={() => alert('Save recipe (requires auth)')}>
                      Save
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section how">
          <div className="section-head">
            <h2 className="section-title">How it works</h2>
            <p className="section-sub"></p>
          </div>

          <div className="grid3">
            <div className="step">
              <div className="step-num">1</div>
              <div className="step-title">Create an account</div>
              <div className="step-copy">Sign up and log in to save recipes and meal plans.</div>
            </div>

            <div className="step">
              <div className="step-num">2</div>
              <div className="step-title">Find recipes & ingredients</div>
              <div className="step-copy">Browse ingredients, build recipes, and save other users’ recipes.</div>
            </div>

            <div className="step">
              <div className="step-num">3</div>
              <div className="step-title">Plan your week</div>
              <div className="step-copy">Create meal plans and assign saved recipes to days of the week.</div>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="footer-inner">
            <span>© {new Date().getFullYear()} Recipe Meal Planner</span>
            <span className="muted"></span>
          </div>
        </footer>
      </main>
    </div>
  )
}

export default App