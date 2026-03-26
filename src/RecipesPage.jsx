import { useEffect, useState } from "react";
import { apiFetch } from "./api";

function getRecipeId(recipe, index) {
    return recipe.recipeId ?? recipe.recipe_id ?? recipe.id ?? `recipe-${index}`;
}

function getRecipeTitle(recipe, index) {
    return recipe.name ?? recipe.title ?? `Recipe ${index + 1}`;
}

function getRecipeDescription(recipe) {
    return recipe.description ?? recipe.summary ?? "No description yet.";
}

function getRecipeInstructions(recipe) {
    return recipe.instructions ?? recipe.method ?? "";
}

function toBackendRecipeId(recipe, index) {
    const rawId = recipe.recipeId ?? recipe.recipe_id ?? recipe.id;
    const recipeId = Number(rawId);
    if (!Number.isFinite(recipeId)) {
        throw new Error(
            `Recipe at index ${index} is missing a numeric recipe id.`,
        );
    }
    return recipeId;
}

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

function getPlanRecipeIds(plan) {
    const entries = Array.isArray(plan?.mealPlanEntries) ? plan.mealPlanEntries : [];
    return entries
        .map((entry) => Number(entry?.recipe?.recipeId))
        .filter((value) => Number.isFinite(value))
        .map((value) => String(value));
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

async function createMealPlanEntry(mealPlanId, recipeId) {
    const payloads = [
        {
            mealPlan: { mealPlanId },
            recipe: { recipeId },
        },
        {
            mealPlanId,
            recipeId,
        },
    ];

    for (const payload of payloads) {
        try {
            const created = await apiFetch("/api/meal-plan-entries", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            if (created?.entryId) {
                return created;
            }
        } catch (err) {
            console.warn("Meal plan entry payload failed:", payload, err);
        }
    }

    throw new Error("Could not create meal plan entry.");
}

export default function RecipesPage({ session }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const [mealPlanError, setMealPlanError] = useState("");
    const [recipes, setRecipes] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [mealPlans, setMealPlans] = useState([]);
    const [selectedPlanByRecipe, setSelectedPlanByRecipe] = useState({});
    const [existingEntryKeys, setExistingEntryKeys] = useState([]);
    const [addingKey, setAddingKey] = useState("");

    useEffect(() => {
        let cancelled = false;

        const loadRecipes = async () => {
            if (!session) {
                if (!cancelled) {
                    setRecipes([]);
                    setError("");
                    setLoading(false);
                }
                return;
            }

            setLoading(true);
            setError("");

            try {
                const payload = await apiFetch("/api/recipes");
                const list = Array.isArray(payload)
                    ? payload
                    : payload?.content;

                if (!Array.isArray(list)) {
                    throw new Error("Recipes response did not return a list.");
                }

                if (!cancelled) {
                    setRecipes(list);
                }
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setRecipes([]);
                    setError(
                        "Could not load recipes from backend. Please try again.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadRecipes();

        return () => {
            cancelled = true;
        };
    }, [session?.user?.id]);

    useEffect(() => {
        let cancelled = false;

        const loadMealPlansForUser = async () => {
            if (!session) {
                setMealPlans([]);
                setSelectedPlanByRecipe({});
                setExistingEntryKeys([]);
                setMealPlanError("");
                return;
            }

            try {
                setActionError("");
                setMealPlanError("");
                const backendUser = await resolveBackendUser(session);
                const allPlans = await apiFetch("/api/meal-plans");
                const userPlans = Array.isArray(allPlans)
                    ? allPlans.filter(
                          (plan) => getPlanUserId(plan) === backendUser.userId,
                      )
                    : [];
                const pairKeys = userPlans.flatMap((plan) => {
                    const planId = Number(plan?.mealPlanId);
                    if (!Number.isFinite(planId)) {
                        return [];
                    }
                    return getPlanRecipeIds(plan).map(
                        (recipeId) => `${planId}:${recipeId}`,
                    );
                });

                if (!cancelled) {
                    setMealPlans(userPlans);
                    setExistingEntryKeys(Array.from(new Set(pairKeys)));
                }
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setMealPlans([]);
                    setExistingEntryKeys([]);
                    setMealPlanError(
                        err?.message ||
                            "Could not load your meal plans from backend yet.",
                    );
                }
            }
        };

        loadMealPlansForUser();

        return () => {
            cancelled = true;
        };
    }, [session?.user?.id, session?.user?.email]);

    const addToMealPlan = async (recipe, index) => {
        if (!session) {
            window.location.hash = "#/login";
            return;
        }

        let recipeId;
        try {
            recipeId = toBackendRecipeId(recipe, index);
        } catch (err) {
            setActionError(err.message);
            return;
        }

        const recipeIdString = String(recipeId);
        const selectionKey = String(getRecipeId(recipe, index));
        const fallbackPlanId = mealPlans[0]?.mealPlanId
            ? String(mealPlans[0].mealPlanId)
            : "";
        const selectedPlanId =
            selectedPlanByRecipe[selectionKey] ??
            selectedPlanByRecipe[recipeIdString] ??
            fallbackPlanId;
        if (!selectedPlanId) {
            setActionError(
                "No meal plan found for your account yet. Create one on the Meal Plans page first.",
            );
            return;
        }

        const entryKey = `${selectedPlanId}:${recipeIdString}`;
        if (existingEntryKeys.includes(entryKey)) {
            return;
        }

        setAddingKey(entryKey);
        setActionError("");
       
        setExistingEntryKeys((prev) => {
            if (prev.includes(entryKey)) {
                return prev;
            }
            return [...prev, entryKey];
        });
        try {
            await createMealPlanEntry(Number(selectedPlanId), recipeId);
        } catch (err) {
            console.error(err);
    
            setExistingEntryKeys((prev) =>
                prev.filter((key) => key !== entryKey),
            );
            setActionError(
                err?.message || "Could not add recipe to meal plan on backend.",
            );
        } finally {
            setAddingKey("");
        }
    };

    const retryRecipesLoad = async () => {
        if (!session) {
            setRecipes([]);
            setError("Log in to load recipes.");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const payload = await apiFetch("/api/recipes");
            const list = Array.isArray(payload) ? payload : payload?.content;
            if (!Array.isArray(list)) {
                throw new Error("Recipes response did not return a list.");
            }
            setRecipes(list);
        } catch (err) {
            console.error(err);
            setRecipes([]);
            setError("Could not load recipes from backend. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const visibleRecipes = recipes.filter((recipe, index) => {
        if (!normalizedSearch) {
            return true;
        }
        const title = getRecipeTitle(recipe, index).toLowerCase();
        const description = getRecipeDescription(recipe).toLowerCase();
        const instructions = getRecipeInstructions(recipe).toLowerCase();
        return (
            title.includes(normalizedSearch) ||
            description.includes(normalizedSearch) ||
            instructions.includes(normalizedSearch)
        );
    });

    return (
        <main className="page">
            <section className="section">
                <div className="section-head">
                    <h1 className="section-title">All recipes</h1>
                    <p className="section-sub">
                        Browse recipes from the backend and add them to your meal
                        plan.
                    </p>
                </div>
                <div className="search">
                    <input
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search recipes..."
                    />
                    {!!searchTerm && (
                        <button
                            className="btn btn-ghost btn-small"
                            type="button"
                            onClick={() => setSearchTerm("")}
                        >
                            Clear
                        </button>
                    )}
                </div>

                {!session && (
                    <div className="banner banner-warn">
                        Log in to add recipes to your personal meal plan.
                    </div>
                )}
                {session && !!mealPlans.length && (
                    <div className="banner banner-ok">
                        You have <strong>{mealPlans.length}</strong>{" "}
                        {mealPlans.length === 1 ? "meal plan" : "meal plans"}.
                    </div>
                )}
                {session && !mealPlans.length && !mealPlanError && (
                    <div className="banner banner-warn">
                        You do not have a meal plan yet. Create one on the Meal
                        Plans page first.
                    </div>
                )}
                {mealPlanError && (
                    <div className="banner banner-warn">{mealPlanError}</div>
                )}
                {actionError && (
                    <div className="banner banner-warn">{actionError}</div>
                )}
            </section>

            <section className="section">
                {loading && <p className="muted">Loading recipes...</p>}
                {error && (
                    <div className="banner banner-warn">
                        {error}{" "}
                        <button
                            className="btn btn-small btn-ghost"
                            type="button"
                            onClick={retryRecipesLoad}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && !recipes.length && (
                    <div className="banner">No recipes found yet.</div>
                )}

                {!!visibleRecipes.length && (
                    <div className="recipe-grid">
                        {visibleRecipes.map((recipe, index) => {
                            const recipeId = String(getRecipeId(recipe, index));
                            const fallbackPlanId = mealPlans[0]?.mealPlanId
                                ? String(mealPlans[0].mealPlanId)
                                : "";
                            const selectedPlanId =
                                selectedPlanByRecipe[recipeId] ?? fallbackPlanId;
                            const entryKey = selectedPlanId
                                ? `${selectedPlanId}:${recipeId}`
                                : "";
                            const isAdded =
                                !!entryKey && existingEntryKeys.includes(entryKey);

                            return (
                                <article key={recipeId} className="recipe-card2">
                                    <div className="recipe-body2">
                                        <div className="recipe-title2">
                                            {getRecipeTitle(recipe, index)}
                                        </div>
                                        <div className="recipe-desc2">
                                            {getRecipeDescription(recipe)}
                                        </div>

                                        {!!getRecipeInstructions(recipe) && (
                                            <div className="recipe-instructions2">
                                                <strong>Instructions:</strong>
                                                <div className="muted">
                                                    {getRecipeInstructions(recipe)}
                                                </div>
                                            </div>
                                        )}

                                        <div className="recipe-actions2">
                                            {session && !!mealPlans.length && (
                                                <select
                                                    className="login-input"
                                                    value={selectedPlanId}
                                                    onChange={(e) =>
                                                        setSelectedPlanByRecipe(
                                                            (prev) => ({
                                                                ...prev,
                                                                [recipeId]:
                                                                    e.target.value,
                                                            }),
                                                        )
                                                    }
                                                >
                                                    {mealPlans.map((plan) => (
                                                        <option
                                                            key={plan.mealPlanId}
                                                            value={plan.mealPlanId}
                                                        >
                                                            {getPlanName(plan)}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                            <button
                                                className="btn btn-small btn-outline"
                                                type="button"
                                                onClick={() =>
                                                    addToMealPlan(recipe, index)
                                                }
                                                disabled={
                                                    session
                                                        ? !selectedPlanId ||
                                                          isAdded ||
                                                          addingKey === entryKey
                                                        : false
                                                }
                                            >
                                                {!session
                                                    ? "Log in to add"
                                                    : !selectedPlanId
                                                    ? "Create meal plan first"
                                                    : addingKey === entryKey
                                                    ? "Adding..."
                                                    : isAdded
                                                    ? "Added to meal plan"
                                                    : "Add to meal plan"}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
                {!loading && !error && !!recipes.length && !visibleRecipes.length && (
                    <div className="banner">No recipes match your search.</div>
                )}
            </section>
        </main>
    );
}
