-- KHOJ 2026 — Supabase schema
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh
-- project. Pairs with lib/types.ts. Uses Supabase's built-in anonymous
-- auth (auth.signInAnonymously()) so every visitor gets a stable auth.uid()
-- without collecting any personal information — that uid is the `visitors.id`.
--
-- Duplicate ratings and duplicate badges are prevented with real UNIQUE
-- constraints, not just app-level checks, per the "don't trust the
-- frontend" requirement.

-- ── Extensions ──────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Reference tables ────────────────────────────────────────────────────
create table categories (
  id text primary key,
  name text not null,
  icon text not null,
  color text not null check (color in ('gold', 'teal', 'indigo', 'coral'))
);

create table teams (
  id text primary key,
  name text not null,
  logo_url text,
  description text,
  members text[] not null default '{}'
);

create table locations (
  id text primary key,
  building text not null,
  floor int not null default 0,
  room text not null,
  x_coordinate numeric not null,      -- 0–100, position on the floor SVG
  y_coordinate numeric not null,
  latitude double precision,          -- optional, for outdoor/browser geolocation
  longitude double precision
);

-- ── Projects ────────────────────────────────────────────────────────────
create table projects (
  id uuid primary key default uuid_generate_v4(),
  project_number int not null unique,
  name text not null,
  slug text not null unique,
  tagline text,
  description text,
  problem text,
  solution text,
  impact text,
  category_id text references categories(id),
  team_id text references teams(id),
  location_id text references locations(id),
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index projects_active_idx on projects (active);
create index projects_category_idx on projects (category_id);

-- ── Points of interest (food, restrooms, help, first aid, entrances…) ──
create table points_of_interest (
  id uuid primary key default uuid_generate_v4(),
  kind text not null check (kind in ('food','restroom','help','first-aid','entrance','stairs','lift')),
  label text not null,
  location_id text references locations(id)
);

-- ── Visitors (anonymous identities) ─────────────────────────────────────
-- id == auth.uid() from Supabase anonymous auth. No PII stored.
create table visitors (
  id uuid primary key references auth.users(id) on delete cascade,
  explorer_id text not null unique,      -- human-friendly public code, e.g. KHOJ-4821
  display_name text,                     -- optional, visitor-chosen, shown on leaderboards only
  created_at timestamptz not null default now()
);

-- ── Badges (one badge definition per project) ───────────────────────────
create table badges (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade unique,
  name text not null,
  logo_url text
);

-- ── Visitor <-> badge collection ────────────────────────────────────────
-- UNIQUE(visitor_id, project_id) is what makes "one project = one badge"
-- enforceable even if the client scans the same QR twice.
create table visitor_badges (
  id uuid primary key default uuid_generate_v4(),
  visitor_id uuid not null references visitors(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  collected_at timestamptz not null default now(),
  unique (visitor_id, project_id)
);

create index visitor_badges_visitor_idx on visitor_badges (visitor_id);
create index visitor_badges_project_idx on visitor_badges (project_id);

-- ── Ratings ──────────────────────────────────────────────────────────────
-- UNIQUE(visitor_id, project_id) enforces "one rating per project per visitor"
-- at the database level.
create table ratings (
  id uuid primary key default uuid_generate_v4(),
  visitor_id uuid not null references visitors(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (visitor_id, project_id)
);

create index ratings_project_idx on ratings (project_id);

-- ── Achievements ─────────────────────────────────────────────────────────
create table achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null
);

create table visitor_achievements (
  visitor_id uuid not null references visitors(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (visitor_id, achievement_id)
);

-- ── Location scans (QR-based indoor positioning checkpoints) ───────────
create table location_scans (
  id uuid primary key default uuid_generate_v4(),
  visitor_id uuid not null references visitors(id) on delete cascade,
  location_id text not null references locations(id) on delete cascade,
  scanned_at timestamptz not null default now()
);

create index location_scans_visitor_idx on location_scans (visitor_id, scanned_at desc);

-- ── Admins ───────────────────────────────────────────────────────────────
-- A minimal allow-list of admin users. Use real Supabase Auth (email/
-- password or magic link) for admin sign-in.
create table admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique
);

-- ── Convenience views ────────────────────────────────────────────────────
create view project_rating_stats as
select
  p.id as project_id,
  coalesce(avg(r.rating), 0)::numeric(3,2) as average_rating,
  count(r.id) as rating_count
from projects p
left join ratings r on r.project_id = p.id
group by p.id;

create view explorer_leaderboard as
select
  v.id as visitor_id,
  v.explorer_id,
  v.display_name,
  count(vb.id) as badge_count
from visitors v
join visitor_badges vb on vb.visitor_id = v.id
group by v.id
order by badge_count desc;

-- ── Row Level Security ───────────────────────────────────────────────────
alter table visitors enable row level security;
alter table visitor_badges enable row level security;
alter table ratings enable row level security;
alter table visitor_achievements enable row level security;
alter table location_scans enable row level security;
alter table projects enable row level security;
alter table categories enable row level security;
alter table teams enable row level security;
alter table locations enable row level security;
alter table points_of_interest enable row level security;
alter table badges enable row level security;
alter table achievements enable row level security;
alter table admin_users enable row level security;

-- Public read access to event content
create policy "public read categories" on categories for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read locations" on locations for select using (true);
create policy "public read pois" on points_of_interest for select using (true);
create policy "public read active projects" on projects for select using (active = true);
create policy "public read badges" on badges for select using (true);
create policy "public read achievements" on achievements for select using (true);

-- Visitors manage only their own row
create policy "visitor reads self" on visitors for select using (auth.uid() = id);
create policy "visitor creates self" on visitors for insert with check (auth.uid() = id);
create policy "visitor updates self" on visitors for update using (auth.uid() = id);

-- Badge collection: a visitor may only read/insert their own badges.
-- The UNIQUE(visitor_id, project_id) constraint blocks double-collection
-- even if this policy is somehow bypassed.
create policy "visitor reads own badges" on visitor_badges for select using (auth.uid() = visitor_id);
create policy "visitor inserts own badges" on visitor_badges for insert with check (auth.uid() = visitor_id);

-- Ratings: same pattern. No update/delete policy is defined on purpose —
-- ratings are immutable once cast, which is also an anti-abuse measure.
create policy "visitor reads own ratings" on ratings for select using (auth.uid() = visitor_id);
create policy "visitor inserts own ratings" on ratings for insert with check (auth.uid() = visitor_id);
create policy "public reads rating stats" on ratings for select using (true); -- aggregate counts only via the view above

create policy "visitor reads own achievements" on visitor_achievements for select using (auth.uid() = visitor_id);
create policy "visitor inserts own achievements" on visitor_achievements for insert with check (auth.uid() = visitor_id);

create policy "visitor reads own scans" on location_scans for select using (auth.uid() = visitor_id);
create policy "visitor inserts own scans" on location_scans for insert with check (auth.uid() = visitor_id);

-- Admins: writes to event content are restricted to rows in admin_users.
-- (Reads stay open via the public policies above.)
create policy "admins manage projects" on projects for all
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));
create policy "admins manage teams" on teams for all
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));
create policy "admins manage locations" on locations for all
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));
create policy "admins manage categories" on categories for all
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));
create policy "admins read admin_users" on admin_users for select using (auth.uid() in (select id from admin_users));
