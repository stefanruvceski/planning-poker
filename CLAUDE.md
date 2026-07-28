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
- **Supabase Realtime** — Vercel is serverless and cannot hold a WebSocket. Supabase Presence gives us "who is at the table" for free, including cleanup when someone closes their tab. No database, no auth, no RLS in the MVP: the whole room state lives in the channel.
- **DiceBear (bottts)** — avatars generated locally as SVG, no API calls. Style is one constant in `src/config/avatars.ts`. The `funEmoji` style was rejected: it draws sick faces and surgical masks.
- **Framer Motion** — card flip on reveal.

## Architecture

```
src/config/decks.ts      card decks — edit values here, no UI needed
src/config/avatars.ts    avatar style + seed helpers
src/config/room.ts       room name + deck id
src/lib/useRoom.ts       ALL realtime logic (presence + broadcast)
src/lib/stats.ts         average / consensus, spectators excluded
src/components/          PokerTable, Seat, PlayingCard, HandDeck, StoryBar, TopBar, JoinModal
src/app/room/[roomId]/   the table
```

Route is already parameterised: `/room/anything` is its own independent channel, so several teams can play in parallel today. There is just no lobby UI yet.

## Rules that must not regress

**A vote never leaves the browser before the reveal.** The presence payload carries `hasVoted: true` but `vote: null`; only when the round is revealed does each client re-publish its payload with the value. Do not "simplify" this by always sending the vote and hiding it in the UI — that would let anyone read other people's votes off the WebSocket.

**Spectators never count.** Not in the average, not in the "x / y voted" counter. That is the whole point of the role (typically the PM).

**The spectator is the facilitator.** Only they can edit the story, reveal, and start a new round; the people estimating only estimate. Fallback: if the room has no spectator at all, the longest-seated player (the one with the star) takes over the controls, otherwise the table would be stuck forever.

**Round convergence uses a Lamport counter.** Every round change carries `rev`, and the highest `rev` wins. This is what keeps clients in sync when two people act at the same moment, and what lets a late joiner catch up through presence. Editing the story bumps `rev` too, but must NOT clear votes — only a flip of `revealed` does that.

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
