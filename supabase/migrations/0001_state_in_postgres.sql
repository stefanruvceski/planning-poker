-- Planning Poker: move room state out of the realtime channel and into Postgres,
-- so there is a single source of truth every client reconciles against instead
-- of each client holding its own copy and gossiping it over presence/broadcast.
-- That gossip model desynced the moment one client's socket dropped (one side
-- revealed, the other still voting); with the state in the database a client
-- just re-reads the truth when it reconnects.
--
-- Run this once against your Supabase project: paste it into the SQL editor
-- (Dashboard -> SQL) or `supabase db push`. It is idempotent - safe to re-run.

-- 1. Rooms: the authoritative round state. One row per room, created lazily by
--    whoever opens it first.
create table if not exists public.rooms (
  id         text primary key,
  deck_id    text        not null default 'days',
  story      text        not null default '',
  revealed   boolean     not null default false,
  -- Lamport-ish round counter: bumped on every new round, so a vote or a
  -- has_voted flag from an older round can be told apart and ignored.
  rev        integer     not null default 0,
  deadline   timestamptz,
  updated_at timestamptz not null default now()
);

-- 2. Participants: who is at the table. Deliberately carries NO vote value, so
--    it is safe to stream over realtime. has_voted / voted_rev drive the
--    "x / y voted" counter without exposing anything.
create table if not exists public.participants (
  room_id     text        not null,
  player_id   text        not null,
  name        text        not null,
  avatar_seed text        not null,
  role        text        not null default 'player',
  has_voted   boolean     not null default false,
  voted_rev   integer     not null default -1,
  chips       integer     not null default 0,
  joined_at   timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (room_id, player_id)
);
create index if not exists participants_room_idx on public.participants (room_id);

-- 3. Votes: the actual estimates. These are NEVER exposed to clients directly -
--    realtime is off for this table and RLS blocks every select. They are read
--    only through revealed_votes() below, and only once the round is revealed.
--    round_rev ties a vote to the round it was cast in, so a leftover vote from
--    a previous round can never count.
create table if not exists public.votes (
  room_id    text        not null,
  player_id  text        not null,
  value      text        not null,
  round_rev  integer     not null,
  updated_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

-- 4. The ONLY read path for votes: returns them for a room only when that room
--    is revealed, and only for the current round. security definer so it can
--    read past the RLS lock below - safe because the revealed check lives inside
--    the function, not in the caller.
create or replace function public.revealed_votes(p_room_id text)
returns table (player_id text, value text)
language sql
security definer
set search_path = public
as $$
  select v.player_id, v.value
  from public.votes v
  join public.rooms r on r.id = v.room_id
  where v.room_id = p_room_id
    and r.revealed = true
    and v.round_rev = r.rev;
$$;

-- Row level security. There is no auth in the MVP, so the anon (publishable)
-- key does everything - the same trust model as the old channel, where any
-- client could publish anything. The one invariant that MUST hold is that a
-- vote value is never selectable before the reveal; that is enforced by having
-- no select grant and no select policy on votes, leaving revealed_votes() as
-- the only way in.
alter table public.rooms        enable row level security;
alter table public.participants enable row level security;
alter table public.votes        enable row level security;

drop policy if exists rooms_all on public.rooms;
create policy rooms_all on public.rooms
  for all to anon using (true) with check (true);

drop policy if exists participants_all on public.participants;
create policy participants_all on public.participants
  for all to anon using (true) with check (true);

-- votes: write allowed (cast / clear your estimate), select intentionally absent.
drop policy if exists votes_insert on public.votes;
create policy votes_insert on public.votes
  for insert to anon with check (true);
drop policy if exists votes_update on public.votes;
create policy votes_update on public.votes
  for update to anon using (true) with check (true);
drop policy if exists votes_delete on public.votes;
create policy votes_delete on public.votes
  for delete to anon using (true);

grant usage on schema public to anon;
grant select, insert, update, delete on public.rooms        to anon;
grant select, insert, update, delete on public.participants to anon;
-- NB: no select on votes, by design.
grant insert, update, delete on public.votes to anon;
grant execute on function public.revealed_votes(text) to anon;

-- 5. Realtime: rooms + participants stream to clients. votes MUST NOT be added
--    to the publication, or the estimates would leak inside the change payloads.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;
