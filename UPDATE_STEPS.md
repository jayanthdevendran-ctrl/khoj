# KHOJ update (v3)

1. Copy everything in this zip over your project folder (say yes to overwrite).
2. Supabase -> SQL editor -> run  supabase/v2_migration.sql  (skip if you already ran it), then  supabase/v3_migration.sql.
3. npm run dev  (check it starts), then:  git add .  /  git commit -m "KHOJ v3"  /  git push
4. On the live site: /admin -> Map & rooms -> upload the four floor plans (Ground, First, Second, Third tabs).
5. /admin -> Projects -> download the template, fill it in, import it.

# KHOJ update (v4)

1. Supabase -> SQL editor -> run  supabase/v4_migration.sql  (once; safe to re-run). It adds the admin "Clear records" function, storage delete permissions, and the public Explorer leaderboard view.
2. /admin/dashboard now has a "4. Clear records" section: tick what to delete, type CLEAR, confirm.

# KHOJ update (v5) — accounts
1. Supabase -> SQL editor -> run  supabase/v5_migration.sql  (once; safe to re-run).
   Ratings, badges/passports and the Explorer ranking are now stored per student account.
2. Existing ratings/badges made before this update were tied to device IDs and are not carried over.

# KHOJ update (v6) — award leaderboards
1. Supabase -> SQL editor -> run  supabase/v6_migration.sql  (once; safe to re-run, after v5).
   Explorer Award = accounts that rated the most projects; People's Choice = highest rated projects.

# KHOJ update (v7)
1. Supabase -> SQL editor -> run  supabase/v7_migration.sql  (once). Fixes "permission denied for function clear_khoj_data".
2. Admin dashboard -> "2. Import teams, projects and logos" -> use Khoj_2026_Teams_with_Logos_and_Subjects.xlsx (it has a new Subjects column) so the map can be filtered by subject.

# KHOJ update (v9) — simple QR scanning
1. Supabase -> SQL editor -> run  supabase/v9_migration.sql  (once; safe to re-run).
   A project unlocks rating and the passport badge when it is opened from its QR link (...?scan=1).
2. QR codes ending in ?scan=1 work. The secret-code version was moved to supabase/not_in_use/ and is not used.

# KHOJ update (v10) — nickname, ranking, goals, bug fixes
1. Supabase -> SQL editor -> run  supabase/v10_migration.sql  (once; safe to re-run). Needed for the leaderboard nickname to save.
2. If the Projects page shows more projects than your Excel has teams (e.g. 154 instead of 134), old and new imports are mixed:
   Admin dashboard -> Clear records -> tick "Projects, teams & logos" -> type CLEAR -> then import the Excel again.

# KHOJ update (v11) — compass, in-page QR scanner, "you are here" tracker, QR PDF, admin tabs, showtimings
1. Run `npm install` once (new package: jsqr, used by the in-page QR scanner), then commit package.json AND package-lock.json.
2. No new Supabase SQL in this update. (v10 is still needed for the leaderboard nickname.)
3. Admin dashboard now has tabs: Overview, Student emails, Import, Projects, Visitors, Floor plans, QR codes, Clear data.
   The "QR codes" tab downloads a PDF of every project's QR code, rebuilt from the current projects each time.
4. Showtimings (app/shows, components/ShowsCard.tsx, lib/shows.ts) come from the uploaded KHOJ_FINAL_7 and are unchanged.

# KHOJ update (v12) — importer reads Numbers-style logo positions
lib/excel-import.ts now works out which row a logo really sits in, so Excel files exported from Numbers (which anchor each logo to the row above) no longer give every team its neighbour's logo.

# KHOJ update (v13) — full name, test IDs, rate-then-passport scan flow, student-name search
1. Supabase -> SQL editor -> run  supabase/v11_migration.sql  (once; safe to re-run). It adds the compulsory student full name (kept for admins only)
   and lets admin-made test IDs (…@khoj.test) log in without a school email.
2. Sign-up now asks for "Student full name" (first + last name). Existing accounts are asked for it once after they sign in.
   The public leaderboard name starts as "First L." (e.g. "Pranjal A.") and can be changed on the Awards page — full names are never shown publicly.
3. Admin dashboard -> "Test IDs" tab: make dummy IDs (e.g. test01). On the site choose Create account once, enter test01 + a password, then use Sign in.
4. Scanning a project's QR code now shows: rate -> (unlocks) Add to Passport -> opens the project page. The badge can only be added after rating.
5. The Projects search finds projects by a student's name (any capitalisation, any word order).

# KHOJ update (v14) — scrollable subject filter, "No results found on this floor", no "student" in login wording
1. Supabase -> SQL editor -> run  supabase/v12_migration.sql  (once; wording of the sign-in messages only).
2. Sign-in screens, the approved-email tab and the visitors list now say "Full name" / "Approved emails" instead of "student".

# KHOJ update (v15) — usability polish for phones and laptops
No database changes. Account menu (laptop header) and a "Signed in as / Sign out" card on the Passport page replace the floating sign-out button;
Explore: short floor names on phones, quick room buttons, auto-scroll to the room's project list on phones, room list stays in view on laptops;
Projects: search/filters remembered when you press Back, "Clear filters" buttons; Passport: All/Collected switch and a start-here empty state;
Sign-in: Show/Hide password; Project page: Back button, no duplicate initials tile; space under the content so the Scan QR button never hides anything;
visible keyboard focus ring; Esc closes the QR scanner.

# KHOJ update (v16) — team members on the project page
Each project page now lists the students on that project (from the Excel "Team Members" column). No database changes.

# KHOJ update (v17) — admin sign-in fix
The visitor sign-in check used to sign out any signed-in account whose email wasn't on the approved list — including admins — whenever an /admin page was loaded or refreshed.
Admins are now exempt, and the admin login page explains clearly when a password is wrong or an account isn't in admin_users.

# KHOJ update (v18) — the full-name prompt never repeats
1. Supabase -> SQL editor -> run  supabase/v13_migration.sql  (once; safe to re-run). "Clear data -> Awards..." now keeps each account's name and nickname.
2. A name entered at the prompt is now remembered in three places (database, the account's profile, and the device), so it is not asked for again.

# KHOJ update (v19) — Clear data can delete all non-admin accounts
1. Supabase -> SQL editor -> run  supabase/v14_migration.sql  (once; safe to re-run, after v13).
2. Admin dashboard -> Clear data -> "All non-admin accounts (names, emails & passwords)". Admins are never deleted; the approved email list is left alone.

# KHOJ update (v20) — admin Passwords tab
1. Supabase -> SQL editor -> run  supabase/v15_migration.sql  (once; safe to re-run, after v14). Needed only for "Reset someone's password".
2. Admin dashboard -> Passwords: reset any non-admin account's password by email, and change your own admin password (no SQL needed for that part).
