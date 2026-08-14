-- Seed the TMA brand as a tenant that lives in the database, not in code.
-- Run in Supabase → SQL Editor after 0002_multi_tenant.sql. Re-runnable.
--
-- Edit the values below for the brand, then add one brand_members row per email
-- that should be able to log in as TMA. A person can only sign in if their email
-- is listed here (that's the invite).

-- 1) The brand: name, logo, and the teams the lobby will list.
insert into public.brands (id, name, logo_url, teams)
values (
  'tma',
  'TMA',
  null,  -- put a public image URL here for the logo on the felt, or leave null
  array['Identity Payments', 'Engagement', 'Connectivity', 'Compliance Reporting']
)
on conflict (id) do update
  set name = excluded.name,
      logo_url = excluded.logo_url,
      teams = excluded.teams;

-- 2) Who may log in as TMA (the invite list). Add one row per email, lowercased.
insert into public.brand_members (email, brand_id) values
  ('stefanruvceski@gmail.com', 'tma')
  -- , ('teammate@example.com', 'tma')
on conflict (email) do update set brand_id = excluded.brand_id;

-- Handy checks:
--   select * from public.brands;
--   select * from public.brand_members;
