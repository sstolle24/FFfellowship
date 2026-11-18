-- 0029: Pictures on What's Happening items (Nov 2026).
-- A leader can attach one picture (flyer, photo) to an item, uploaded like the
-- video (0025): private bucket, and viewers get a short-lived link only if they
-- can see the item.

alter table community_events add column if not exists image_path text
  check (image_path is null or image_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('community-image', 'community-image', false, 10 * 1024 * 1024,
          array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Path {item id}/{file}; leaders upload and remove.
drop policy if exists event_image_insert on storage.objects;
create policy event_image_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'community-image' and app.is_leader()
              and array_length(storage.foldername(name), 1) = 1
              and exists (select 1 from community_events e where e.id::text = (storage.foldername(objects.name))[1]));
drop policy if exists event_image_delete on storage.objects;
create policy event_image_delete on storage.objects for delete to authenticated
  using (bucket_id = 'community-image' and app.is_leader());
-- Viewing: anyone who can see the item it's on (visitors: public items only).
drop policy if exists event_image_read on storage.objects;
create policy event_image_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'community-image' and (
    app.is_leader()
    or exists (select 1 from community_events e where e.image_path = objects.name
               and (not e.members_only or app.is_active()))));
