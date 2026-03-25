import { supabase } from "./lib/supabaseClient";

export default function LoginPage() {
    const goHome = () => {
        window.location.hash = "#/";
    };

    const startOAuth = async (provider) => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) console.error("OAuth error:", error.message);
    };

    return (
        <div className="app-shell">
            <header className="topbar">
                <div
                    className="brand"
                    role="button"
                    tabIndex={0}
                    onClick={goHome}
                    onKeyDown={(e) => e.key === "Enter" && goHome()}
                >
                    <div className="brand-mark" aria-hidden="true">
                        🍳
                    </div>
                    <div className="brand-text">
                        <div className="brand-name">Recipe Meal Planner</div>
                        <div className="brand-sub">
                            Find recipes • Save favorites • Plan your week
                        </div>
                    </div>
                </div>

                <div className="auth">
                    <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={goHome}
                    >
                        Back
                    </button>
                </div>
            </header>

            <main className="page">
                <section className="hero">
                    <div className="hero-card">
                        <h1 className="hero-title">Log in</h1>
                        <p className="hero-copy">
                            Sign in with your Google or GitHub account to save
                            recipes and build meal plans.
                        </p>

                        <div className="login-actions">
                            <button
                                className="btn btn-primary"
                                type="button"
                                onClick={() => startOAuth("google")}
                            >
                                Continue with Google
                            </button>
                            <button
                                className="btn btn-outline"
                                type="button"
                                onClick={() => startOAuth("github")}
                            >
                                Continue with GitHub
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
