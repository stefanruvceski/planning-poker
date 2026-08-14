-- Multi-tenant: turn the app from a single hardcoded team list into one that
-- serves many companies ("brands"), each with its own name, logo and teams,
-- with login required and strict per-brand isolation enforced by RLS.
--
-- Run once, AFTER 0001. Idempotent where practical.
--
-- Model:
--   brands         - one row per company (id 'tma', name, logo, teams[]).
--   brand_members  - the invite list: which email belongs to which brand.
--   profiles       - one row per logged-in user: their brand + display name/avatar.
--   rooms/participants/votes gain a brand_id and are locked to the caller's brand.
--
-- A user's brand is resolved from their profile (current_brand()); everything
-- they can see or touch is scoped to it.

-- ------------------------------------------------------------------ tables ---

create table if not exists public.brands (
  id         text primary key,          -- slug, e.g. 'tma'
  name       text not null,             -- shown in the header
  logo_url   text,                       -- image pressed into the felt (nullable)
  teams      text[] not null default '{}', -- team names; the lobby lists these
  created_at timestamptz not null default now()
);

-- The invite list. Seed a row per person a brand invites; on first login their
-- email is matched here to bind them to the brand.
create table if not exists public.brand_members (
  email      text primary key,          -- lowercased
  brand_id   text not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One row per authenticated user.
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  brand_id     text references public.brands(id),
  display_name text,
  avatar_seed  text,
  created_at   timestamptz not null default now()
);

-- Brand tag on the game tables, so RLS can scope every row to one brand.
alter table public.rooms        add column if not exists brand_id text references public.brands(id);
alter table public.participants add column if not exists brand_id text references public.brands(id);
alter table public.votes        add column if not exists brand_id text references public.brands(id);
create index if not exists rooms_brand_idx        on public.rooms (brand_id);
create index if not exists participants_brand_idx on public.participants (brand_id);

-- --------------------------------------------------------------- functions ---

-- The caller's brand, from their profile. security definer so RLS policies can
-- call it without needing a policy on profiles for the lookup itself.
create or replace function public.current_brand()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select brand_id from public.profiles where user_id = auth.uid();
$$;

-- Called once after login: create the caller's profile if absent, binding it to
-- whatever brand invited their email. Returns the resolved brand_id (or null if
-- the email was never invited). Safe to call repeatedly - it only fills gaps.
create or replace function public.bootstrap_profile(p_display_name text, p_avatar_seed text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invited text;
begin
  select brand_id into v_invited from public.brand_members where email = v_email;

  insert into public.profiles (user_id, brand_id, display_name, avatar_seed)
  values (auth.uid(), v_invited, p_display_name, p_avatar_seed)
  on conflict (user_id) do update
    -- keep whatever the user already has; only fill blanks (and bind the brand
    -- if it wasn't set yet). Profile edits go through a direct update, not here.
    set display_name = coalesce(public.profiles.display_name, nullif(excluded.display_name, '')),
        avatar_seed  = coalesce(public.profiles.avatar_seed,  nullif(excluded.avatar_seed, '')),
        brand_id     = coalesce(public.profiles.brand_id, excluded.brand_id);

  return (select brand_id from public.profiles where user_id = auth.uid());
end;
$$;

-- Votes are written/cleared through these, keyed to the CALLER (auth.uid()), so a
-- client can never write someone else's vote. brand_id is stamped from the
-- caller's brand. security definer to write past the votes RLS lock.
drop function if exists public.cast_vote(text, text, text, integer);
create or replace function public.cast_vote(p_room_id text, p_value text, p_round_rev integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.votes (room_id, player_id, value, round_rev, brand_id, updated_at)
  values (p_room_id, auth.uid()::text, p_value, p_round_rev, public.current_brand(), now())
  on conflict (room_id, player_id)
  do update set value = excluded.value, round_rev = excluded.round_rev, updated_at = now();
$$;

drop function if exists public.clear_vote(text, text);
create or replace function public.clear_vote(p_room_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.votes where room_id = p_room_id and player_id = auth.uid()::text;
$$;

-- Reads votes only for a revealed round of the caller's own brand.
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
    and v.round_rev = r.rev
    and r.brand_id = public.current_brand();
$$;

-- Pays the caller's own seat, atomically.
drop function if exists public.award_chips(text, text, integer);
create or replace function public.award_chips(p_room_id text, p_delta integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.participants
     set chips = chips + p_delta
   where room_id = p_room_id and player_id = auth.uid()::text;
$$;

-- --------------------------------------------------------------------- RLS ---

alter table public.brands        enable row level security;
alter table public.brand_members enable row level security;
alter table public.profiles      enable row level security;

-- Drop the old open-to-anon policies from 0001 - the app is authenticated now.
drop policy if exists rooms_all        on public.rooms;
drop policy if exists participants_all on public.participants;
drop policy if exists votes_insert     on public.votes;
drop policy if exists votes_update     on public.votes;
drop policy if exists votes_delete     on public.votes;

-- brands: read your own brand only.
drop policy if exists brands_read on public.brands;
create policy brands_read on public.brands
  for select to authenticated using (id = public.current_brand());

-- brand_members: never exposed to clients; only the security-definer functions
-- read it. (RLS on, no policy = deny.)

-- profiles: you see and edit only your own.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- rooms / participants: full access, but only within your brand.
drop policy if exists rooms_brand on public.rooms;
create policy rooms_brand on public.rooms
  for all to authenticated
  using (brand_id = public.current_brand())
  with check (brand_id = public.current_brand());

drop policy if exists participants_brand on public.participants;
create policy participants_brand on public.participants
  for all to authenticated
  using (brand_id = public.current_brand())
  with check (brand_id = public.current_brand());

-- votes: still no select policy (hidden until reveal), and writes go only through
-- the RPCs above. Nothing for clients to touch directly.

-- ------------------------------------------------------------------ grants ---

-- Pull the anon grants from 0001; the browser is authenticated now.
revoke all on public.rooms        from anon;
revoke all on public.participants from anon;
revoke all on public.votes        from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.rooms        to authenticated;
grant select, insert, update, delete on public.participants to authenticated;
grant select on public.brands   to authenticated;
grant select, insert, update on public.profiles to authenticated;
-- votes: no direct table grant to clients; the RPCs (security definer) own it.

grant execute on function public.current_brand()                    to authenticated;
grant execute on function public.bootstrap_profile(text, text)      to authenticated;
grant execute on function public.cast_vote(text, text, integer)     to authenticated;
grant execute on function public.clear_vote(text)                   to authenticated;
grant execute on function public.revealed_votes(text)               to authenticated;
grant execute on function public.award_chips(text, integer)         to authenticated;

-- Realtime already carries rooms + participants (0001). RLS above means each
-- client now only receives changes for its own brand.
