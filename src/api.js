import { supabase } from "./lib/supabaseClient";

export async function apiFetch(path, options = {}) {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
        throw new Error("Not authenticated");
    }

    const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "https://recipe-backend-production-2e13.up.railway.app"}${path}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...options.headers,
            },
        },
    );

    if (response.status === 401) {
        throw new Error("Unauthorized - please log in");
    }

    if (response.status === 403) {
        throw new Error("Forbidden - you don't have permission");
    }

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    return response.json();
}
