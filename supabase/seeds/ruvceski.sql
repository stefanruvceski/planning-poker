-- Seed the "Ruvceski" test brand. Same shape as tma.sql. Run in the SQL Editor
-- after the migrations. The logo is a minimalist "R" as an inline SVG data URI,
-- so it needs no hosting - it renders in the header/lobby and engraves into the
-- felt (see FeltEmblem).
insert into public.brands (id, name, logo_url, teams)
values (
  'ruvceski',
  'Ruvceski',
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHBhdGggZD0iTTIwIDUyIFYxMyBIMzQgYTEyIDEyIDAgMCAxIDAgMjQgSDIwIE0zMiAzNyBMNDYgNTIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzdjNmNmMCIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4K',
  array['Alpha', 'Beta', 'Sandbox']
)
on conflict (id) do update
  set name = excluded.name, logo_url = excluded.logo_url, teams = excluded.teams;

-- Invite list for this brand. One row per email, lowercased. A Gmail "+alias"
-- lets one inbox test a second brand without moving off its main brand
-- (brand_members is keyed by email, so one email = one brand).
insert into public.brand_members (email, brand_id) values
  ('stefanruvceski@gmail.com', 'ruvceski')
  -- , ('stefanruvceski+alias@gmail.com', 'ruvceski')
on conflict (email) do update set brand_id = excluded.brand_id;
