-- KHOJ v2 migration — run ONCE in the Supabase SQL editor.
-- Safe to re-run. Replaces visitor_tracking_migration.sql (don't run that one).
--
-- What this does
--  1. Fixes visitor tracking. schema.sql already had a `visitors` table of a
--     different shape (it needs Supabase anonymous sign-in, which the app
--     doesn't use), so the earlier tracking tables never worked. They're
--     rebuilt here. (The old visitors table held no data the app ever wrote.)
--  2. Lets rooms be "not placed on the map yet" (needed for Excel import).
--  3. Lets admins manage amenity markers (restrooms, food, ...).
--  4. Adds public per-project rating/visit totals for the Awards page.
--  5. Adds the admin-only visitor leaderboard.

-- ── 1. Visitor tracking ────────────────────────────────────────────────────
drop view  if exists visitor_leaderboard;
drop view  if exists project_stats;
drop table if exists badge_logs;
drop table if exists rating_logs;
drop table if exists visitors cascade;

create table visitors (
  explorer_id  text primary key,            -- e.g. "KHOJ-4821", made on the visitor's device
  display_name text not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table badge_logs (
  id           bigint generated always as identity primary key,
  explorer_id  text not null references visitors(explorer_id) on delete cascade,
  project_id   text not null,
  collected_at timestamptz not null default now(),
  unique (explorer_id, project_id)
);

create table rating_logs (
  id          bigint generated always as identity primary key,
  explorer_id text not null references visitors(explorer_id) on delete cascade,
  project_id  text not null,
  rating      int  not null check (rating between 1 and 5),
  rated_at    timestamptz not null default now(),
  unique (explorer_id, project_id)
);

alter table visitors    enable row level security;
alter table badge_logs  enable row level security;
alter table rating_logs enable row level security;

-- Visitors don't log in, so these tables can't tie a row to one person.
-- Anyone may ADD badge/rating rows; only admins may READ them. Creating or
-- renaming a visitor goes through the function below, so nobody can edit or
-- overwrite another visitor's row directly.
create policy "anyone can log a badge"   on badge_logs  for insert with check (true);
create policy "anyone can log a rating"  on rating_logs for insert with check (true);
create policy "admins read visitors"     on visitors    for select using (auth.uid() in (select id from admin_users));
create policy "admins read badge logs"   on badge_logs  for select using (auth.uid() in (select id from admin_users));
create policy "admins read rating logs"  on rating_logs for select using (auth.uid() in (select id from admin_users));

create or replace function upsert_visitor(p_explorer_id text, p_display_name text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into visitors (explorer_id, display_name)
  values (left(p_explorer_id, 40), left(p_display_name, 24))
  on conflict (explorer_id)
  do update set display_name = excluded.display_name, last_seen_at = now();
$$;
revoke all on function upsert_visitor(text, text) from public;
grant execute on function upsert_visitor(text, text) to anon, authenticated;

-- ── 2. Rooms that haven't been positioned on the map yet ───────────────────
alter table locations add column if not exists placed boolean not null default true;

-- ── 3. Admins manage amenity markers ───────────────────────────────────────
drop policy if exists "admins manage pois" on points_of_interest;
create policy "admins manage pois" on points_of_interest for all
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- ── 4. Public totals per project (counts only — no names) ──────────────────
create view project_stats as
with r as (select project_id, avg(rating) as a, count(*) as c from rating_logs group by project_id),
     b as (select project_id, count(*) as n from badge_logs group by project_id)
select coalesce(r.project_id, b.project_id) as project_id,
       coalesce(round(r.a, 2), 0)           as average,
       coalesce(r.c, 0)                     as count,
       coalesce(b.n, 0)                     as explorers
from r full join b on r.project_id = b.project_id;
-- Runs with the view owner's rights on purpose, so visitors can see totals
-- without being able to read individual rows.
grant select on project_stats to anon, authenticated;

-- ── 5. Admin-only visitor leaderboard ──────────────────────────────────────
-- security_invoker = the caller's own permissions apply, so only admins get rows.
create view visitor_leaderboard with (security_invoker = true) as
select v.explorer_id,
       v.display_name,
       count(distinct b.project_id) as projects_visited,
       count(distinct r.project_id) as projects_rated,
       count(distinct b.project_id) + count(distinct r.project_id) as total_activity
from visitors v
left join badge_logs  b on b.explorer_id = v.explorer_id
left join rating_logs r on r.explorer_id = v.explorer_id
group by v.explorer_id, v.display_name;
