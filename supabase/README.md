# Supabase setup

Room state lives in Postgres now (not in the realtime channel), so there is a
single source of truth every client reconciles against. That is what fixes the
reveal desync where one client's dropped socket left the two sides disagreeing
about the round.

## One-time: run the migration

Apply `migrations/0001_state_in_postgres.sql` to your project. Either:

**A. Dashboard (simplest)**
1. Supabase Dashboard → your project → **SQL Editor**.
2. Paste the whole contents of `migrations/0001_state_in_postgres.sql`.
3. **Run**. It is idempotent — safe to run again.

**B. Supabase CLI**
```bash
supabase db push        # or: supabase db execute -f supabase/migrations/0001_state_in_postgres.sql
```

The script creates the tables, the RLS policies, the `revealed_votes()` function,
and adds `rooms` + `participants` to the realtime publication. You do **not** need
to toggle anything by hand in the dashboard afterwards.

## What it creates

| Table          | Realtime | Who can read                          | Purpose |
|----------------|----------|---------------------------------------|---------|
| `rooms`        | on       | anyone                                | authoritative round state (`revealed`, `rev`, `story`, `deck_id`, `deadline`) |
| `participants` | on       | anyone                                | who's at the table — **no vote value**, so it's safe to stream |
| `votes`        | **off**  | **nobody directly** — only via RPC    | the actual estimates |

`revealed_votes(room_id)` is the *only* way a client reads vote values, and it
returns them only once the room is revealed (and only for the current round).
That is what keeps an estimate hidden until the reveal — enforced by the
database, not just the client.

## Security note

There is no auth in the MVP, so the anon (publishable) key does everything — the
same trust model as before, where any client could publish anything into the
channel. The invariant that matters — a vote is unreadable before the reveal —
holds because `votes` has no select grant and no select policy; the gated RPC is
the only door in. When auth arrives, tighten the write policies to
`auth.uid()`-scoped rows.

## Housekeeping

Seats are swept when a client stops sending its ~12s heartbeat (a crashed tab is
gone after ~40s; a clean close frees its seat immediately). No cron needed — any
online client does the sweep. Rows for rooms nobody visits just sit there
harmlessly; delete old ones whenever you like.
