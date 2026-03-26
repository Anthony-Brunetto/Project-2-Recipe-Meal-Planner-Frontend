import { useEffect, useMemo, useState } from "react";
import LoginPage from "./LoginPage";
import MealPlansPage from "./MealPlansPage";
import RecipesPage from "./RecipesPage";
import { useAuth } from "./AuthContext";
import { supabase } from "./lib/supabaseClient";
import { apiFetch } from "./api";

function sampleRandomItems(items, count) {
    const copied = [...items];
    for (let i = copied.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied.slice(0, count);
}

function normalizeFeaturedRecipe(recipe, index) {
    const id = recipe.id ?? recipe.recipe_id ?? `featured-${index}`;
    const title = recipe.name ?? recipe.title ?? `Recipe ${index + 1}`;
    const rawTime =
        recipe.cookTimeMinutes ??
        recipe.cook_time_minutes ??
        recipe.totalTimeMinutes ??
        recipe.time;
    const time = typeof rawTime === "number" ? `${rawTime} min` : rawTime || "";
    const tag =
        recipe.category ?? recipe.cuisine ?? recipe.difficulty ?? "Featured";

    return { id, title, time, tag, details: recipe };
}

function toLabel(key) {
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (char) => char.toUpperCase());
}

function toDisplayValue(value) {
    if (value == null || value === "") return "N/A";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function shouldShowRecipeDetail(key) {
    const normalized = key.toLowerCase();
    return ![
        "originaluser",
        "original_user",
        "recipeid",
        "recipe_id",
        "user",
        "userid",
        "user_id",
    ].includes(normalized);
}

function getRouteFromHash() {
    const hashPath = window.location.hash.split("?")[0];
    if (hashPath === "#/login") {
        return "login";
    }
    if (hashPath === "#/recipes") {
        return "recipes";
    }
    if (hashPath === "#/meal-plans") {
        return "meal-plans";
    }
    return "home";
}

function TopBar({ route, session, onLogout }) {
    return (
        <header className="topbar">
            <div
                className="brand"
                role="button"
                tabIndex={0}
                onClick={() => (window.location.hash = "#/")}
                onKeyDown={(e) =>
                    e.key === "Enter" && (window.location.hash = "#/")
                }
            >
                <div className="brand-mark" aria-hidden="true">
                    🍳
                </div>
                <div className="brand-text">
                    <div className="brand-name">MealMap</div>
                    <div className="brand-sub">
                        Find recipes • Save favorites • Plan your week
                    </div>
                </div>
            </div>

            <nav className="topnav">
                <button
                    className={`nav-link ${route === "home" ? "active" : ""}`}
                    type="button"
                    onClick={() => (window.location.hash = "#/")}
                >
                    Home
                </button>
                <button
                    className={`nav-link ${route === "recipes" ? "active" : ""}`}
                    type="button"
                    onClick={() => (window.location.hash = "#/recipes")}
                >
                    Recipes
                </button>
                <button
                    className={`nav-link ${route === "meal-plans" ? "active" : ""}`}
                    type="button"
                    onClick={() => (window.location.hash = "#/meal-plans")}
                >
                    Meal Plans
                </button>
            </nav>
            <div className="auth">
                {session ? (
                    <>
                        <span className="muted" style={{ fontSize: 13 }}>
                            {session.user.email}
                        </span>
                        <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={onLogout}
                        >
                            Log out
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => (window.location.hash = "#/login")}
                        >
                            Log in
                        </button>
                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => (window.location.hash = "#/login")}
                        >
                            Sign up
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}

function App() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [recipes, setRecipes] = useState([]);
    const [error, setError] = useState("");
    const [featured, setFeatured] = useState([]);
    const [featuredLoading, setFeaturedLoading] = useState(true);
    const [featuredError, setFeaturedError] = useState("");
    const [selectedFeaturedRecipe, setSelectedFeaturedRecipe] = useState(null);

    const [route, setRoute] = useState(() => getRouteFromHash());

    const { session } = useAuth();

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    useEffect(() => {
        const onHashChange = () => {
            setRoute(getRouteFromHash());
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadFeatured = async () => {
            if (!session) {
                if (!cancelled) {
                    setFeatured([]);
                    setFeaturedLoading(false);
                    setFeaturedError("");
                }
                return;
            }

            setFeaturedError("");
            setFeaturedLoading(true);
            try {
                const list = await apiFetch("/api/recipes");

                if (!Array.isArray(list)) {
                    throw new Error("Recipes response did not return a list.");
                }

                const picked = sampleRandomItems(list, 6).map((recipe, index) =>
                    normalizeFeaturedRecipe(recipe, index),
                );

                if (!cancelled) {
                    setFeatured(picked);
                }
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setFeatured([]);
                    if (
                        err.message.includes("Unauthorized") ||
                        err.message.includes("Not authenticated")
                    ) {
                        setFeaturedError(
                            "Please log in to view featured recipes.",
                        );
                    } else {
                        setFeaturedError(
                            "Could not load featured recipes from backend yet.",
                        );
                    }
                }
            } finally {
                if (!cancelled) {
                    setFeaturedLoading(false);
                }
            }
        };

        loadFeatured();

        return () => {
            cancelled = true;
        };
    }, [session?.user?.id]);

    const quickFilters = useMemo(
        () => [
            "Popular",
            "Under 30 min",
            "Vegetarian",
            "High Protein",
            "Budget",
            "Meal Prep",
        ],
        [],
    );

    const onSearch = (e) => {
        e.preventDefault();
        const trimmed = query.trim();
        const searchSuffix = trimmed
            ? `?q=${encodeURIComponent(trimmed)}`
            : "";
        window.location.hash = `#/recipes${searchSuffix}`;
    };

    const loadRecipes = async () => {
        setError("");
        setLoading(true);
        try {
            const data = await apiFetch("/api/recipes");
            setRecipes(data ?? []);
        } catch (err) {
            console.error(err);
            if (
                err.message.includes("Unauthorized") ||
                err.message.includes("Not authenticated")
            ) {
                setError("Please log in to load recipes.");
                window.location.hash = "#/login";
            } else {
                setError("Could not load recipes from backend.");
            }
            setRecipes([]);
        } finally {
            setLoading(false);
        }
    };

    if (route === "login") {
        return <LoginPage />;
    }

    if (route === "recipes") {
        return (
            <div className="app-shell">
                <TopBar route={route} session={session} onLogout={handleLogout} />
                <RecipesPage session={session} />
            </div>
        );
    }

    if (route === "meal-plans") {
        return (
            <div className="app-shell">
                <TopBar route={route} session={session} onLogout={handleLogout} />
                <MealPlansPage session={session} />
            </div>
        );
    }

    return (
        <div className="app-shell">
            <TopBar route={route} session={session} onLogout={handleLogout} />

            <main className="page">
                <section className="hero">
                    <div className="hero-card">
                        <h1 className="hero-title">
                            Cook something delicious tonight.
                        </h1>
                        <p className="hero-copy">
                            Search recipes, save favorites, and drag them into a
                            weekly meal plan. (Supabase wiring is in progress.)
                        </p>

                        <form className="search" onSubmit={onSearch}>
                            <input
                                className="search-input"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search recipes or ingredients… (e.g., chicken, rice, tomato)"
                            />
                            <button className="btn btn-primary" type="submit">
                                Search
                            </button>
                        </form>

                        <div className="chips">
                            {quickFilters.map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    className="chip"
                                    onClick={() => setQuery(f)}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>

                        <div className="hero-actions">
                            <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => alert("Guest browsing (next)")}
                            >
                                Browse as guest
                            </button>

                            <button
                                className="btn btn-outline"
                                type="button"
                                onClick={loadRecipes}
                                disabled={loading}
                            >
                                {loading
                                    ? "Loading…"
                                    : "Test Load: Recipes table"}
                            </button>
                        </div>

                        {error && (
                            <div className="banner banner-warn">{error}</div>
                        )}
                        {!!recipes.length && (
                            <div className="banner banner-ok">
                                Loaded <strong>{recipes.length}</strong> recipe
                                {recipes.length === 1 ? "" : "s"} from Supabase
                                ✅
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
                                        <div className="mini-card-title">
                                            {r.title}
                                        </div>
                                        <div className="mini-card-meta">
                                            {r.time} • {r.tag}
                                        </div>
                                    </div>
                                ))}
                                <div className="mini-hint">
                                    Log in to save recipes → meal plans
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* NEW: Real UI for loaded Supabase recipes */}
                {!!recipes.length && (
                    <section className="section">
                        <div className="section-head">
                            <h2 className="section-title">
                                Loaded from Supabase
                            </h2>
                            <p className="section-sub">
                                This is what your “Test Load” returned.
                            </p>
                        </div>

                        <div className="recipe-grid">
                            {recipes.map((r) => (
                                <article
                                    key={r.recipe_id}
                                    className="recipe-card2"
                                >
                                    <div
                                        className="recipe-thumb2"
                                        aria-hidden="true"
                                    >
                                        <span className="pill">
                                            Recipe #{r.recipe_id}
                                        </span>
                                    </div>

                                    <div className="recipe-body2">
                                        <div className="recipe-title2">
                                            {r.name}
                                        </div>
                                        {r.description && (
                                            <div className="recipe-desc2">
                                                {r.description}
                                            </div>
                                        )}

                                        {r.instructions && (
                                            <div className="recipe-instructions2">
                                                <strong>Instructions:</strong>
                                                <div className="muted">
                                                    {r.instructions}
                                                </div>
                                            </div>
                                        )}

                                        <div className="recipe-actions2">
                                            <button
                                                className="btn btn-small btn-ghost"
                                                type="button"
                                                onClick={() =>
                                                    alert(
                                                        `View recipe ${r.recipe_id} (next)`,
                                                    )
                                                }
                                            >
                                                View
                                            </button>
                                            <button
                                                className="btn btn-small btn-outline"
                                                type="button"
                                                onClick={() =>
                                                    alert(
                                                        "Save (requires login)",
                                                    )
                                                }
                                            >
                                                Save
                                            </button>
                                        </div>

                                        <div className="recipe-footnote">
                                            <span className="muted">
                                                User: {r.user_id}
                                            </span>
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
                        <p className="section-sub">
                            Loaded from the backend recipes API.
                        </p>
                    </div>

                    {featuredLoading && (
                        <p className="muted">Loading featured recipes...</p>
                    )}
                    {featuredError && (
                        <div className="banner banner-warn">
                            {featuredError}
                        </div>
                    )}

                    <div className="carousel">
                        {featured.map((r) => (
                            <article key={r.id} className="recipe-card">
                                <div
                                    className="recipe-thumb"
                                    aria-hidden="true"
                                >
                                    <span className="recipe-tag">{r.tag}</span>
                                </div>
                                <div className="recipe-body">
                                    <div className="recipe-title">
                                        {r.title}
                                    </div>
                                    <div className="recipe-meta">{r.time}</div>
                                    <div className="recipe-actions">
                                        <button
                                            className="btn btn-small btn-ghost"
                                            type="button"
                                            onClick={() =>
                                                setSelectedFeaturedRecipe(r)
                                            }
                                        >
                                            View
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
                            <div className="step-copy">
                                Sign up and log in to save recipes and meal
                                plans.
                            </div>
                        </div>

                        <div className="step">
                            <div className="step-num">2</div>
                            <div className="step-title">
                                Find recipes & ingredients
                            </div>
                            <div className="step-copy">
                                Browse ingredients, build recipes, and save
                                other users’ recipes.
                            </div>
                        </div>

                        <div className="step">
                            <div className="step-num">3</div>
                            <div className="step-title">Plan your week</div>
                            <div className="step-copy">
                                Create meal plans and assign saved recipes to
                                days of the week.
                            </div>
                        </div>
                    </div>
                </section>

                <footer className="footer">
                    <div className="footer-inner">
                        <span>
                            © {new Date().getFullYear()} MealMap
                        </span>
                        <span className="muted"></span>
                    </div>
                </footer>

                {selectedFeaturedRecipe && (
                    <div
                        className="modal-backdrop"
                        role="presentation"
                        onClick={() => setSelectedFeaturedRecipe(null)}
                    >
                        <div
                            className="modal"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Recipe details"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-head">
                                <h3 className="modal-title">
                                    {selectedFeaturedRecipe.title}
                                </h3>
                                <button
                                    className="btn btn-small btn-ghost"
                                    type="button"
                                    onClick={() => setSelectedFeaturedRecipe(null)}
                                >
                                    Close
                                </button>
                            </div>
                            <div className="modal-body">
                                {Object.entries(
                                    selectedFeaturedRecipe.details ?? {},
                                )
                                    .filter(([key]) => shouldShowRecipeDetail(key))
                                    .map(([key, value]) => (
                                    <div key={key} className="modal-row">
                                        <div className="modal-key">
                                            {toLabel(key)}
                                        </div>
                                        <div className="modal-value">
                                            {toDisplayValue(value)}
                                        </div>
                                    </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
