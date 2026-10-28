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
