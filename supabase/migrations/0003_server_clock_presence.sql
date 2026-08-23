-- Presence off the SERVER clock, not the browser's.
--
-- Bug: each client wrote participants.last_seen with its own clock and every
-- other client judged "is this seat still here?" against ITS own clock. Two
-- machines are never perfectly in sync, so:
--   * your seat looked stale to others and they dropped you (you still saw
--     yourself), and
--   * a client whose clock ran fast would sweep LIVE seats in the stale-row GC.
-- That's the "I enter and nobody's there / after a round I get kicked / refresh
-- a few times to fix it" behaviour.
--
-- Fix: last_seen and the freshness window are both evaluated in the database
-- (now()), so no client clock is ever compared to another's. Run after 0002.

-- How long a seat may go without a heartbeat before it's swept, in server time.
-- Keep in sync with the client's heartbeat interval (must be several beats).
create or replace function public.heartbeat(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mark my own seat alive, in server time.
  update public.participants
     set last_seen = now()
   where room_id = p_room_id and player_id = auth.uid()::text;

  -- Sweep seats in this room (my brand) that truly went quiet - server clock, so
  -- it can never drop a live player because of a skewed browser clock.
  delete from public.participants
   where room_id = p_room_id
     and brand_id = public.current_brand()
     and last_seen < now() - interval '40 seconds';
end;
$$;

-- Head counts for the lobby, judged in server time too (the old client-clock
-- filter had the same skew problem).
create or replace function public.room_head_counts()
returns table (room_id text, n integer)
language sql
security definer
set search_path = public
as $$
  select room_id, count(*)::int
  from public.participants
  where brand_id = public.current_brand()
    and last_seen > now() - interval '40 seconds'
  group by room_id;
$$;

grant execute on function public.heartbeat(text)      to authenticated;
grant execute on function public.room_head_counts()   to authenticated;
