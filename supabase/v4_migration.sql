-- KHOJ v4 migration — run ONCE in the Supabase SQL editor (after v2 / v3). Safe to re-run.
--
--  1. clear_khoj_data(): lets a signed-in admin wipe records from the admin dashboard
--     ("Clear records"). The visitor tables have no admin delete policies, so a plain
--     DELETE from the browser would silently remove nothing — this function does the
--     work with the owner's rights, but refuses anyone who is not in admin_users.
--  2. Lets admins delete uploaded logo / floor plan image files from storage.
--  3. explorer_ranking: public Explorer Award leaderboard (Explorer ID + badge count only;
--     no names, so nothing personal is exposed).

-- ── 1. Clear records ───────────────────────────────────────────────────────
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

  -- Awards are tied to projects, so clearing projects clears them too.
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
revoke all on function public.clear_khoj_data(text[]) from anon;
grant execute on function public.clear_khoj_data(text[]) to authenticated;

-- ── 2. Admins may delete uploaded images (logos, floor plans) ──────────────
drop policy if exists "admins delete floorplan bucket files" on storage.objects;
create policy "admins delete floorplan bucket files"
  on storage.objects for delete
  using (bucket_id = 'floorplans' and auth.uid() in (select id from public.admin_users));

drop policy if exists "admins delete floorplans" on public.floorplans;
create policy "admins delete floorplans" on public.floorplans for delete
  using (auth.uid() in (select id from public.admin_users));

-- ── 3. Public Explorer Award leaderboard (IDs + counts only) ───────────────
-- Runs with the view owner's rights on purpose (like project_stats), so visitors can see
-- the ranking without being able to read individual rows. Names are NOT exposed.
create or replace view public.explorer_ranking as
select b.explorer_id,
       count(distinct b.project_id) as badges
from public.badge_logs b
group by b.explorer_id
order by badges desc
limit 50;
grant select on public.explorer_ranking to anon, authenticated;

-- Make the new function/view visible to the API immediately.
notify pgrst, 'reload schema';
