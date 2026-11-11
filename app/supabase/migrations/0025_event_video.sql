-- 0025: Videos on What's Happening items (Nov 2026).
-- A leader can attach a video to an item — "Tuesday meeting highlights" —
-- either uploaded (private bucket; viewers get a short-lived link only if they
-- can see the item) or as a YouTube / Vimeo link shown in the page.

alter table community_events add column if not exists video_path text
  check (video_path is null or video_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$');
alter table community_events add column if not exists video_url text
  check (video_url is null or (char_length(video_url) <= 300 and video_url ~* '^https://(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com|vimeo\.com|player\.vimeo\.com)/'));

-- Private bucket. The project's own upload limit applies too (50 MB on Supabase's free plan).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('community-video', 'community-video', false, 500 * 1024 * 1024, array['video/mp4', 'video/quicktime', 'video/webm'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Path {item id}/{file}; leaders upload and remove.
drop policy if exists event_video_insert on storage.objects;
create policy event_video_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'community-video' and app.is_leader()
              and array_length(storage.foldername(name), 1) = 1
              and exists (select 1 from community_events e where e.id::text = (storage.foldername(objects.name))[1]));
drop policy if exists event_video_delete on storage.objects;
create policy event_video_delete on storage.objects for delete to authenticated
  using (bucket_id = 'community-video' and app.is_leader());
-- Watching: anyone who can see the item it's attached to (visitors: public items only).
drop policy if exists event_video_read on storage.objects;
create policy event_video_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'community-video' and (
    app.is_leader()
    or exists (select 1 from community_events e where e.video_path = objects.name
               and (not e.members_only or app.is_active()))));
