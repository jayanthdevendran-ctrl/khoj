-- KHOJ v15 migration — run ONCE in the Supabase SQL editor (after v14). Safe to re-run.
--
-- Lets a signed-in ADMIN set a new password for any non-admin account from the admin page
-- (Admin dashboard -> Passwords). Admins change their OWN password from the same tab, which does not need this file.
--
-- Safeguards:
--   * only people listed in admin_users can call it
--   * it refuses to change another admin's password
--   * the person is signed out of their other sessions, so the old password stops working everywhere

create or replace function public.admin_set_password(p_email text, p_password text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  mail   text := lower(trim(coalesce(p_email, '')));
  target uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users where id = auth.uid()) then
    raise exception 'Only KHOJ admins can reset passwords.' using errcode = '42501';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Choose a password of at least 8 characters.';
  end if;

  select id into target from auth.users where lower(email) = mail limit 1;
  if target is null then
    raise exception 'No account found for %.', mail;
  end if;
  if exists (select 1 from public.admin_users where id = target) and target <> auth.uid() then
    raise exception 'Admin passwords can only be changed by that admin (Passwords tab -> Change my own password).';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = target;

  -- End the person's other sessions (not the admin's own).
  if target <> auth.uid() then
    delete from auth.sessions where user_id = target;
  end if;

  return mail;
end;
$$;

revoke all on function public.admin_set_password(text, text) from public;
revoke all on function public.admin_set_password(text, text) from anon;
grant execute on function public.admin_set_password(text, text) to authenticated;

notify pgrst, 'reload schema';
