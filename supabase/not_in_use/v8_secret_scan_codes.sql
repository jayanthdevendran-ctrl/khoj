-- NOT IN USE. Secret-code QR scanning (optional, for later). Running this makes ratings and badges
-- require a secret-code scan and breaks the simple ?scan=1 QR codes. Do not run unless you switch back.

-- KHOJ v8 migration — run ONCE in the Supabase SQL editor (after v4–v7). Safe to re-run.
--
-- Rating a project and adding it to the passport now REQUIRE having scanned that project's QR code.
-- Each project's QR contains a secret code worked out from a private server-side secret. The server
-- checks the code (claim_scan) and only then records a "scan"; the database refuses ratings and
-- badges for any project the account has not scanned — a typed link or edited app cannot bypass it.

-- ── 1. Private secret + code calculation (never readable from the website) ──
create table if not exists public.scan_secret (
  id     int primary key default 1 check (id = 1),
  secret text not null
);
insert into public.scan_secret (id, secret)
values (1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;
alter table public.scan_secret enable row level security;      -- no policies: not reachable through the API
revoke all on public.scan_secret from anon, authenticated;

create or replace function public.scan_code_for(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select left(encode(sha256(convert_to(p_slug || ':' || (select secret from public.scan_secret where id = 1), 'UTF8')), 'hex'), 12);
$$;
revoke all on function public.scan_code_for(text) from public, anon, authenticated;

-- ── 2. Which projects each account has scanned ─────────────────────────────
create table if not exists public.scan_claims (
  explorer_id text not null,
  project_id  text not null,
  claimed_at  timestamptz not null default now(),
  primary key (explorer_id, project_id)
);
alter table public.scan_claims enable row level security;
drop policy if exists "students read own scans" on public.scan_claims;
drop policy if exists "admins read all scans"   on public.scan_claims;
create policy "students read own scans" on public.scan_claims for select to authenticated using (explorer_id = auth.uid()::text);
create policy "admins read all scans"   on public.scan_claims for select to authenticated using (exists (select 1 from public.admin_users a where a.id = auth.uid()));
-- (no insert policy: rows can only be created by claim_scan below)

create or replace function public.claim_scan(p_project_id text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s   text;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select slug into s from public.projects where id::text = p_project_id and active;
  if s is null or p_code is null or p_code <> public.scan_code_for(s) then
    return false;
  end if;
  insert into public.scan_claims (explorer_id, project_id) values (uid::text, p_project_id) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.claim_scan(text, text) from public, anon;
grant execute on function public.claim_scan(text, text) to authenticated;

-- ── 3. Admins fetch the codes to print on QR sheets ───────────────────────
create or replace function public.admin_scan_codes()
returns table (project_id text, slug text, code text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users where id = auth.uid()) then
    raise exception 'Only KHOJ admins can read scan codes.' using errcode = '42501';
  end if;
  return query select p.id::text, p.slug, public.scan_code_for(p.slug) from public.projects p;
end;
$$;
revoke all on function public.admin_scan_codes() from public, anon;
grant execute on function public.admin_scan_codes() to authenticated;

-- ── 4. Ratings and badges are only accepted for scanned projects ──────────
drop policy if exists "students log own badge"  on public.badge_logs;
drop policy if exists "students log own rating" on public.rating_logs;
create policy "students log own badge" on public.badge_logs for insert to authenticated
  with check (
    explorer_id = auth.uid()::text
    and exists (select 1 from public.scan_claims c where c.explorer_id = auth.uid()::text and c.project_id = badge_logs.project_id)
  );
create policy "students log own rating" on public.rating_logs for insert to authenticated
  with check (
    explorer_id = auth.uid()::text
    and exists (select 1 from public.scan_claims c where c.explorer_id = auth.uid()::text and c.project_id = rating_logs.project_id)
  );

-- ── 5. "Clear records" also forgets scans (students must scan again) ──────
create or replace function public.clear_khoj_data(p_scopes text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb := '{}'::jsonb;
  n bigint;
  scopes text[] := coalesce(p_scopes, '{}');
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users where id = auth.uid()) then
    raise exception 'Only KHOJ admins can clear records.' using errcode = '42501';
  end if;

  if 'projects' = any(scopes) and not ('awards' = any(scopes)) then
    scopes := scopes || array['awards'];
  end if;

  if 'awards' = any(scopes) then
    delete from public.rating_logs where true;  get diagnostics n = row_count; result := result || jsonb_build_object('ratings', n);
    delete from public.badge_logs where true;   get diagnostics n = row_count; result := result || jsonb_build_object('badges', n);
    delete from public.scan_claims where true;  get diagnostics n = row_count; result := result || jsonb_build_object('scans', n);
    delete from public.visitors where true;     get diagnostics n = row_count; result := result || jsonb_build_object('visitors', n);
  end if;

  if 'projects' = any(scopes) then
    delete from public.projects where true;     get diagnostics n = row_count; result := result || jsonb_build_object('projects', n);
    delete from public.teams where true;        get diagnostics n = row_count; result := result || jsonb_build_object('teams', n);
  end if;

  if 'rooms' = any(scopes) then
    update public.projects set location_id = null where location_id is not null;
    delete from public.points_of_interest where true; get diagnostics n = row_count; result := result || jsonb_build_object('markers', n);
    delete from public.locations where true;          get diagnostics n = row_count; result := result || jsonb_build_object('rooms', n);
  end if;

  if 'subjects' = any(scopes) then
    update public.projects set category_id = null where category_id is not null;
    delete from public.categories where true;   get diagnostics n = row_count; result := result || jsonb_build_object('subjects', n);
  end if;

  if 'floorplans' = any(scopes) then
    delete from public.floorplans where true;   get diagnostics n = row_count; result := result || jsonb_build_object('floorplans', n);
  end if;

  if 'emails' = any(scopes) then
    delete from public.student_email_allowlist where true; get diagnostics n = row_count; result := result || jsonb_build_object('emails', n);
  end if;

  return result;
end;
$$;
grant execute on function public.clear_khoj_data(text[]) to authenticated, service_role;

notify pgrst, 'reload schema';
