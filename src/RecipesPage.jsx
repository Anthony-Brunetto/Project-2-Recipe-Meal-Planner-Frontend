import { useEffect, useState } from "react";
import { apiFetch } from "./api";

function getApiBaseUrl() {
    return (
        import.meta.env.VITE_API_BASE_URL ||
        "https://recipe-backend-production-2e13.up.railway.app"
    );
}

function getRecipeId(recipe, index) {
    return recipe.id ?? recipe.recipe_id ?? `recipe-${index}`;
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

function getIngredientId(ingredient) {
    return ingredient.ingredientId ?? ingredient.ingredient_id ?? ingredient.id;
}

function getIngredientName(ingredient, index) {
    const id = getIngredientId(ingredient);
    return (
        ingredient.ingredientName ??
        ingredient.ingredient_name ??
        ingredient.name ??
        `Ingredient ${id ?? index + 1}`
    );
}

function normalizeIngredientList(payload) {
    const list = Array.isArray(payload) ? payload : payload?.content;
    if (!Array.isArray(list)) {
        throw new Error("Ingredients response did not return a list.");
    }

    const normalized = list
        .map((ingredient, index) => {
            const ingredientId = Number(getIngredientId(ingredient));
            if (!Number.isFinite(ingredientId)) {
                return null;
            }
            return {
                ingredientId,
                ingredientName: getIngredientName(ingredient, index),
                unit:
                    ingredient.unit ??
                    ingredient.defaultUnit ??
                    ingredient.measurementUnit ??
                    "",
            };
        })
        .filter(Boolean);

    return normalized;
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
            const created = await fetchJson("/api/meal-plan-entries", {
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

async function apiFetchWithFallback(paths, options = {}) {
    let lastError = null;
    for (const path of paths) {
        try {
            return await apiFetch(path, options);
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error("Request failed.");
}

async function createRecipeWithFallback(payloads) {
    let lastError = null;
    for (const payload of payloads) {
        try {
            return await apiFetchWithFallback(["/api/recipes", "/api/recipe"], {
                method: "POST",
                body: JSON.stringify(payload),
            });
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error("Could not create recipe.");
}

async function createRecipeIngredientWithFallback(payloads) {
    let lastError = null;
    for (const payload of payloads) {
        try {
            return await apiFetchWithFallback(
                ["/api/recipe-ingredients", "/api/recipe-ingredient"],
                {
                    method: "POST",
                    body: JSON.stringify(payload),
                },
            );
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error("Could not create recipe ingredient link.");
}

export default function RecipesPage({ session }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const [mealPlanError, setMealPlanError] = useState("");
    const [recipes, setRecipes] = useState([]);
    const [mealPlans, setMealPlans] = useState([]);
    const [selectedPlanByRecipe, setSelectedPlanByRecipe] = useState({});
    const [existingEntryKeys, setExistingEntryKeys] = useState([]);
    const [addingKey, setAddingKey] = useState("");
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creatingRecipe, setCreatingRecipe] = useState(false);
    const [createRecipeError, setCreateRecipeError] = useState("");
    const [createRecipeSuccess, setCreateRecipeSuccess] = useState("");
    const [ingredientOptions, setIngredientOptions] = useState([]);
    const [newRecipeForm, setNewRecipeForm] = useState({
        name: "",
        description: "",
        instructions: "",
    });
    const [recipeIngredients, setRecipeIngredients] = useState([
        { ingredientId: "", quantity: "", unit: "" },
    ]);

    useEffect(() => {
        let cancelled = false;

        const loadRecipes = async () => {
            setLoading(true);
            setError("");

            try {
                const response = await fetch(`${getApiBaseUrl()}/api/recipes`);
                if (!response.ok) {
                    throw new Error(
                        `Failed to load recipes from backend (${response.status})`,
                    );
                }

                const payload = await response.json();
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
    }, []);

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
                const allPlans = await fetchJson("/api/meal-plans");
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

    useEffect(() => {
        let cancelled = false;

        const loadIngredients = async () => {
            if (!session || !showCreateForm) {
                return;
            }

            try {
                const payload = await apiFetchWithFallback([
                    "/api/ingredients",
                    "/api/ingredient",
                ]);
                const normalized = normalizeIngredientList(payload);

                if (!cancelled) {
                    setIngredientOptions(normalized);
                }
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setIngredientOptions([]);
                    setCreateRecipeError(
                        err?.message ||
                            "Could not load ingredients list for recipe creation.",
                    );
                }
            }
        };

        loadIngredients();

        return () => {
            cancelled = true;
        };
    }, [session, showCreateForm]);

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
        const fallbackPlanId = mealPlans[0]?.mealPlanId
            ? String(mealPlans[0].mealPlanId)
            : "";
        const selectedPlanId =
            selectedPlanByRecipe[recipeIdString] ?? fallbackPlanId;
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
        try {
            await createMealPlanEntry(Number(selectedPlanId), recipeId);
            setExistingEntryKeys((prev) => {
                if (prev.includes(entryKey)) {
                    return prev;
                }
                return [...prev, entryKey];
            });
        } catch (err) {
            console.error(err);
            setActionError(
                err?.message || "Could not add recipe to meal plan on backend.",
            );
        } finally {
            setAddingKey("");
        }
    };

    const retryRecipesLoad = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/recipes`);
            if (!response.ok) {
                throw new Error(
                    `Failed to load recipes from backend (${response.status})`,
                );
            }
            const payload = await response.json();
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

    const updateIngredientRow = (index, patch) => {
        setRecipeIngredients((prev) =>
            prev.map((row, rowIndex) =>
                rowIndex === index ? { ...row, ...patch } : row,
            ),
        );
    };

    const addIngredientRow = () => {
        setRecipeIngredients((prev) => [
            ...prev,
            { ingredientId: "", quantity: "", unit: "" },
        ]);
    };

    const removeIngredientRow = (index) => {
        setRecipeIngredients((prev) => {
            if (prev.length === 1) {
                return prev;
            }
            return prev.filter((_, rowIndex) => rowIndex !== index);
        });
    };

    const onIngredientSelect = (rowIndex, ingredientIdValue) => {
        const selectedIngredient = ingredientOptions.find(
            (ingredient) => String(ingredient.ingredientId) === ingredientIdValue,
        );
        updateIngredientRow(rowIndex, {
            ingredientId: ingredientIdValue,
            unit: selectedIngredient?.unit ?? "",
        });
    };

    const onCreateRecipe = async (e) => {
        e.preventDefault();

        if (!session) {
            window.location.hash = "#/login";
            return;
        }

        const name = newRecipeForm.name.trim();
        if (!name) {
            setCreateRecipeError("Recipe name is required.");
            return;
        }

        const ingredientRows = recipeIngredients
            .map((row) => ({
                ingredientId: Number(row.ingredientId),
                quantity:
                    row.quantity === "" ? null : Number.parseInt(row.quantity, 10),
                unit: row.unit.trim() || null,
            }))
            .filter((row) => Number.isFinite(row.ingredientId));

        if (!ingredientRows.length) {
            setCreateRecipeError(
                "Add at least one ingredient row with a selected ingredient.",
            );
            return;
        }

        setCreatingRecipe(true);
        setCreateRecipeError("");
        setCreateRecipeSuccess("");

        try {
            const backendUser = await resolveBackendUser(session);
            const description = newRecipeForm.description.trim() || null;
            const instructions = newRecipeForm.instructions.trim() || null;
            const originalUser =
                backendUser.username || session.user.email || null;

            const createdRecipe = await createRecipeWithFallback([
                {
                    name,
                    description,
                    instructions,
                    originalUser,
                    user: { userId: backendUser.userId },
                },
                {
                    name,
                    description,
                    instructions,
                    originalUser,
                    userId: backendUser.userId,
                },
            ]);

            const recipeId = Number(
                createdRecipe?.recipeId ??
                    createdRecipe?.recipe_id ??
                    createdRecipe?.id,
            );
            if (!Number.isFinite(recipeId)) {
                throw new Error(
                    "Recipe was created but recipe id was missing from response.",
                );
            }

            for (const row of ingredientRows) {
                await createRecipeIngredientWithFallback([
                    {
                        recipe: { recipeId },
                        ingredient: { ingredientId: row.ingredientId },
                        quantity: row.quantity,
                        unit: row.unit,
                    },
                    {
                        recipeId,
                        ingredientId: row.ingredientId,
                        quantity: row.quantity,
                        unit: row.unit,
                    },
                ]);
            }

            setCreateRecipeSuccess("Recipe created and linked to ingredients.");
            setNewRecipeForm({
                name: "",
                description: "",
                instructions: "",
            });
            setRecipeIngredients([{ ingredientId: "", quantity: "", unit: "" }]);
            await retryRecipesLoad();
        } catch (err) {
            console.error(err);
            setCreateRecipeError(
                err?.message ||
                    "Could not create recipe and ingredient links on backend.",
            );
        } finally {
            setCreatingRecipe(false);
        }
    };

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
                {createRecipeError && (
                    <div className="banner banner-warn">{createRecipeError}</div>
                )}
                {createRecipeSuccess && (
                    <div className="banner banner-ok">{createRecipeSuccess}</div>
                )}

                <div className="hero-actions">
                    <button
                        className="btn btn-outline"
                        type="button"
                        onClick={() => setShowCreateForm((prev) => !prev)}
                    >
                        {showCreateForm ? "Hide create recipe" : "Create recipe"}
                    </button>
                </div>

                {showCreateForm && (
                    <form className="login-form" onSubmit={onCreateRecipe}>
                        <label className="login-label">
                            Recipe name
                            <input
                                className="login-input"
                                value={newRecipeForm.name}
                                onChange={(e) =>
                                    setNewRecipeForm((prev) => ({
                                        ...prev,
                                        name: e.target.value,
                                    }))
                                }
                                placeholder="e.g. Garlic Chicken Bowl"
                                required
                            />
                        </label>

                        <label className="login-label">
                            Description
                            <input
                                className="login-input"
                                value={newRecipeForm.description}
                                onChange={(e) =>
                                    setNewRecipeForm((prev) => ({
                                        ...prev,
                                        description: e.target.value,
                                    }))
                                }
                                placeholder="Short recipe description"
                            />
                        </label>

                        <label className="login-label">
                            Instructions
                            <input
                                className="login-input"
                                value={newRecipeForm.instructions}
                                onChange={(e) =>
                                    setNewRecipeForm((prev) => ({
                                        ...prev,
                                        instructions: e.target.value,
                                    }))
                                }
                                placeholder="Step-by-step instructions"
                            />
                        </label>

                        <div className="section">
                            <div className="section-head">
                                <h2 className="section-title">
                                    Ingredients for this recipe
                                </h2>
                                <p className="section-sub">
                                    Select ingredients from backend and pick one
                                    per row.
                                </p>
                            </div>
                            <p className="muted" style={{ marginTop: 0 }}>
                                {`${ingredientOptions.length} ingredient${ingredientOptions.length === 1 ? "" : "s"} available`}
                            </p>

                            {recipeIngredients.map((row, rowIndex) => (
                                <div key={`row-${rowIndex}`} className="recipe-actions2">
                                    <select
                                        className="login-input"
                                        value={row.ingredientId}
                                        onChange={(e) =>
                                            onIngredientSelect(
                                                rowIndex,
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Select ingredient...
                                        </option>
                                        {ingredientOptions.map((ingredient) => (
                                            <option
                                                key={ingredient.ingredientId}
                                                value={ingredient.ingredientId}
                                            >
                                                {ingredient.ingredientName}
                                                {ingredient.unit
                                                    ? ` (${ingredient.unit})`
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        className="login-input"
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={row.quantity}
                                        onChange={(e) =>
                                            updateIngredientRow(rowIndex, {
                                                quantity: e.target.value,
                                            })
                                        }
                                        placeholder="Quantity"
                                    />

                                    <input
                                        className="login-input"
                                        value={row.unit}
                                        readOnly
                                        placeholder="Unit from ingredient"
                                    />

                                    <button
                                        className="btn btn-small btn-ghost"
                                        type="button"
                                        onClick={() => removeIngredientRow(rowIndex)}
                                        disabled={recipeIngredients.length === 1}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}

                            <div className="hero-actions">
                                <button
                                    className="btn btn-ghost"
                                    type="button"
                                    onClick={addIngredientRow}
                                >
                                    + Add ingredient row
                                </button>
                                <button
                                    className="btn btn-primary"
                                    type="submit"
                                    disabled={creatingRecipe}
                                >
                                    {creatingRecipe
                                        ? "Creating recipe..."
                                        : "Create recipe"}
                                </button>
                            </div>
                        </div>
                    </form>
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

                {!!recipes.length && (
                    <div className="recipe-grid">
                        {recipes.map((recipe, index) => {
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
                                                            {plan.dayOfWeek ||
                                                                "Unassigned"}{" "}
                                                            -{" "}
                                                            {plan.partOfDay || "Any"}
                                                            {" "}
                                                            (#{plan.mealPlanId})
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
            </section>
        </main>
    );
}
