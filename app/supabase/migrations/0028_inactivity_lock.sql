-- 0028: Inactivity lock (Nov 2026).
-- A man working his keys who hasn't been on the site for 14 days is locked out
-- and has to contact a leader. Depending on the reason, a leader can suspend
-- him from the program for 6 months instead of unlocking him.
--   * "Activity" is the same as the existing 3- and 7-day nudges: any visit to
--     the member or leader area (profiles.last_active_at, touch_activity).
--   * Only men with work of their own waiting: an open or returned item, or an
--     open video not yet checked off. A man whose own work is all done and who
--     is only waiting on AP / leader sign-offs is never locked, nor anyone at
--     certification review or past it, nor leaders and admins.
--   * The 14 days count from when this rule went in, so nobody is locked the
--     day it goes live for quiet time before it existed.
--   * Locked: he can sign in and see a "locked" screen (and still get meeting
--     links), but app.is_active() is false, so no program work goes through.
--     His AP/sponsor relationships are kept.
--   * Unlocking resets his activity clock. A suspension keeps him locked until
--     a leader unlocks him (normally after the end date); leaders can lift it
--     early. Suspension reasons go in the audit log (leaders only).

alter table profiles add column if not exists locked_at timestamptz;
alter table profiles add column if not exists lock_reason text check (lock_reason in ('inactivity', 'suspended'));
alter table profiles add column if not exists suspended_until date;
alter table profiles add column if not exists unlock_requested_at timestamptz;

insert into app_settings values ('inactivity_lock_days', '14') on conflict (key) do nothing;
insert into app_settings values ('inactivity_lock_since', to_jsonb(now())) on conflict (key) do nothing;

-- Locked men are not "active" for anything that checks it (all program work).
create or replace function app.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and status = 'active' and deleted_at is null and locked_at is null)
$$;

-- Does he have program work of his own waiting (not just sign-offs from others)?
create or replace function app.has_own_work(p_man uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from step_progress where man_id = p_man and status in ('open', 'returned'))
      or exists (select 1 from videos v
                  where app.video_unlocked(p_man, v.id)
                    and not exists (select 1 from video_progress vp
                                     where vp.video_id = v.id and vp.man_id = p_man and vp.watched_at is not null))
$$;

-- Men the rule applies to right now, with when their quiet time started.
create or replace function public.inactivity_subjects()
returns table (id uuid, first_name text, primary_leader_id uuid, quiet_since timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.primary_leader_id,
         greatest(p.last_active_at, coalesce((select (value #>> '{}')::timestamptz from app_settings where key = 'inactivity_lock_since'), now()))
    from profiles p
   where p.status = 'active' and p.deleted_at is null and p.locked_at is null
     and p.role not in ('leader', 'admin')
     and p.stage in ('module_0', 'key_1', 'key_2', 'key_3')
     and app.has_own_work(p.id)
$$;

-- Daily job: lock everyone quiet for the set number of days. Returns who was locked.
create or replace function public.lock_inactive_members()
returns table (id uuid, first_name text, primary_leader_id uuid)
language plpgsql security definer set search_path = public as $$
declare days int := coalesce((select (value #>> '{}')::int from app_settings where key = 'inactivity_lock_days'), 14);
begin
  for id, first_name, primary_leader_id in
    select s.id, s.first_name, s.primary_leader_id from public.inactivity_subjects() s
     where s.quiet_since < now() - make_interval(days => days)
  loop
    update profiles p set locked_at = now(), lock_reason = 'inactivity', unlock_requested_at = null where p.id = lock_inactive_members.id;
    insert into audit_log (actor_id, action, target_table, target_id, detail)
    values (null, 'locked_inactive', 'profiles', lock_inactive_members.id, jsonb_build_object('days', days));
    return next;
  end loop;
end $$;

-- He asks the leaders to unlock him (once a day).
create or replace function public.request_unlock(p_message text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  select * into p from profiles where id = auth.uid() and deleted_at is null;
  if p.id is null or p.locked_at is null then perform app.fail('Your account isn''t locked.'); end if;
  if p.unlock_requested_at > now() - interval '1 day' then
    perform app.fail('Your request was sent. A leader will be in touch; you can ask again tomorrow.');
  end if;
  update profiles set unlock_requested_at = now() where id = p.id;
  perform app.audit('unlock_requested', 'profiles', p.id, null);
  return jsonb_build_object('ok', true, 'events', jsonb_build_array(jsonb_build_object(
    'type', 'unlock_requested', 'man_id', p.id, 'note', left(nullif(trim(coalesce(p_message, '')), ''), 1000),
    'suspended_until', p.suspended_until)));
end $$;

create or replace function public.leader_unlock_member(p_man uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  select * into p from profiles where id = p_man and deleted_at is null;
  if p.id is null then perform app.fail('Member not found.'); end if;
  if p.locked_at is null then perform app.fail('His account isn''t locked.'); end if;
  update profiles set locked_at = null, lock_reason = null, suspended_until = null, unlock_requested_at = null,
                      last_active_at = now()
   where id = p_man;
  perform app.audit('unlocked', 'profiles', p_man,
    jsonb_build_object('was', p.lock_reason, 'suspended_until', p.suspended_until));
  return jsonb_build_object('ok', true, 'events', jsonb_build_array(jsonb_build_object('type', 'account_unlocked', 'man_id', p_man)));
end $$;

create or replace function public.leader_suspend_member(p_man uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p profiles; until date := (current_date + interval '6 months')::date;
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  if coalesce(trim(p_reason), '') = '' then perform app.fail('Give the reason for the suspension.'); end if;
  select * into p from profiles where id = p_man and deleted_at is null;
  if p.id is null then perform app.fail('Member not found.'); end if;
  if p.locked_at is null then perform app.fail('Only a locked account can be suspended.'); end if;
  if p_man = auth.uid() then perform app.fail('You can''t suspend yourself.'); end if;
  update profiles set lock_reason = 'suspended', suspended_until = until, unlock_requested_at = null where id = p_man;
  perform app.audit('suspended', 'profiles', p_man, jsonb_build_object('until', until, 'reason', left(trim(p_reason), 1000)));
  return jsonb_build_object('ok', true, 'until', until,
    'events', jsonb_build_array(jsonb_build_object('type', 'account_suspended', 'man_id', p_man, 'until', until)));
end $$;

revoke all on function public.inactivity_subjects(), public.lock_inactive_members() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.inactivity_subjects(), public.lock_inactive_members() to service_role;
  end if;
end $$;
revoke all on function public.request_unlock(text), public.leader_unlock_member(uuid), public.leader_suspend_member(uuid, text) from public, anon;
grant execute on function public.request_unlock(text), public.leader_unlock_member(uuid), public.leader_suspend_member(uuid, text) to authenticated;
revoke execute on function app.has_own_work(uuid) from public, anon;
