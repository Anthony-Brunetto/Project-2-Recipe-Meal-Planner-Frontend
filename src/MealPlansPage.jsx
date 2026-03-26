import { useEffect, useState } from "react";

function getApiBaseUrl() {
    return (
        import.meta.env.VITE_API_BASE_URL ||
        "https://recipe-backend-production-2e13.up.railway.app"
    );
}

async function fetchJson(path, options = {}) {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
        ...options,
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(
            `${options.method ?? "GET"} ${path} failed (${response.status}) ${body}`,
        );
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function resolveBackendUser(session) {
    const users = await fetchJson("/api/users");
    if (!Array.isArray(users)) {
        throw new Error("Users response did not return a list.");
    }

    const match = users.find((user) => {
        const sameSupabaseId =
            session?.user?.id &&
            user?.supabaseId &&
            user.supabaseId === session.user.id;
        const sameEmail =
            session?.user?.email &&
            user?.email &&
            user.email.toLowerCase() === session.user.email.toLowerCase();
        return sameSupabaseId || sameEmail;
    });

    if (!match?.userId) {
        throw new Error(
            "No backend user found for this account. Ask backend to create a users row with your supabaseId/email.",
        );
    }

    return match;
}

function formatDate(dateText) {
    if (!dateText) return "N/A";
    const parsed = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return dateText;
    }
    return parsed.toLocaleDateString();
}

function getEntries(plan) {
    return Array.isArray(plan?.mealPlanEntries) ? plan.mealPlanEntries : [];
}

function getPlanUserId(plan) {
    return plan?.user?.userId ?? plan?.userId ?? null;
}

function getIsoDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function plusDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

async function createMealPlanForUser(userId) {
    const today = new Date();
    const startDate = getIsoDate(today);
    const endDate = getIsoDate(plusDays(today, 6));

    const payloads = [
        {
            dayOfWeek: "Unassigned",
            partOfDay: "Any",
            startDate,
            endDate,
            user: { userId },
        },
        {
            dayOfWeek: "Unassigned",
            partOfDay: "Any",
            startDate,
            endDate,
            userId,
        },
    ];

    for (const payload of payloads) {
        try {
            const created = await fetchJson("/api/meal-plans", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            if (created?.mealPlanId) {
                return created;
            }
        } catch (err) {
            console.warn("Meal plan create payload failed:", payload, err);
        }
    }

    throw new Error("Could not create a meal plan for this account.");
}

export default function MealPlansPage({ session }) {
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [createError, setCreateError] = useState("");
    const [plans, setPlans] = useState([]);
    const [backendUser, setBackendUser] = useState(null);

    const loadMealPlans = async () => {
        if (!session) {
            setPlans([]);
            setBackendUser(null);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const allPlans = await fetchJson("/api/meal-plans");
            const normalizedPlans = Array.isArray(allPlans) ? allPlans : [];
            const user = await resolveBackendUser(session);
            const userPlans = normalizedPlans.filter(
                (plan) => getPlanUserId(plan) === user.userId,
            );

            setBackendUser(user);
            setPlans(userPlans);
        } catch (err) {
            console.error(err);
            setPlans([]);
            setBackendUser(null);
            setError(
                err?.message ||
                    "Could not load your meal plans from backend yet.",
            );
        } finally {
            setLoading(false);
        }
    };

    const createMealPlan = async () => {
        if (!session) {
            window.location.hash = "#/login";
            return;
        }

        setCreating(true);
        setCreateError("");
        try {
            const user = await resolveBackendUser(session);
            await createMealPlanForUser(user.userId);
            await loadMealPlans();
        } catch (err) {
            console.error(err);
            setCreateError(err?.message || "Could not create meal plan.");
        } finally {
            setCreating(false);
        }
    };

    useEffect(() => {
        loadMealPlans();
    }, [session?.user?.id, session?.user?.email]);

    if (!session) {
        return (
            <main className="page">
                <section className="section">
                    <div className="section-head">
                        <h1 className="section-title">My meal plans</h1>
                        <p className="section-sub">
                            Log in to view the meal plans stored in backend.
                        </p>
                    </div>
                    <div className="banner banner-warn">
                        You need to log in to load your meal plans.
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="page">
            <section className="section">
                <div className="section-head">
                    <h1 className="section-title">My meal plans</h1>
                    <p className="section-sub">
                        Backend verification view for your meal plans and entries.
                    </p>
                </div>

                {backendUser && (
                    <div className="banner">
                        Backend user: <strong>{backendUser.username || "Unknown"}</strong>{" "}
                        (id: {backendUser.userId})
                    </div>
                )}

                <div className="hero-actions">
                    <button
                        className="btn btn-outline"
                        type="button"
                        onClick={loadMealPlans}
                        disabled={loading}
                    >
                        {loading ? "Refreshing..." : "Refresh meal plans"}
                    </button>
                    {!plans.length && !loading && (
                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={createMealPlan}
                            disabled={creating}
                        >
                            {creating ? "Creating..." : "Create meal plan"}
                        </button>
                    )}
                </div>

                {error && <div className="banner banner-warn">{error}</div>}
                {createError && (
                    <div className="banner banner-warn">{createError}</div>
                )}
            </section>

            <section className="section">
                {loading && <p className="muted">Loading meal plans...</p>}

                {!loading && !error && !plans.length && (
                    <div className="banner">No meal plans found for your user yet.</div>
                )}

                {!!plans.length && (
                    <div className="meal-plan-grid">
                        {plans.map((plan) => {
                            const entries = getEntries(plan);
                            return (
                                <article
                                    key={plan.mealPlanId}
                                    className="meal-plan-card"
                                >
                                    <div className="meal-plan-head">
                                        <h2 className="meal-plan-title">
                                            {plan.dayOfWeek || "Unassigned"} -{" "}
                                            {plan.partOfDay || "Any"}
                                        </h2>
                                        <div className="muted">
                                            Plan #{plan.mealPlanId}
                                        </div>
                                    </div>

                                    <div className="meal-plan-meta muted">
                                        {formatDate(plan.startDate)} to{" "}
                                        {formatDate(plan.endDate)}
                                    </div>

                                    <div className="meal-plan-entries">
                                        <div className="meal-plan-entries-title">
                                            Entries ({entries.length})
                                        </div>

                                        {!entries.length && (
                                            <p className="muted">
                                                No recipes in this plan yet.
                                            </p>
                                        )}

                                        {!!entries.length && (
                                            <ul className="meal-plan-list">
                                                {entries.map((entry) => (
                                                    <li key={entry.entryId}>
                                                        <strong>
                                                            {entry?.recipe?.name ||
                                                                "Unnamed recipe"}
                                                        </strong>{" "}
                                                        <span className="muted">
                                                            (recipe id:{" "}
                                                            {entry?.recipe?.recipeId})
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}
