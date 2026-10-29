-- KHOJ v12 migration — run ONCE in the Supabase SQL editor (after v11). Safe to re-run.
-- Wording only: teachers sign in as well, so the sign-in messages no longer say "student".

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
    raise exception 'This email is not on the KHOJ access list.';
  end if;
  -- Test IDs have no real inbox, so they are confirmed automatically.
  if mail like '%@khoj.test' then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end;
$$;

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
    raise exception 'Please enter your full name.';
  end if;
  select email into mail from auth.users where id = uid;
  insert into public.visitors (explorer_id, user_id, email, display_name, full_name)
  values (uid::text, uid, mail, left(coalesce(split_part(mail, '@', 1), 'Explorer'), 24), final)
  on conflict (explorer_id) do update set full_name = excluded.full_name, last_seen_at = now();
  return final;
end;
$$;

notify pgrst, 'reload schema';
