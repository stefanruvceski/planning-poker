-- Guest access by team code, for people whose company mail strips the login
-- email entirely.
--
-- Some corporate mail gateways don't just pre-open magic links (0002/OTP already
-- handles that) - they quarantine the sign-in mail so it never arrives at all.
-- Those users can't use email OR the OTP code. So each brand also gets a shared
-- secret "join code", handed out of band (chat, a call). A guest signs in
-- anonymously, types their brand id + that code, and - if the pair matches - is
-- bound to the brand and continues without ever giving an email.
--
-- Run once, AFTER 0003. Idempotent where practical.
--
-- Model changes:
--   brands.join_code   - the per-brand shared secret (nullable; null = no guest
--                        access for that brand). Never sent to the browser.
--   profiles.brand_id  - a guest's brand binding. For emailed users the brand
--                        still comes from brand_members (the invite list); this
--                        column is only the fallback for code-joined guests.
--   current_brand()    - now coalesce(invite list, guest binding), invite wins.
--   join_with_code()   - verify brand+code, bind the caller, return the brand.
--
-- Requires "Anonymous sign-ins" enabled in Supabase Auth settings.

-- ------------------------------------------------------------------ schema ---

alter table public.brands    add column if not exists join_code text;
alter table public.profiles  add column if not exists brand_id text references public.brands(id);

-- --------------------------------------------------------------- functions ---

-- The caller's brand: their email invite (brand_members) if any, otherwise their
-- guest binding (profiles.brand_id). Invite wins, so an invited user who once
-- typed a code still lands on their real brand. security definer, same as before.
create or replace function public.current_brand()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select brand_id from public.brand_members where email = lower(auth.jwt() ->> 'email')),
    (select brand_id from public.profiles where user_id = auth.uid())
  );
$$;

-- Bind the (anonymous) caller to a brand by its shared code. Returns the brand id
-- on a match, null otherwise. security definer so it can read join_code and write
-- the binding past RLS. The brand id is matched case-insensitively; the code is
-- matched exactly (only whitespace is trimmed), so it stays a real secret.
create or replace function public.join_with_code(p_brand_id text, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match text;
begin
  select id into v_match
  from public.brands
  where id = lower(trim(p_brand_id))
    and join_code is not null
    and join_code = trim(p_code);

  if v_match is null then
    return null;  -- wrong brand or code; caller stays unbound
  end if;

  -- Bind this seat to the brand. bootstrap_profile has usually created the row
  -- already, but upsert so a code-first flow works too.
  insert into public.profiles (user_id, brand_id)
  values (auth.uid(), v_match)
  on conflict (user_id) do update set brand_id = excluded.brand_id;

  return v_match;
end;
$$;

-- ------------------------------------------------------------------ grants ---

-- The join code must never reach the browser. brands_read (0002) already limits
-- rows to the caller's own brand, but a bound guest could still read that row -
-- so restrict the SELECT to the safe columns at the column level. The client
-- only ever selects id/name/logo_url/teams, so nothing legitimate breaks.
revoke select on public.brands from authenticated;
grant select (id, name, logo_url, teams, created_at) on public.brands to authenticated;

grant execute on function public.join_with_code(text, text) to authenticated;
