import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY - see .env.local");
}

/**
 * Realtime only - no database, no auth for the MVP.
 * The publishable key is meant to live in the browser; the room state is kept
 * entirely in the channel (presence + broadcast).
 *
 * Cached on globalThis so there is exactly ONE client - and therefore one
 * WebSocket - for the whole app. Without this, dev Fast Refresh re-evaluates
 * this module and spins up a second client/socket on every hot reload, and two
 * sockets in the same room split a player's presence so their revealed card
 * never reaches everyone.
 */
const globalForSupabase = globalThis as unknown as { __ppSupabase?: SupabaseClient };

export const supabase =
  globalForSupabase.__ppSupabase ??
  (globalForSupabase.__ppSupabase = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  }));
