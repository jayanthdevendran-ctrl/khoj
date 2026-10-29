-- Run this in the Supabase SQL editor AFTER supabase/schema.sql.
-- Adds a table to track the uploaded floorplan image per floor, and a
-- public storage bucket to hold the image files.

create table if not exists floorplans (
  floor int primary key,
  image_url text not null,
  updated_at timestamptz not null default now()
);

alter table floorplans enable row level security;

-- Anyone (anon visitors) can read floorplans — they're public campus maps.
create policy "floorplans are publicly readable"
  on floorplans for select
  using (true);

-- Only admins can write. Assumes an `admin_users` table already exists from
-- supabase/schema.sql, keyed by auth.uid().
create policy "only admins can upsert floorplans"
  on floorplans for insert
  with check (auth.uid() in (select id from admin_users));

create policy "only admins can update floorplans"
  on floorplans for update
  using (auth.uid() in (select id from admin_users));

-- Storage bucket for the actual image files. Create it here (rather than
-- only in the dashboard) so it's reproducible from this migration.
insert into storage.buckets (id, name, public)
values ('floorplans', 'floorplans', true)
on conflict (id) do nothing;

create policy "floorplan images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'floorplans');

create policy "only admins can upload floorplan images"
  on storage.objects for insert
  with check (
    bucket_id = 'floorplans'
    and auth.uid() in (select id from admin_users)
  );

create policy "only admins can overwrite floorplan images"
  on storage.objects for update
  using (
    bucket_id = 'floorplans'
    and auth.uid() in (select id from admin_users)
  );
