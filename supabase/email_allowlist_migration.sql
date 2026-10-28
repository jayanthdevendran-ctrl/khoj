-- KHOJ student email allow-list and secure email/password registration.
-- Run this migration as a Supabase project owner before enabling student access.

create table if not exists public.student_email_allowlist (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint student_email_allowlist_email_lowercase check (email = lower(trim(email)))
);

alter table public.student_email_allowlist enable row level security;

-- Signed-in students may verify only their own email's presence.
drop policy if exists "students verify own allowlist email" on public.student_email_allowlist;
create policy "students verify own allowlist email" on public.student_email_allowlist
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Admins can manage the uploaded list. RLS is the actual security boundary.
drop policy if exists "admins manage student email allowlist" on public.student_email_allowlist;
create policy "admins manage student email allowlist" on public.student_email_allowlist
  for all to authenticated
  using (exists (select 1 from public.admin_users a where a.id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.id = auth.uid()));

grant select on public.student_email_allowlist to authenticated;
grant insert, update, delete on public.student_email_allowlist to authenticated;

-- Prevent non-approved addresses from creating Supabase Auth accounts.
-- This check runs before the client-side allow-list check, which is only UX.
create or replace function public.reject_unapproved_student_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or not exists (
    select 1 from public.student_email_allowlist l
    where l.email = lower(trim(new.email))
  ) then
    raise exception 'This email is not on the KHOJ student access list.';
  end if;
  return new;
end;
$$;

drop trigger if exists khoj_student_email_allowlist_guard on auth.users;
create trigger khoj_student_email_allowlist_guard
  before insert on auth.users
  for each row execute function public.reject_unapproved_student_signup();

-- Avoid recursive RLS checks on admin_users when testing administrator access.
create or replace function public.is_khoj_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where id = auth.uid());
$$;

drop policy if exists "admins read admin_users" on public.admin_users;
create policy "admins read admin_users" on public.admin_users
  for select to authenticated using (public.is_khoj_admin());

drop policy if exists "admins manage student email allowlist" on public.student_email_allowlist;
create policy "admins manage student email allowlist" on public.student_email_allowlist
  for all to authenticated
  using (public.is_khoj_admin())
  with check (public.is_khoj_admin());
