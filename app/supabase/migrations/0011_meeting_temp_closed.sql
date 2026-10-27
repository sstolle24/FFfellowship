-- 0011: Temporarily closed meetings (Oct 2026).
-- A meeting can be paused without hiding it: it stays on the schedule marked
-- "Temporarily closed" (with an optional note such as "Back in January"), shows
-- no Join button, and join_meeting refuses it. Unticking the box reopens it.
-- "Active" off still removes a meeting from every schedule (closed for good).

alter table meetings add column if not exists temp_closed boolean not null default false;
alter table meetings add column if not exists closed_note text;

-- New columns go on the end so the view keeps its grants (0005: SELECT only).
create or replace view meetings_public as
  select id, name, day_of_week, start_time_utc, tagline, beginner, temp_closed, closed_note
  from meetings where active;

create or replace function public.join_meeting(p_meeting uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m meetings;
begin
  if not app.can_see_links() then perform app.fail('Sign in to get meeting links.'); end if;
  select * into m from meetings where id = p_meeting and active;
  if m.id is null then perform app.fail('Meeting not found.'); end if;
  if m.temp_closed then perform app.fail('This meeting is temporarily closed.'); end if;
  insert into meeting_link_joins (man_id, meeting_id) values (auth.uid(), p_meeting);
  return jsonb_build_object('ok', true, 'zoom_url', m.zoom_url, 'zoom_id', m.zoom_id, 'zoom_password', m.zoom_password);
end $$;
