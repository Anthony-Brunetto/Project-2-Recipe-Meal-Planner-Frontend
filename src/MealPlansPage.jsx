import { useEffect, useState } from "react";
import { apiFetch } from "./api";

async function resolveBackendUser(session) {
    const users = await apiFetch("/api/users");
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

function getEntries(plan) {
    return Array.isArray(plan?.mealPlanEntries) ? plan.mealPlanEntries : [];
}

function getEntryId(entry) {
    return entry?.entryId ?? entry?.mealPlanEntryId ?? entry?.id ?? null;
}

function getPlanUserId(plan) {
    return plan?.user?.userId ?? plan?.userId ?? null;
}

function getPlanName(plan) {
    return (
        plan?.name ??
        plan?.mealPlanName ??
        plan?.title ??
        plan?.dayOfWeek ??
        `${plan?.partOfDay || "Any"}`
    );
}

function getPlanId(plan) {
    return Number(plan?.mealPlanId ?? plan?.meal_plan_id ?? plan?.id);
}

async function createMealPlanForUser(userId, mealPlanName) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId)) {
        throw new Error("Invalid backend user id.");
    }

    // Send one strict payload that always includes explicit user linkage.
    const payload = {
        dayOfWeek: mealPlanName,
        partOfDay: "Any",
        name: mealPlanName,
        mealPlanName,
        user: { userId: numericUserId },
        userId: numericUserId,
        user_id: numericUserId,
    };

    const created = await apiFetch("/api/meal-plans", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (!created?.mealPlanId) {
        throw new Error("Meal plan create did not return a valid id.");
    }

    return created;
}

export default function MealPlansPage({ session }) {
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [deletingPlanId, setDeletingPlanId] = useState(null);
    const [error, setError] = useState("");
    const [createError, setCreateError] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [plans, setPlans] = useState([]);
    const [backendUser, setBackendUser] = useState(null);
    const [newPlanName, setNewPlanName] = useState("");

    const loadMealPlans = async () => {
        if (!session) {
            setPlans([]);
            setBackendUser(null);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const allPlans = await apiFetch("/api/meal-plans");
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
        setDeleteError("");
        try {
            const mealPlanName = newPlanName.trim();
            if (!mealPlanName) {
                setCreateError("Meal plan name is required.");
                setCreating(false);
                return;
            }
            const user = await resolveBackendUser(session);
            await createMealPlanForUser(user.userId, mealPlanName);
            setNewPlanName("");
            await loadMealPlans();
        } catch (err) {
            console.error(err);
            setCreateError(err?.message || "Could not create meal plan.");
        } finally {
            setCreating(false);
        }
    };

    const deleteWithFallback = async (paths, { ignore404 = false } = {}) => {
        let lastError = null;
        for (const path of paths) {
            try {
                await apiFetch(path, { method: "DELETE" });
                return;
            } catch (err) {
                const message = String(err?.message || "");
                if (ignore404 && message.includes("API error: 404")) {
                    continue;
                }
                lastError = err;
            }
        }
        if (ignore404) {
            return;
        }
        throw (
            lastError ||
            new Error(`Delete request failed for paths: ${paths.join(", ")}`)
        );
    };

    const loadCurrentPlanById = async (planId) => {
        const allPlans = await apiFetch("/api/meal-plans");
        const list = Array.isArray(allPlans) ? allPlans : [];
        return list.find((candidate) => getPlanId(candidate) === planId) ?? null;
    };

    const deleteEntriesForPlan = async (planId, initialPlan) => {
        let currentPlan = initialPlan;

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const entries = getEntries(currentPlan);
            if (!entries.length) {
                return;
            }

            for (const entry of entries) {
                const entryId = Number(getEntryId(entry));
                if (!Number.isFinite(entryId)) {
                    continue;
                }
                await deleteWithFallback(
                    [
                        `/api/meal-plan-entries/${entryId}`,
                        `/api/meal-plan-entry/${entryId}`,
                        `/api/meal_plan_entries/${entryId}`,
                        `/api/meal_plan_entry/${entryId}`,
                    ],
                    { ignore404: true },
                );
            }

            await deleteWithFallback(
                [
                    `/api/meal-plan-entries?mealPlanId=${planId}`,
                    `/api/meal-plan-entry?mealPlanId=${planId}`,
                    `/api/meal_plan_entries?mealPlanId=${planId}`,
                    `/api/meal_plan_entry?mealPlanId=${planId}`,
                    `/api/meal-plan-entries/meal-plan/${planId}`,
                    `/api/meal-plan-entry/meal-plan/${planId}`,
                    `/api/meal_plan_entries/meal-plan/${planId}`,
                    `/api/meal_plan_entry/meal-plan/${planId}`,
                    `/api/meal-plan-entries/plan/${planId}`,
                    `/api/meal-plan-entry/plan/${planId}`,
                ],
                { ignore404: true },
            );

            const refreshedPlan = await loadCurrentPlanById(planId);
            if (!refreshedPlan || !getEntries(refreshedPlan).length) {
                return;
            }
            currentPlan = refreshedPlan;
        }

        throw new Error("Could not clear all meal plan entries.");
    };

    const deleteMealPlan = async (plan) => {
        const planId = getPlanId(plan);
        if (!Number.isFinite(Number(planId))) {
            setDeleteError("Invalid meal plan id.");
            return;
        }

        setDeleteError("");
        setDeletingPlanId(planId);

        try {
            await deleteEntriesForPlan(planId, plan);

            await deleteWithFallback([
                `/api/meal-plans/${planId}`,
                `/api/meal-plan/${planId}`,
                `/api/meal-plans?id=${planId}`,
                `/api/meal-plan?id=${planId}`,
            ]);
            setPlans((prev) =>
                prev.filter((currentPlan) => currentPlan.mealPlanId !== planId),
            );
        } catch (err) {
            console.error(err);
            setDeleteError(
                err?.message ||
                    "Could not delete meal plan and its linked entries.",
            );
        } finally {
            setDeletingPlanId(null);
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
                </div>
                <form className="login-form" onSubmit={(e) => e.preventDefault()}>
                    <label className="login-label">
                        Meal plan name
                        <input
                            className="login-input"
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            placeholder="e.g. Weeknight Dinners"
                        />
                    </label>
                    <div className="hero-actions" style={{ marginTop: 0 }}>
                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={createMealPlan}
                            disabled={creating}
                        >
                            {creating ? "Creating..." : "Create meal plan"}
                        </button>
                    </div>
                </form>
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
                                            {getPlanName(plan)}
                                        </h2>
                                        <button
                                            className="btn btn-small btn-ghost"
                                            type="button"
                                            onClick={() => deleteMealPlan(plan)}
                                            disabled={deletingPlanId === plan.mealPlanId}
                                        >
                                            {deletingPlanId === plan.mealPlanId
                                                ? "Deleting..."
                                                : "Delete"}
                                        </button>
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
                                                        </strong>
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
