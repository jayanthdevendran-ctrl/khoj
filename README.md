# KHOJ 2026

The digital layer over KHOJ, our triennial school science fair. Visitors explore an
interactive campus map, scan project QR codes, collect team badges into a KHOJ
Passport, and vote in the People's Choice Award — while the Explorer Award tracks
who discovers the most of the fair.

This is a Next.js application backed by Supabase. All content — projects, teams,
rooms, floor plans, ratings and badges — comes from your Supabase project; the app
ships with no built-in content (see **Connecting Supabase** below).

---

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` first (see **Connecting Supabase**);
without them the site loads but shows no projects. A visitor's own badges, ratings and
Passport are also kept in their browser's `localStorage` (key `khoj:visitor:v1`).

The admin dashboard uses Supabase email/password authentication. Add the administrator's
Supabase Auth user to `admin_users` before signing in at `/admin`. Student sign-up is
restricted to the email list uploaded from `/admin/dashboard`; apply
`supabase/email_allowlist_migration.sql` to enforce that restriction in the database.

---

## What's implemented vs. what's stubbed

Built in the order the original brief prioritized:

**Tier 1 — Essential (fully working)**
- Navigation (top bar on desktop and mobile)
- Home, with live previews of the map, Passport, and People's Choice
- Interactive SVG campus map with floor switching, category/amenity filters,
  and a "you are here" marker
- Project directory with search, category/location filters, and sorting
- Full project detail pages, driven by the `projects` / `teams` tables
- QR-code identity per project (`/project/<slug>?scan=1`), rendered as a real,
  scannable QR with the `qrcode` package
- Anonymous visitor identity (`KHOJ-####`), created and persisted client-side
- Badge collection with a "Project Discovered" transition, animated badge
  reveal, and duplicate-scan protection ("You've already discovered this project")
- KHOJ Passport: progress compass, stats, milestone path, badge grid
- Ratings, one per project, with duplicate protection

**Tier 2 — Awards (fully working)**
- People's Choice ranking using a configurable weighted (Bayesian) score —
  see `lib/ranking.ts` — so a project with 2 five-star votes can't outrank one
  with 500 ratings averaging 4.8
- Explorer Award leaderboard (Explorer IDs and badge counts from the
  `explorer_ranking` view in `supabase/v4_migration.sql`)
- Achievements (First Discovery, Science Explorer, Deep Explorer, Khoj Master,
  Curious Mind, People's Scientist)

**Tier 3 — Admin (Supabase-authenticated)**
- `/admin` email/password login and `/admin/dashboard` project management
- Uploadable student email allow-list, PDF project import, project deletion, and QR viewer
- "Clear records" section on the dashboard wipes awards, projects, rooms, floor plans,
  subjects and the email list (requires `supabase/v4_migration.sql`).
- Requires Supabase configuration and the SQL migrations documented in `README_PATCH.md`.

**Tier 4 — Advanced (deliberately out of scope for v1, architected for later)**
- Real indoor positioning (BLE/Wi-Fi) — the app currently uses **QR-based
  location checkpoints** (see `/explore`, "Simulate a location QR scan"),
  which is what a phone browser can actually do reliably. `Location.node`
  coordinates and `location_scans` are already shaped so BLE/Wi-Fi trilateration
  can populate the same `currentLocationId` state without any UI rewrite.
- Turn-by-turn routing ("Take me there") — `locations` rows are
  graph-ready (each has floor + x/y), but pathfinding across corridors isn't
  implemented; "Near You" currently uses straight-line distance as a stand-in.
- Drag-and-drop admin map editor
- Live analytics dashboard with charts

None of this requires re-architecting to add later — see the file-by-file
notes below.

---

## Architecture

```
app/
  page.tsx                 Home
  explore/page.tsx         Interactive map
  projects/page.tsx        Project directory
  project/[slug]/page.tsx  Project detail + QR scan flow + rating + badge
  passport/page.tsx        KHOJ Passport
  awards/page.tsx          People's Choice + Explorer Award
  admin/page.tsx           Admin login (Supabase email/password)
  admin/dashboard/page.tsx Admin dashboard
components/                Reusable UI: ProjectCard, BadgeCard, MapSvg, …
lib/
  types.ts                 Canonical data shapes — mirrors supabase/schema.sql
  project-data.tsx          Loads projects, teams, rooms, markers and rating totals from Supabase
  achievements.ts           Passport achievements + progress stats
  visitor-store.tsx         Client-side visitor identity + Passport state
  ranking.ts                Configurable weighted People's Choice formula
supabase/schema.sql         Full production schema + RLS policies
```

Every page that needs interactivity is a client component (`"use client"`).
There is no server-rendered data fetching yet, by design — `lib/project-data.tsx`
reads everything with `supabase.from(...).select()` and the components are built
against `lib/types.ts`.

### Design system

- **Type:** Space Grotesk (display), Inter (body), JetBrains Mono (data/labels — project numbers, coordinates, stats)
- **Color:** deep indigo/navy (`ink` / `night`) as the anchor, with three accent
  families — gold (discovery), teal (science), coral (location/alerts) — rather
  than a single accent color, so categories and states stay visually distinct
- **Signature element:** the compass-dial progress ring (`components/CompassProgress.tsx`),
  used for Passport completion — a deliberate alternative to a generic circular
  progress bar, tying back to KHOJ's "exploration" identity
- Dark mode is supported via Tailwind's `class` strategy; wire a theme toggle
  to `document.documentElement.classList.toggle('dark')` when you're ready —
  one isn't mounted by default so the map's default readability is predictable

---

## Connecting Supabase

1. Create a Supabase project, then run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`
   and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Add a Supabase client (`lib/supabase.ts`):
   ```ts
   import { createClient } from "@supabase/supabase-js";
   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   );
   ```
4. On app load, call `supabase.auth.signInAnonymously()` once per visitor and
   upsert a row into `visitors` keyed by `auth.uid()` — this replaces the
   `randomExplorerId()` logic in `lib/visitor-store.tsx`. Everything downstream
   (badge collection, ratings, achievements) already has the right shape to
   become `supabase.from(...).insert(...)` calls guarded by the RLS policies
   already defined in `supabase/schema.sql`.
5. Run `supabase/v2_migration.sql`, `v3_migration.sql` and `v4_migration.sql` in order.
6. Wire the admin dashboard's table actions to `supabase.from('projects').insert/update/delete`,
   restricted to rows in `admin_users` (already enforced by RLS).

## Replacing the floor plan

`components/MapSvg.tsx` draws the uploaded floor plan image on a `viewBox="0 0 100 100"`
grid (upload one per floor in the admin area). Every project/POI marker is positioned
using `Location.node.x` / `.y`, which are just percentages on that same grid, so
export or crop the floor plan image so its bounds match that grid.

No other file needs to change — markers, filters, and the "you are here"
indicator are all driven by `Location` records, not by the background art.

## QR codes

Every project's QR encodes `${origin}/project/<slug>?scan=1`. The `?scan=1`
flag triggers the "Project Discovered" full-screen reveal before landing on
the normal project page; scanning the same code again just opens the project
page directly (no duplicate "discovery" animation), and the badge/rating
duplicate checks happen regardless of how the visitor arrives at the page.
The admin dashboard's QR viewer (`/admin/dashboard` → "View" on any row) can
be extended into a full printable sheet by rendering all projects through
`ProjectQrCode` on a print-styled page.

---

## Accessibility & performance notes

- All interactive elements are real `<button>`/`<a>` elements with visible
  focus states (see `app/globals.css`)
- Animations respect `prefers-reduced-motion`
- The map SVG has `role="img"` + a descriptive label, and markers are
  keyboard-operable (`tabIndex`, `Enter`/`Space` handling)
- Images/logos are referenced by URL (`Team.logoUrl`) rather than bundled, so
  the project directory doesn't have to download every team logo up front —
  point these at optimized, served assets (Supabase Storage works well) once
  real logos exist
