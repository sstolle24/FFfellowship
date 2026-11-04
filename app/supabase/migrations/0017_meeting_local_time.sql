-- 0017: Meetings keep their own local time across daylight saving (Nov 2026).
-- Meetings were stored as a UTC weekday + time, so a 5 pm Pacific meeting
-- showed as 4 pm once clocks fell back. Each meeting now has its own time zone,
-- weekday and local time ("Sunday 17:00 America/Los_Angeles"); the app works out
-- each week's real time from those, so it stays 5 pm Pacific all year and shows
-- correctly in every member's own time zone.
-- day_of_week / start_time_utc stay, kept in step by the trigger below (for the
-- current week), so nothing that still reads them breaks.

alter table meetings add column if not exists timezone text not null default 'America/Los_Angeles';
alter table meetings add column if not exists local_day int check (local_day between 0 and 6);
alter table meetings add column if not exists local_time time;

-- Existing meetings were entered as Pacific times while clocks were on daylight
-- time (before Nov 1). The Singapore meeting keeps Singapore time.
update meetings set timezone = 'Asia/Singapore' where name ilike '%singapore%' and local_day is null;
update meetings set
  local_day  = extract(dow from ((date '2026-10-04' + day_of_week + start_time_utc) at time zone 'UTC') at time zone timezone)::int,
  local_time = (((date '2026-10-04' + day_of_week + start_time_utc) at time zone 'UTC') at time zone timezone)::time
 where local_day is null;

-- Keeps the two in step: local fields are the truth; UTC fields follow for the
-- current week. A save that only gives UTC fields (an older copy of the site)
-- still works: the local fields are worked out from them.
create or replace function app.meeting_times() returns trigger
language plpgsql as $$
declare at timestamptz;
begin
  perform now() at time zone new.timezone;   -- rejects an unknown time zone
  if new.local_day is null or new.local_time is null
     or (tg_op = 'UPDATE' and new.local_day is not distinct from old.local_day
         and new.local_time is not distinct from old.local_time and new.timezone is not distinct from old.timezone
         and (new.day_of_week is distinct from old.day_of_week or new.start_time_utc is distinct from old.start_time_utc)) then
    -- An older copy of the site saved this week's real time in UTC.
    at := ((date_trunc('week', now() at time zone 'UTC'))::date - 1 + new.day_of_week + new.start_time_utc) at time zone 'UTC';
    new.local_day := extract(dow from at at time zone new.timezone)::int;
    new.local_time := (at at time zone new.timezone)::time;
  end if;
  at := ((date_trunc('week', now() at time zone new.timezone))::date - 1 + new.local_day + new.local_time) at time zone new.timezone;
  new.day_of_week := extract(dow from at at time zone 'UTC')::int;
  new.start_time_utc := (at at time zone 'UTC')::time;
  return new;
end $$;
drop trigger if exists meeting_times on meetings;
create trigger meeting_times before insert or update on meetings
  for each row execute function app.meeting_times();
revoke execute on function app.meeting_times() from public, anon, authenticated;

-- Refresh the UTC fields for this week's offset (so even a not-yet-redeployed site shows 5 pm).
update meetings set local_day = local_day;

alter table meetings alter column local_day set not null;
alter table meetings alter column local_time set not null;

-- New columns go on the end so the view keeps its grants (0005: SELECT only).
create or replace view meetings_public as
  select id, name, day_of_week, start_time_utc, tagline, beginner, temp_closed, closed_note,
         timezone, local_day, local_time
  from meetings where active;
