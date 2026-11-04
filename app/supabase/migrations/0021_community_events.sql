-- 0021: "What's Happening" — community events, prayer and service (Nov 2026).
-- Leaders post; members see everything; the public site sees only items not
-- marked members-only. Times are kept in the item's own time zone.

do $$ begin
  create type event_kind as enum ('event', 'prayer', 'service');
exception when duplicate_object then null; end $$;

create table if not exists community_events (
  id           uuid primary key default gen_random_uuid(),
  kind         event_kind not null default 'event',
  title        text not null check (char_length(title) between 1 and 120),
  body         text check (char_length(body) <= 2000),
  starts_at    timestamptz,
  ends_at      timestamptz,
  timezone     text not null default 'America/Los_Angeles',
  location     text check (char_length(location) <= 200),
  link         text check (link is null or (link ~* '^https://[^\s]+$' and char_length(link) <= 500)),
  members_only boolean not null default false,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (ends_at is null or (starts_at is not null and ends_at >= starts_at))
);
create index if not exists community_events_starts on community_events (starts_at);
alter table community_events enable row level security;

grant select on community_events to anon, authenticated;
grant insert, update, delete on community_events to authenticated;
drop policy if exists ce_read_public on community_events;
create policy ce_read_public on community_events for select to anon using (not members_only);
drop policy if exists ce_read on community_events;
create policy ce_read on community_events for select to authenticated using (not members_only or app.is_active());
drop policy if exists ce_insert on community_events;
create policy ce_insert on community_events for insert to authenticated with check (app.is_leader() and created_by = auth.uid());
drop policy if exists ce_update on community_events;
create policy ce_update on community_events for update to authenticated using (app.is_leader()) with check (app.is_leader());
drop policy if exists ce_delete on community_events;
create policy ce_delete on community_events for delete to authenticated using (app.is_leader());
