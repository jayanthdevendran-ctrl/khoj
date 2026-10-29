-- KHOJ v9 migration — run ONCE in the Supabase SQL editor (after v1–v7; safe to re-run, and safe whether or not v8 was run).
--
-- Back to the simple QR check: a project is "scanned" when it is opened from its QR link (?scan=1).
-- This restores the plain rule that a signed-in student may add their OWN rating / badge, and removes the
-- v8 requirement that a secret-code scan record exists. (v8's extra tables and functions are left in place
-- but unused, so they can be switched on again later.)

drop policy if exists "students log own badge"  on public.badge_logs;
drop policy if exists "students log own rating" on public.rating_logs;
create policy "students log own badge"  on public.badge_logs  for insert to authenticated with check (explorer_id = auth.uid()::text);
create policy "students log own rating" on public.rating_logs for insert to authenticated with check (explorer_id = auth.uid()::text);

-- "Clear records" without the v8 scan table.
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

revoke all on function public.clear_khoj_data(text[]) from public;
grant execute on function public.clear_khoj_data(text[]) to authenticated, service_role;

notify pgrst, 'reload schema';
