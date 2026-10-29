-- KHOJ v10 migration — run ONCE in the Supabase SQL editor (after v9). Safe to re-run.
--
-- Makes the leaderboard nickname stick:
--  * register_visitor() no longer overwrites an existing nickname each time a student signs in
--    (it only sets the starting name the first time).
--  * set_display_name() lets a signed-in student change their OWN leaderboard name.

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
    set email = excluded.email, user_id = excluded.user_id, last_seen_at = now();   -- keeps the saved nickname
end;
$$;
revoke all on function public.register_visitor(text) from public;
revoke all on function public.register_visitor(text) from anon;
grant execute on function public.register_visitor(text) to authenticated;

create or replace function public.set_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  mail  text;
  final text;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select email into mail from auth.users where id = uid;
  final := left(coalesce(nullif(trim(p_name), ''), split_part(mail, '@', 1), 'Explorer'), 24);
  insert into public.visitors (explorer_id, user_id, email, display_name)
  values (uid::text, uid, mail, final)
  on conflict (explorer_id) do update set display_name = excluded.display_name, last_seen_at = now();
  return final;
end;
$$;
revoke all on function public.set_display_name(text) from public;
revoke all on function public.set_display_name(text) from anon;
grant execute on function public.set_display_name(text) to authenticated;

notify pgrst, 'reload schema';
