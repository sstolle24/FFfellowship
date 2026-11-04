-- 0020: Artwork on meetings (Nov 2026).
-- Leaders upload one image per meeting (JPG/PNG/WebP, up to 5 MB). It is
-- public, like the schedule itself: shown on the public and member schedules.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('meeting-art', 'meeting-art', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

-- Path {meeting id}/{file}. Leaders only; reads are public (the bucket is public).
drop policy if exists meeting_art_insert on storage.objects;
create policy meeting_art_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'meeting-art' and app.is_leader()
              and array_length(storage.foldername(name), 1) = 1
              -- objects.name: inside the subquery a bare "name" would be the meeting's name.
              and exists (select 1 from meetings m where m.id::text = (storage.foldername(objects.name))[1]));
drop policy if exists meeting_art_delete on storage.objects;
create policy meeting_art_delete on storage.objects for delete to authenticated
  using (bucket_id = 'meeting-art' and app.is_leader());
drop policy if exists meeting_art_read on storage.objects;
create policy meeting_art_read on storage.objects for select to authenticated
  using (bucket_id = 'meeting-art' and app.is_leader());

alter table meetings add column if not exists art_path text
  check (art_path is null or art_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$');

-- New column on the end so the view keeps its grants (0005: SELECT only).
create or replace view meetings_public as
  select id, name, day_of_week, start_time_utc, tagline, beginner, temp_closed, closed_note,
         timezone, local_day, local_time, art_path
  from meetings where active;
