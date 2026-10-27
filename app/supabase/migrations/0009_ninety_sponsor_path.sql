-- 0009: Steven's feedback (Oct 2026).
--   * 90 in 90: a man sets his own 90-in-90 start date (up to 90 days back), so
--     meetings he attended before joining the app count. Meetings logged more
--     than 3 days after they happened are shown as "added later" (app side,
--     from meeting_logs.created_at). No future dates.
--   * Meeting "Notes / takeaways": logging a meeting can save a journal entry
--     linked to it (journal_entries.meeting_log_id). The Journal page stays.
--   * Outside sponsors: a man records a sponsor who isn't in Finally Free; it
--     counts once a leader approves it (an exception).
--   * "The Path": once Key 1 is done, each week (Monday–Sunday, his timezone)
--     he must name his 3 men and commit them before using the member area.

-- ───────────────────────── 90 in 90 ─────────────────────────
alter table profiles add column if not exists ninety_start_date date;

-- His local "today".
create or replace function app.today_for(p_man uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from profiles where id = p_man), 'UTC'))::date
$$;

create or replace function public.set_ninety_start(p_date date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare today date;
begin
  if auth.uid() is null or not app.is_active() then perform app.fail('Your account must be approved first.'); end if;
  today := app.today_for(auth.uid());
  if p_date is null then perform app.fail('Pick the date you started your 90 in 90.'); end if;
  if p_date > today then perform app.fail('Your start date can''t be in the future.'); end if;
  if p_date < today - 90 then perform app.fail('Your start date can be at most 90 days back.'); end if;
  update profiles set ninety_start_date = p_date where id = auth.uid();
  perform app.audit('ninety_start_set', 'profiles', auth.uid(), jsonb_build_object('date', p_date));
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

-- No meetings in the future (a day of slack for timezones).
create or replace function app.guard_meeting_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.date > app.today_for(new.man_id) + 1 then perform app.fail('That date is in the future.'); end if;
  return new;
end $$;
drop trigger if exists meeting_log_guard on meeting_logs;
create trigger meeting_log_guard before insert or update on meeting_logs
  for each row execute function app.guard_meeting_log();

alter table journal_entries add column if not exists meeting_log_id uuid references meeting_logs(id) on delete set null;

-- Log a meeting, optionally with its Notes / takeaways (saved as a journal entry).
create or replace function public.log_meeting(p_date date, p_meeting uuid, p_other text, p_location text,
  p_counts boolean, p_takeaway text, p_insight text, p_share boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lid uuid; jid uuid;
begin
  if auth.uid() is null or not app.is_active() then perform app.fail('Your account must be approved first.'); end if;
  if p_date is null then perform app.fail('Pick the date of the meeting.'); end if;
  if p_meeting is null and coalesce(trim(p_other), '') = '' then
    perform app.fail('Pick a Finally Free meeting or name the SA meeting.');
  end if;
  if p_meeting is not null and not exists (select 1 from meetings where id = p_meeting) then
    perform app.fail('Meeting not found.');
  end if;
  insert into meeting_logs (man_id, date, meeting_id, other_name, location, counts_90)
    values (auth.uid(), p_date, p_meeting, left(nullif(trim(p_other), ''), 120), left(nullif(trim(p_location), ''), 120),
            coalesce(p_counts, true))
    returning id into lid;
  if coalesce(trim(p_takeaway), '') <> '' then
    insert into journal_entries (man_id, meeting_id, meeting_log_id, body, key_insight, shared_with_mentors)
      values (auth.uid(), p_meeting, lid, left(trim(p_takeaway), 20000), left(nullif(trim(p_insight), ''), 500), coalesce(p_share, false))
      returning id into jid;
  end if;
  return jsonb_build_object('ok', true, 'id', lid, 'journal_id', jid, 'events', '[]'::jsonb);
end $$;

-- ───────────────────────── outside sponsors ─────────────────────────
create table if not exists outside_sponsors (
  id          uuid primary key default gen_random_uuid(),
  man_id      uuid not null references profiles(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  notes       text,
  status      text not null default 'pending' check (status in ('pending','approved','declined','ended')),
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now()
);
create unique index if not exists outside_sponsors_one_open on outside_sponsors (man_id) where status in ('pending','approved');
alter table outside_sponsors enable row level security;
-- Third-party contact details: him and leaders only. Writes only through the functions below.
grant select on outside_sponsors to authenticated;
drop policy if exists os_read on outside_sponsors;
create policy os_read on outside_sponsors for select to authenticated
  using (man_id = auth.uid() or app.is_leader());

create or replace function public.submit_outside_sponsor(p_name text, p_phone text, p_email text, p_notes text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if auth.uid() is null or not app.is_active() then perform app.fail('Your account must be approved first.'); end if;
  if coalesce(trim(p_name), '') = '' then perform app.fail('Enter your sponsor''s name.'); end if;
  if exists (select 1 from outside_sponsors where man_id = auth.uid() and status in ('pending','approved')) then
    perform app.fail('You already have an outside sponsor on file. Remove it first to enter a different one.');
  end if;
  insert into outside_sponsors (man_id, name, phone, email, notes)
    values (auth.uid(), left(trim(p_name), 80), left(nullif(trim(p_phone), ''), 30), left(nullif(trim(p_email), ''), 120),
            left(nullif(trim(p_notes), ''), 1000))
    returning id into oid;
  perform app.audit('outside_sponsor_submitted', 'outside_sponsors', oid, null);
  return jsonb_build_object('ok', true, 'id', oid, 'events', jsonb_build_array(
    jsonb_build_object('type','outside_sponsor_submitted','man_id',auth.uid())));
end $$;

create or replace function public.review_outside_sponsor(p_id uuid, p_approve boolean, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o outside_sponsors;
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  select * into o from outside_sponsors where id = p_id;
  if o.id is null or o.status <> 'pending' then perform app.fail('Nothing waiting for review.'); end if;
  if o.man_id = auth.uid() then perform app.fail('Another leader must approve your own sponsor.'); end if;
  update outside_sponsors set status = case when p_approve then 'approved' else 'declined' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(nullif(trim(p_note), ''), 500)
   where id = p_id;
  perform app.audit('outside_sponsor_reviewed', 'outside_sponsors', p_id, jsonb_build_object('approved', p_approve));
  return jsonb_build_object('ok', true, 'events', jsonb_build_array(
    jsonb_build_object('type','outside_sponsor_reviewed','man_id',o.man_id,'approved',p_approve)));
end $$;

create or replace function public.end_outside_sponsor(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update outside_sponsors set status = 'ended'
   where id = p_id and status in ('pending','approved') and (man_id = auth.uid() or app.is_leader());
  if not found then perform app.fail('Not found.'); end if;
  perform app.audit('outside_sponsor_ended', 'outside_sponsors', p_id, null);
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

-- ───────────────────────── "The Path": the weekly 3 ─────────────────────────
create or replace function app.week_start_for(p_man uuid) returns date
language sql stable security definer set search_path = public as $$
  select date_trunc('week', app.today_for(p_man))::date   -- ISO weeks start on Monday
$$;

create table if not exists fishing_weeks (
  man_id       uuid not null references profiles(id) on delete cascade,
  week_start   date not null,
  committed_at timestamptz not null default now(),
  primary key (man_id, week_start)
);
alter table fishing_weeks enable row level security;
grant select on fishing_weeks to authenticated;
drop policy if exists fw_read on fishing_weeks;
create policy fw_read on fishing_weeks for select to authenticated using (app.can_read_man(man_id));

-- Does he have to name and commit his 3 before using the member area? Once Key 1 is done.
create or replace function public.path_gate() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ws date; st program_stage;
begin
  if auth.uid() is null or not app.is_active() then return jsonb_build_object('required', false); end if;
  select stage into st from profiles where id = auth.uid();
  ws := app.week_start_for(auth.uid());
  return jsonb_build_object('week_start', ws, 'required',
    st not in ('module_0','key_1')
    and not exists (select 1 from fishing_weeks where man_id = auth.uid() and week_start = ws));
end $$;

create or replace function public.commit_fishing_week() returns jsonb
language plpgsql security definer set search_path = public as $$
declare ws date; n int;
begin
  if auth.uid() is null or not app.is_active() then perform app.fail('Your account must be approved first.'); end if;
  ws := app.week_start_for(auth.uid());
  select count(*) into n from fishing_contacts
   where man_id = auth.uid() and week_start = ws and slot between 1 and 3 and coalesce(trim(name), '') <> '';
  if n < 3 then perform app.fail('Name all 3 men for this week first.'); end if;
  insert into fishing_weeks (man_id, week_start) values (auth.uid(), ws) on conflict do nothing;
  perform app.audit('fishing_week_committed', 'fishing_weeks', auth.uid(), jsonb_build_object('week', ws));
  return jsonb_build_object('ok', true, 'week_start', ws, 'events', '[]'::jsonb);
end $$;

-- Once a week is committed, its 3 names stay (the plan/notes can still be updated).
create or replace function app.guard_fishing_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare r fishing_contacts := coalesce(old, new);
begin
  if exists (select 1 from fishing_weeks where man_id = r.man_id and week_start = r.week_start) then
    -- (An upsert fires the INSERT trigger first; only a genuinely new slot counts as an insert.)
    if tg_op = 'DELETE'
       or (tg_op = 'INSERT' and not exists (select 1 from fishing_contacts c where c.man_id = new.man_id
                                            and c.week_start = new.week_start and c.slot = new.slot))
       or (tg_op = 'UPDATE' and (new.name is distinct from old.name or new.slot <> old.slot
                                 or new.week_start <> old.week_start)) then
      perform app.fail('This week''s 3 are committed. You can still update what you''ll do and how.');
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists fishing_contact_guard on fishing_contacts;
create trigger fishing_contact_guard before insert or update or delete on fishing_contacts
  for each row execute function app.guard_fishing_contact();

-- ───────────────────────── his data export includes the new tables ─────────────────────────
create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); out jsonb;
begin
  if me is null then perform app.fail('Sign in first.'); end if;
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from profiles p where id = me),
    'contact_sharing', (select to_jsonb(c) from contact_sharing c where profile_id = me),
    'relationships', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from relationships r where me in (mentor_id, mentee_id)),
    'match_requests', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from match_requests r where requester_id = me),
    'video_progress', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from video_progress x where man_id = me),
    'worksheet_answers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from worksheet_answers x where man_id = me),
    'step_progress', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from step_progress x where man_id = me),
    'submissions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from submissions x where man_id = me),
    'milestones', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from milestones x where man_id = me),
    'meeting_logs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from meeting_logs x where man_id = me),
    'journal_entries', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from journal_entries x where man_id = me),
    'fishing_contacts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from fishing_contacts x where man_id = me),
    'fishing_weeks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from fishing_weeks x where man_id = me),
    'outside_sponsors', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from outside_sponsors x where man_id = me),
    'panic_events', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from panic_events x where man_id = me),
    'sobriety_resets', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from sobriety_resets x where man_id = me)
  ) into out;
  perform app.audit('data_exported', 'profiles', me, null);
  return out;
end $$;

-- ───────────────────────── grants (0006: new functions start with none) ─────────────────────────
revoke all on function public.set_ninety_start(date),
  public.log_meeting(date, uuid, text, text, boolean, text, text, boolean),
  public.submit_outside_sponsor(text, text, text, text), public.review_outside_sponsor(uuid, boolean, text),
  public.end_outside_sponsor(uuid), public.path_gate(), public.commit_fishing_week() from public, anon;
grant execute on function public.set_ninety_start(date),
  public.log_meeting(date, uuid, text, text, boolean, text, text, boolean),
  public.submit_outside_sponsor(text, text, text, text), public.review_outside_sponsor(uuid, boolean, text),
  public.end_outside_sponsor(uuid), public.path_gate(), public.commit_fishing_week() to authenticated;
revoke execute on function app.today_for(uuid), app.week_start_for(uuid), app.guard_meeting_log(),
  app.guard_fishing_contact() from public, anon, authenticated;
