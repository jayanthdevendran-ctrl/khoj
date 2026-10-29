-- Run after schema.sql and floorplan_migration.sql.
-- Central record of every visitor + every badge scan + every rating, so an
-- admin can see who (by name) has visited/rated the most projects, across
-- every device.

create table if not exists visitors (
  explorer_id text primary key,          -- e.g. "KHOJ-4821", generated client-side
  display_name text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists badge_logs (
  id bigint generated always as identity primary key,
  explorer_id text not null references visitors(explorer_id) on delete cascade,
  project_id text not null,
  collected_at timestamptz not null default now(),
  unique (explorer_id, project_id)       -- one badge per visitor per project
);

create table if not exists rating_logs (
  id bigint generated always as identity primary key,
  explorer_id text not null references visitors(explorer_id) on delete cascade,
  project_id text not null,
  rating int not null check (rating between 1 and 5),
  rated_at timestamptz not null default now(),
  unique (explorer_id, project_id)       -- one rating per visitor per project
);

alter table visitors enable row level security;
alter table badge_logs enable row level security;
alter table rating_logs enable row level security;

-- Visitors are anonymous (no Supabase Auth login for regular visitors —
-- that would add a login screen for every attendee, which isn't the goal).
-- So there's no way to cryptographically restrict "you can only write your
-- own row" the way the admin-only tables do. Anyone can insert/update a
-- visitor-tracking row. That's an accepted tradeoff for a school-fair-scale
-- app: the worst case is someone submits junk data, not that they can read
-- or corrupt anyone else's account. If that risk matters more for your
-- event, the fix is giving each visitor a real (even anonymous) Supabase
-- Auth session — ask and I'll wire that up instead.

create policy "anyone can create their visitor record"
  on visitors for insert
  with check (true);

create policy "anyone can update their own visitor record"
  on visitors for update
  using (true);

create policy "only admins can list all visitors"
  on visitors for select
  using (auth.uid() in (select id from admin_users));

create policy "anyone can log their own badge scans"
  on badge_logs for insert
  with check (true);

create policy "only admins can read badge logs"
  on badge_logs for select
  using (auth.uid() in (select id from admin_users));

create policy "anyone can log their own ratings"
  on rating_logs for insert
  with check (true);

create policy "only admins can read rating logs"
  on rating_logs for select
  using (auth.uid() in (select id from admin_users));

-- Handy view for the leaderboard: total badges + ratings per visitor.
create or replace view visitor_leaderboard as
select
  v.explorer_id,
  v.display_name,
  count(distinct b.project_id) as projects_visited,
  count(distinct r.project_id) as projects_rated,
  count(distinct b.project_id) + count(distinct r.project_id) as total_activity
from visitors v
left join badge_logs b on b.explorer_id = v.explorer_id
left join rating_logs r on r.explorer_id = v.explorer_id
group by v.explorer_id, v.display_name
order by total_activity desc;

-- visitor_leaderboard inherits the underlying tables' RLS, so it's admin-only too.
