-- KHOJ v5 migration — run ONCE in the Supabase SQL editor (after v2, v3, v4). Safe to re-run.
--
-- Ties ratings, badges (passports) and the Explorer ranking to each signed-in student ACCOUNT.
-- Before this, visitor data was keyed to a random ID made on each device, and anyone could write
-- rows for any ID — so ratings/badges were shared between accounts on one device and often never
-- saved (a visitor row could not be created, which blocked every rating and badge).

-- ── 1. Visitors become accounts ────────────────────────────────────────────
alter table public.visitors add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.visitors add column if not exists email   text;
create unique index if not exists visitors_user_id_key on public.visitors(user_id) where user_id is not null;

-- ── 2. Only the signed-in student can add or read their own rows ──────────
drop policy if exists "anyone can log a badge"  on public.badge_logs;
drop policy if exists "anyone can log a rating" on public.rating_logs;
drop policy if exists "students log own badge"  on public.badge_logs;
drop policy if exists "students log own rating" on public.rating_logs;
drop policy if exists "students read own badges"  on public.badge_logs;
drop policy if exists "students read own ratings" on public.rating_logs;
drop policy if exists "students read own visitor row" on public.visitors;

create policy "students log own badge"  on public.badge_logs  for insert to authenticated with check (explorer_id = auth.uid()::text);
create policy "students log own rating" on public.rating_logs for insert to authenticated with check (explorer_id = auth.uid()::text);
create policy "students read own badges"  on public.badge_logs  for select to authenticated using (explorer_id = auth.uid()::text);
create policy "students read own ratings" on public.rating_logs for select to authenticated using (explorer_id = auth.uid()::text);
create policy "students read own visitor row" on public.visitors for select to authenticated using (explorer_id = auth.uid()::text);
-- (admins keep their read-everything policies from v2)

-- ── 3. Create / refresh the caller's own visitor row ──────────────────────
drop function if exists public.upsert_visitor(text, text);   -- old version let anyone rename anyone

create or replace function public.register_visitor(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  mail text;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select email into mail from auth.users where id = uid;
  insert into public.visitors (explorer_id, user_id, email, display_name)
  values (uid::text, uid, mail, left(coalesce(nullif(trim(p_display_name), ''), split_part(mail, '@', 1), 'Explorer'), 24))
  on conflict (explorer_id) do update
    set display_name = excluded.display_name, email = excluded.email, user_id = excluded.user_id, last_seen_at = now();
end;
$$;
revoke all on function public.register_visitor(text) from public;
revoke all on function public.register_visitor(text) from anon;
grant execute on function public.register_visitor(text) to authenticated;

-- ── 4. Public Explorer ranking (short code + badge count only) ────────────
drop view if exists public.explorer_ranking;
create view public.explorer_ranking as
select 'KHOJ-' || upper(substr(replace(b.explorer_id, '-', ''), 1, 6)) as explorer_code,
       count(distinct b.project_id) as badges
from public.badge_logs b
group by b.explorer_id
order by badges desc
limit 50;
grant select on public.explorer_ranking to anon, authenticated;

-- ── 5. Admin view: one row per account, now with email ────────────────────
drop view if exists public.visitor_leaderboard;
create view public.visitor_leaderboard with (security_invoker = true) as
select v.explorer_id,
       v.display_name,
       v.email,
       count(distinct b.project_id) as projects_visited,
       count(distinct r.project_id) as projects_rated,
       count(distinct b.project_id) + count(distinct r.project_id) as total_activity
from public.visitors v
left join public.badge_logs  b on b.explorer_id = v.explorer_id
left join public.rating_logs r on r.explorer_id = v.explorer_id
group by v.explorer_id, v.display_name, v.email;

notify pgrst, 'reload schema';
