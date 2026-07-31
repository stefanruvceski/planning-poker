# Planning Poker — project notes

Planning poker for a cross-country team, styled after the old Zynga Poker table on Facebook. Feature reference is planningpokeronline.com.

UI language is English (the team spans several countries). Code comments in English too.

## Running it

```bash
npm install
npm run dev        # http://localhost:3210 -> redirects to /room/default
```

`.env.local` holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The key is a publishable one, meant to sit in the browser. If the file is missing the app throws on boot with a clear message from `src/lib/supabase.ts`.

## Stack and why

- **Next.js 15 (App Router) + TypeScript + Tailwind v4** — deploys free on Vercel.
- **Supabase Postgres + Realtime** — Vercel is serverless and cannot hold a WebSocket, so the server side is the database. Room state lives in Postgres (`rooms` / `participants` / `votes`, see `supabase/migrations`), the single source of truth every client reconciles against; Realtime just streams row changes so the table stays live. A dropped client re-reads the truth on reconnect instead of drifting. This replaced an earlier presence-only design where each client held its own copy and gossiped it — which desynced the moment a socket dropped. No auth yet: the anon (publishable) key does everything, and **RLS keeps a vote value unreadable until the reveal** (see `revealed_votes()`).
- **DiceBear (bottts)** — avatars generated locally as SVG, no API calls. Style is one constant in `src/config/avatars.ts`. The `funEmoji` style was rejected: it draws sick faces and surgical masks.
- **Framer Motion** — card flip on reveal.

## Architecture

```
src/config/decks.ts      card decks — edit values here, no UI needed. Default is
                         "days" (<1d, 2d…10d). A label like "3d" is not a number,
                         so `values` says what each card is worth in the average
                         and `suffix` puts the unit back on it.
src/config/avatars.ts    avatar style + seed helpers
src/config/room.ts       room name + deck id
src/lib/useRoom.ts       ALL room logic — reads/writes the Postgres tables and
                         subscribes to their changes; recovers on a dropped socket
src/lib/stats.ts         average / consensus, spectators excluded
src/components/          PokerTable, Seat, PlayingCard, ChipStack, FeltEmblem, HandDeck, StoryBar, TopBar, JoinModal
src/app/room/[roomId]/   the table
supabase/migrations/     the schema (tables, RLS, revealed_votes RPC). Run it once
                         against the project — see supabase/README.md
```

Route is already parameterised: `/room/anything` is its own independent room row, so several teams can play in parallel today. There is just no lobby UI yet.

## Rules that must not regress

**A vote value is never readable before the reveal.** It is written straight to the `votes` table, but that table has no select grant and no select policy — the only way to read a value is `revealed_votes()`, which returns it only once `rooms.revealed` is true (and only for the current `rev`). The `participants` row carries `has_voted` but never the value. Do not "simplify" by exposing votes over Realtime or reading the table directly — that defeats the hidden vote.

**Chip colour must not encode the vote before the reveal.** Every stack on the felt uses `chip-hidden` while the round is open; `chipTone()` only picks a denomination colour once `showResults` is true. Colouring by value earlier would let anyone read the estimates off the table and defeat the hidden vote above.

**The pot is settled once, from the whole round.** `showResults` is only true when the round is revealed AND `revealed_votes()` has returned, so `settlePot` always runs over the full vote set — it never pays out mid-arrival. The award is guarded by `rev`, persisted to `sessionStorage`, because otherwise a refresh during a revealed round pays the same pot twice. That was a live bug, not a hypothetical.

**Spectators never count.** Not in the average, not in the "x / y voted" counter. That is the whole point of the role (typically the PM).

**The spectator is the facilitator.** Only they can edit the story, reveal, and start a new round; the people estimating only estimate. Fallback: if the room has no spectator at all, the longest-seated player (the one with the star) takes over the controls, otherwise the table would be stuck forever.

**The reveal is atomic.** `useRoom` exposes two flags: `revealed` (round state — locks voting immediately) and `showResults` (revealed AND the values are in, i.e. `revealedRev === rev`). Cards and the average are driven by `showResults` only, so the whole table turns in one go rather than card by card. Because votes now arrive as a single RPC result, there is no per-vote trickle to wait out.

**A new round is a `rev` bump.** `reset` / deck change set `revealed: false` and `rev: rev + 1`; a vote or `has_voted` flag from an older `rev` simply stops counting (both carry the `rev` they were cast at). So opening a round needs no cleanup writes. Editing the story or the timer must NOT bump `rev` — that would wrongly clear votes.

**The database is the single source of truth.** Clients never negotiate state with each other; they write to Postgres and read it back through Realtime. On any (re)connect, `useRoom` re-reads `rooms` + `participants` (+ `revealed_votes` if revealed) so a client that dropped its socket reconciles to the truth instead of drifting. Do not reintroduce peer-to-peer round state (presence/broadcast gossip) — that is exactly the desync this replaced.

## The chip game

Every reveal settles a pot: one chip per real estimate, taken by whoever landed
closest to the average, split evenly on a tie. `?` and `☕` are not estimates, so
they neither ante nor play. The running total sits on each name plate where the
old table kept the chip count, and the leader wears a crown.

Nobody arbitrates. Every client runs `settlePot` over the same votes at the same
moment and reaches the same answer, then writes **only its own** `chips` back to
its `participants` row. Realtime carries the new total to everyone, and a client
that somehow disagreed could not corrupt anybody else's tally.

Note that with exactly two estimators every round is a tie, because the mean of
two numbers is equidistant from both. The game only gets interesting from three
people up.

Totals live in the `participants.chips` column, so they survive a refresh (and
even a closed tab, until the seat is swept). There is no "end of planning" event;
the tally simply stands.

## State of play

Done: single table, join modal (name + spectator toggle + random avatar), live presence, hidden voting, reveal with flip animation, average + distribution, consensus, new round, facilitator-only controls, live story field.

Not done yet, in the order the owner wants them:

1. Lobby / creating tables from the UI
2. Login (Supabase Auth) and per-team tables
3. Deck selection by whoever creates the table
4. Mobile layout — the table is desktop-first and cramped on a phone
5. Estimation history — impossible today, nothing is persisted

## Deployment

Vercel, framework auto-detected, no `vercel.json` needed. Nothing to configure on the Supabase side — the browser talks to Supabase directly, Vercel only serves static JS.

- Repo: `stefanruvceski/planning-poker` (private)
- Vercel project: `stefans-projects-1fea5cda/planning-poker`
- Production: https://planning-poker-hazel-chi.vercel.app

Both `NEXT_PUBLIC_*` variables are already set in the Vercel project for production, preview and development — `.env.local` is gitignored, so they have to live there separately. `.env.example` lists the names.

Vercel refuses to build a Next.js version with a known advisory, which is why the pin is on the latest maintained 15.x rather than the 15.1 line. Keep that in mind before downgrading.

Git integration (auto-deploy on push) is **not** connected yet: the Vercel GitHub App needs access to the private repo, granted at https://github.com/apps/vercel/installations/new. Until then, deploys are manual via `vercel --prod`.
