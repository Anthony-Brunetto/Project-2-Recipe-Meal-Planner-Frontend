import { useEffect, useMemo, useState } from 'react'
import LoginPage from './LoginPage'
import { supabase } from './lib/supabaseClient'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || 'https://recipe-backend-production-2e13.up.railway.app'
}

function normalizeFeaturedRecipe(recipe, index) {
  const id = recipe?.id ?? `featured-${index}`
  const title = recipe?.name ?? `Recipe ${index + 1}`
  const time =
    typeof recipe?.cookTimeMinutes === 'number'
      ? `${recipe.cookTimeMinutes} min`
      : 'Time not listed'
  const tag = recipe?.category ?? recipe?.cuisine ?? recipe?.difficulty ?? 'Featured'
  const imageUrl = recipe?.imageUrl ?? null

  return { id, title, time, tag, imageUrl }
}

const FEATURED_RETRY_DELAYS_MS = [250, 500, 750, 1000, 1500, 2000, 3000]
const FEATURED_CACHE_KEY = 'featured-recipes-today'

function getCurrentUtcDayKey() {
  return new Date().toISOString().slice(0, 10)
}

function readFeaturedCache() {
  try {
    const raw = window.localStorage.getItem(FEATURED_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      parsed.dayKey !== getCurrentUtcDayKey() ||
      !Array.isArray(parsed.recipes)
    ) {
      return null
    }

    return parsed.recipes
  } catch (err) {
    console.error('Failed to read featured recipe cache.', err)
    return null
  }
}

function writeFeaturedCache(recipes) {
  try {
    window.localStorage.setItem(
      FEATURED_CACHE_KEY,
      JSON.stringify({
        dayKey: getCurrentUtcDayKey(),
        recipes,
      })
    )
  } catch (err) {
    console.error('Failed to write featured recipe cache.', err)
  }
}

function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [recipes, setRecipes] = useState([])
  const [error, setError] = useState('')
  const [featured, setFeatured] = useState([])
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [featuredError, setFeaturedError] = useState('')

  const [route, setRoute] = useState(() => (window.location.hash === '#/login' ? 'login' : 'home'))

  useEffect(() => {
    const onHashChange = () => {
      setRoute(window.location.hash === '#/login' ? 'login' : 'home')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadFeatured = async () => {
      setFeaturedError('')
      const cachedFeatured = readFeaturedCache()
      if (cachedFeatured?.length) {
        setFeatured(cachedFeatured)
        setFeaturedLoading(false)
        return
      }

      setFeaturedLoading(true)
      let attempt = 0

      while (!cancelled) {
        try {
          const response = await fetch(`${getApiBaseUrl()}/api/recipes/featured/today`, {
            cache: 'no-store',
          })
          if (!response.ok) {
            throw new Error(`Failed to load featured recipes (${response.status})`)
          }

          const payload = await response.json()
          if (!Array.isArray(payload)) {
            throw new Error('Featured recipes response did not return a list.')
          }

          const adapted = payload.map((recipe, index) => normalizeFeaturedRecipe(recipe, index))

          if (!cancelled) {
            setFeatured(adapted)
            writeFeaturedCache(adapted)
            setFeaturedError('')
            setFeaturedLoading(false)
          }
          return
        } catch (err) {
          console.error(err)
          const delay = FEATURED_RETRY_DELAYS_MS[Math.min(attempt, FEATURED_RETRY_DELAYS_MS.length - 1)]
          attempt += 1

          await new Promise((resolve) => {
            window.setTimeout(resolve, delay)
          })
        }
      }
    }

    loadFeatured()

    return () => {
      cancelled = true
    }
  }, [])

  const quickFilters = useMemo(
    () => ['Popular', 'Under 30 min', 'Vegetarian', 'High Protein', 'Budget', 'Meal Prep'],
    []
  )
  const featuredSkeletons = useMemo(() => Array.from({ length: 6 }, (_, index) => `featured-skeleton-${index}`), [])

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

  if (route === 'login') {
    return <LoginPage />
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
          <button className="btn btn-ghost" type="button" onClick={() => (window.location.hash = '#/login')}>
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
                {featuredLoading &&
                  featuredSkeletons.slice(0, 3).map((key) => (
                    <div key={key} className="mini-card mini-card-skeleton" aria-hidden="true">
                      <div className="mini-card-title mini-card-title-skeleton skeleton-block" />
                      <div className="mini-card-meta mini-card-meta-skeleton skeleton-block" />
                    </div>
                  ))}
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
            <p className="section-sub">Loaded from the backend featured recipes API.</p>
          </div>

          {featuredError && <div className="banner banner-warn">{featuredError}</div>}
          {!featuredLoading && !featuredError && featured.length === 0 && (
            <p className="muted">No featured recipes are available yet.</p>
          )}

          <div className="carousel">
            {featuredLoading &&
              featuredSkeletons.map((key) => (
                <article key={key} className="recipe-card recipe-card-skeleton" aria-hidden="true">
                  <div className="recipe-thumb recipe-thumb-skeleton">
                    <span className="recipe-tag recipe-tag-skeleton skeleton-block" />
                  </div>
                  <div className="recipe-body">
                    <div className="recipe-title recipe-title-skeleton skeleton-block" />
                    <div className="recipe-meta recipe-meta-skeleton skeleton-block" />
                    <div className="recipe-actions">
                      <span className="btn-skeleton skeleton-block" />
                      <span className="btn-skeleton skeleton-block" />
                    </div>
                  </div>
                </article>
              ))}
            {featured.map((r) => (
              <article key={r.id} className="recipe-card">
                <div
                  className="recipe-thumb"
                  aria-hidden="true"
                  style={r.imageUrl ? { backgroundImage: `url(${r.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                >
                  <span className="recipe-tag">{r.tag}</span>
                </div>
                <div className="recipe-body">
                  <div className="recipe-title">{r.title}</div>
                  <div className="recipe-meta">{r.time}</div>
                  <div className="recipe-actions">
                    <button className="btn btn-small btn-ghost" type="button" onClick={() => alert(`View recipe ${r.id} (next)`)}>
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
