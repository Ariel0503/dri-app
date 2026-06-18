// src/supabaseClient.ts
// Direct, static import so Vite bundles it correctly in dev and prod.
// Exports `supabase` (and a default) — the app reads `mod.supabase || mod.default`.
// `initError` is set when the client can't be built, so the reason is visible
// instead of silently falling back to in-memory mode.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

let client: SupabaseClient | null = null;
export let initError: string | null = null;

if (!url || !anon) {
  const missing = [!url && "VITE_SUPABASE_URL", !anon && "VITE_SUPABASE_PUBLISHABLE_KEY"]
    .filter(Boolean)
    .join(" and ");
  // These are read at BUILD time. If this fires in production, the variables
  // were not set in Vercel (or not present for this deployment's environment),
  // and the build needs to be re-run after adding them.
  initError = `Supabase not configured — missing ${missing} at build time.`;
  // eslint-disable-next-line no-console
  console.warn("[supabaseClient]", initError);
} else {
  try {
    client = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch (e: any) {
    initError = e?.message || String(e);
    // eslint-disable-next-line no-console
    console.error("[supabaseClient] createClient failed:", initError);
  }
}

export const supabase = client;
export default client;
