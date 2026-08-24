import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY - see .env.local");
}

/**
 * Postgres + Realtime, no auth for the MVP. The room state lives in the database
 * (rooms / participants / votes - see supabase/migrations), which is the single
 * source of truth every client reconciles against; Realtime just streams row
 * changes so the table stays live. The publishable key is meant to live in the
 * browser, and RLS keeps a vote value unreadable until the round is revealed.
 *
 * Cached on globalThis so there is exactly ONE client - and therefore one
 * WebSocket - for the whole app. Without this, dev Fast Refresh re-evaluates
 * this module and spins up a second client/socket on every hot reload.
 */
const globalForSupabase = globalThis as unknown as { __ppSupabase?: SupabaseClient };

export const supabase =
  globalForSupabase.__ppSupabase ??
  (globalForSupabase.__ppSupabase = createClient(url, key, {
    // The app requires login now: keep the session so a refresh stays signed in,
    // refresh the token in the background, and pick up the magic-link session
    // from the URL when the user lands back on the page.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 20 } },
  }));
