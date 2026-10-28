-- KHOJ v6 migration — run ONCE in the Supabase SQL editor (after v5). Safe to re-run.
--
-- Explorer Award = the accounts that have RATED the most projects.
--  * explorer_ranking: public leaderboard (username + number of projects rated).
--  * visitor_leaderboard: admin view, now with the time of each account's latest rating (tie-break).

-- Public: top accounts by projects rated. Ties go to whoever reached their count first.
drop view if exists public.explorer_ranking;
create view public.explorer_ranking as
select v.display_name,
       'KHOJ-' || upper(substr(replace(v.explorer_id, '-', ''), 1, 6)) as explorer_code,
       count(distinct r.project_id) as projects_rated
from public.rating_logs r
join public.visitors v on v.explorer_id = r.explorer_id
group by v.explorer_id, v.display_name
order by projects_rated desc, max(r.rated_at) asc
limit 50;
grant select on public.explorer_ranking to anon, authenticated;

-- Admin only (the caller's own permissions apply, so only admins get rows).
drop view if exists public.visitor_leaderboard;
create view public.visitor_leaderboard with (security_invoker = true) as
select v.explorer_id,
       v.display_name,
       v.email,
       count(distinct b.project_id) as projects_visited,
       count(distinct r.project_id) as projects_rated,
       count(distinct b.project_id) + count(distinct r.project_id) as total_activity,
       max(r.rated_at) as last_rated_at
from public.visitors v
left join public.badge_logs  b on b.explorer_id = v.explorer_id
left join public.rating_logs r on r.explorer_id = v.explorer_id
group by v.explorer_id, v.display_name, v.email;

notify pgrst, 'reload schema';
