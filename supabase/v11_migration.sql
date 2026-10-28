-- KHOJ v11 migration — run ONCE in the Supabase SQL editor (after v10). Safe to re-run.
--
--  1. Every student account now has a compulsory FULL NAME (kept for admins). The public leaderboard
--     name is separate (a nickname, defaulting to "First L.") so full names are not shown publicly.
--  2. Dummy / test IDs: addresses ending in @khoj.test that an admin has added to the approved list are
--     confirmed automatically, so testers can create an account and log in straight away without a school email.

-- ── 1. Full name ───────────────────────────────────────────────────────────
alter table public.visitors add column if not exists full_name text;

-- Replaces the one-argument version from v10; calls that pass only p_display_name keep working.
drop function if exists public.register_visitor(text);
create or replace function public.register_visitor(p_display_name text, p_full_name text default null)
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
  insert into public.visitors (explorer_id, user_id, email, display_name, full_name)
  values (
    uid::text, uid, mail,
    left(coalesce(nullif(trim(p_display_name), ''), split_part(mail, '@', 1), 'Explorer'), 24),
    nullif(left(trim(coalesce(p_full_name, '')), 80), '')
  )
  on conflict (explorer_id) do update
    set email = excluded.email,
        user_id = excluded.user_id,
        last_seen_at = now(),
        full_name = coalesce(public.visitors.full_name, excluded.full_name);   -- fill once; keeps the saved nickname
end;
$$;
revoke all on function public.register_visitor(text, text) from public;
revoke all on function public.register_visitor(text, text) from anon;
grant execute on function public.register_visitor(text, text) to authenticated;

create or replace function public.set_full_name(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  mail  text;
  final text := left(trim(coalesce(p_name, '')), 80);
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if length(final) < 3 then
    raise exception 'Please enter the student''s full name.';
  end if;
  select email into mail from auth.users where id = uid;
  insert into public.visitors (explorer_id, user_id, email, display_name, full_name)
  values (uid::text, uid, mail, left(coalesce(split_part(mail, '@', 1), 'Explorer'), 24), final)
  on conflict (explorer_id) do update set full_name = excluded.full_name, last_seen_at = now();
  return final;
end;
$$;
revoke all on function public.set_full_name(text) from public;
revoke all on function public.set_full_name(text) from anon;
grant execute on function public.set_full_name(text) to authenticated;

-- Admin view: one row per account, now with the full name.
drop view if exists public.visitor_leaderboard;
create view public.visitor_leaderboard with (security_invoker = true) as
select v.explorer_id,
       v.display_name,
       v.full_name,
       v.email,
       count(distinct b.project_id) as projects_visited,
       count(distinct r.project_id) as projects_rated,
       count(distinct b.project_id) + count(distinct r.project_id) as total_activity,
       max(r.rated_at) as last_rated_at
from public.visitors v
left join public.badge_logs  b on b.explorer_id = v.explorer_id
left join public.rating_logs r on r.explorer_id = v.explorer_id
group by v.explorer_id, v.display_name, v.full_name, v.email;

-- ── 2. Dummy / test IDs ────────────────────────────────────────────────────
create or replace function public.reject_unapproved_student_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mail text := lower(trim(coalesce(new.email, '')));
begin
  if mail = '' or not exists (select 1 from public.student_email_allowlist l where l.email = mail) then
    raise exception 'This email is not on the KHOJ student access list.';
  end if;
  -- Test IDs have no real inbox, so they are confirmed automatically.
  if mail like '%@khoj.test' then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists khoj_student_email_allowlist_guard on auth.users;
create trigger khoj_student_email_allowlist_guard
  before insert on auth.users
  for each row execute function public.reject_unapproved_student_signup();

notify pgrst, 'reload schema';
