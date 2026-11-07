-- Event media wall ─ photos + short videos shared live from phones.
-- Run once in the Supabase SQL editor (or through the management API).
-- The bucket is public-read so the presenter board can show files without
-- signed links; phones never render the media wall.

-- 1 · storage bucket -------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media',
  'event-media',
  true,
  52428800, -- 50 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2 · metadata table -------------------------------------------------------
create table if not exists public.event_media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null unique,
  author text not null default 'Guest',
  caption text not null default '',
  width integer,
  height integer,
  hidden boolean not null default false
);

create index if not exists event_media_created_idx
  on public.event_media (created_at desc);

alter table public.event_media enable row level security;

drop policy if exists "read event media" on public.event_media;
create policy "read event media" on public.event_media
  for select to anon using (true);

drop policy if exists "write event media" on public.event_media;
create policy "write event media" on public.event_media
  for insert to anon with check (true);

drop policy if exists "update event media" on public.event_media;
create policy "update event media" on public.event_media
  for update to anon using (true) with check (true);

drop policy if exists "delete event media" on public.event_media;
create policy "delete event media" on public.event_media
  for delete to anon using (true);

grant select, insert, update, delete on public.event_media to anon;

-- 3 · storage object policies ---------------------------------------------
drop policy if exists "event media uploads" on storage.objects;
create policy "event media uploads" on storage.objects
  for insert to anon
  with check (bucket_id = 'event-media');

drop policy if exists "event media reads" on storage.objects;
create policy "event media reads" on storage.objects
  for select to anon
  using (bucket_id = 'event-media');

drop policy if exists "event media deletes" on storage.objects;
create policy "event media deletes" on storage.objects
  for delete to anon
  using (bucket_id = 'event-media');

-- 4 · realtime -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_media'
  ) then
    alter publication supabase_realtime add table public.event_media;
  end if;
end $$;
