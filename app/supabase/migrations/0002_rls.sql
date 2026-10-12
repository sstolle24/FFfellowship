-- 0002: Row-level security. Default deny: RLS on every table, explicit grants,
-- and every write that moves the program forward goes through a SECURITY
-- DEFINER function in 0003 rather than a direct table write.

create schema if not exists app;
grant usage on schema app to anon, authenticated;

-- ───────────────────────── identity helpers ─────────────────────────
create or replace function app.me() returns uuid
language sql stable as $$ select auth.uid() $$;

create or replace function app.my_profile() returns profiles
language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid() and deleted_at is null
$$;

create or replace function app.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and status = 'active' and deleted_at is null)
$$;

-- Pending + active members may see meeting links (Steven's call, Oct 2026).
create or replace function app.can_see_links() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and status in ('pending','active') and deleted_at is null)
$$;

create or replace function app.is_leader() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and role in ('leader','admin') and status = 'active' and deleted_at is null)
$$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and role = 'admin' and status = 'active' and deleted_at is null)
$$;

create or replace function app.is_sponsor_role() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and role in ('ap_sponsor','leader','admin') and status = 'active' and deleted_at is null)
$$;

-- Is :who an ACTIVE AP of :man? AP rows marked mutual work both directions.
create or replace function app.is_ap_of(who uuid, man uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from relationships r
    where r.status = 'active' and r.type = 'ap'
      and ((r.mentor_id = who and r.mentee_id = man)
        or (r.mutual and r.mentor_id = man and r.mentee_id = who)))
$$;

create or replace function app.is_sponsor_of(who uuid, man uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from relationships r
    where r.status = 'active' and r.type in ('sponsor','temp_sponsor')
      and r.mentor_id = who and r.mentee_id = man)
$$;

-- Can the caller read this man's program data? Himself, an active AP/sponsor, or a leader.
create or replace function app.can_read_man(man uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
       man = auth.uid()
    or app.is_leader()
    or app.is_ap_of(auth.uid(), man)
    or app.is_sponsor_of(auth.uid(), man))
$$;

revoke all on function app.my_profile() from public;
grant execute on all functions in schema app to authenticated;
grant execute on function app.is_active(), app.can_see_links(), app.is_leader() to anon;

-- ───────────────────────── lock everything down ─────────────────────────
revoke all on all tables in schema public from anon, authenticated;

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ───────────────────────── profiles ─────────────────────────
grant select on profiles to authenticated;
-- Members may edit only these columns on their own row. Role, status, stage,
-- dates and leader assignment change only through functions in 0003.
grant update (first_name, display_name, phone, signal, timezone, country, city,
              home_group, service_position, email_prefs) on profiles to authenticated;

create policy profiles_read on profiles for select to authenticated
  using (id = auth.uid() or app.is_leader());
create policy profiles_self_update on profiles for update to authenticated
  using (id = auth.uid() and deleted_at is null) with check (id = auth.uid());

-- profile_intake: leaders/admins only.
grant select on profile_intake to authenticated;
create policy intake_leaders on profile_intake for select to authenticated
  using (app.is_leader());

-- ───────────────────────── contact sharing ─────────────────────────
grant select, insert, update on contact_sharing to authenticated;
create policy cs_read on contact_sharing for select to authenticated
  using (profile_id = auth.uid() or app.is_leader());
create policy cs_insert on contact_sharing for insert to authenticated
  with check (profile_id = auth.uid());
create policy cs_update on contact_sharing for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ───────────────────────── relationships & matching ─────────────────────────
grant select on relationships, match_requests, match_offers to authenticated;
create policy rel_read on relationships for select to authenticated
  using (mentor_id = auth.uid() or mentee_id = auth.uid() or app.is_leader());

create policy mr_read on match_requests for select to authenticated
  using (requester_id = auth.uid() or matched_mentor_id = auth.uid() or app.is_leader());

create policy mo_read on match_offers for select to authenticated
  using (offerer_id = auth.uid() or app.is_leader()
         or exists (select 1 from match_requests r where r.id = request_id and r.requester_id = auth.uid()));

-- ───────────────────────── program content (active members) ─────────────────────────
grant select on program_modules, program_steps, worksheet_questions, videos to authenticated;
create policy pm_read on program_modules     for select to authenticated using (app.is_active());
create policy ps_read on program_steps       for select to authenticated using (app.is_active());
create policy wq_read on worksheet_questions for select to authenticated using (app.is_active());
create policy v_read  on videos              for select to authenticated using (app.is_active());

-- ───────────────────────── a man's own data ─────────────────────────
-- Read: himself, active AP/sponsor, leaders. Nobody else.
grant select on step_progress, submissions, milestones, video_progress, worksheet_answers,
                meeting_link_joins, sobriety_resets to authenticated;
create policy sp_read  on step_progress      for select to authenticated using (app.can_read_man(man_id));
create policy sub_read on submissions        for select to authenticated using (app.can_read_man(man_id));
create policy ms_read  on milestones         for select to authenticated using (app.can_read_man(man_id));
create policy vp_read  on video_progress     for select to authenticated using (app.can_read_man(man_id));
create policy wa_read  on worksheet_answers  for select to authenticated using (app.can_read_man(man_id));
create policy mlj_read on meeting_link_joins for select to authenticated using (app.can_read_man(man_id));
create policy sr_read  on sobriety_resets    for select to authenticated
  using (man_id = auth.uid() or app.is_leader());

-- Video notes: his own row only.
grant insert, update on video_progress to authenticated;
create policy vp_write on video_progress for insert to authenticated
  with check (man_id = auth.uid() and app.is_active());
create policy vp_update on video_progress for update to authenticated
  using (man_id = auth.uid()) with check (man_id = auth.uid());

-- Worksheet answers: his own, and only while that worksheet's step is editable
-- (open or returned). Checked by trigger in 0003.
grant insert, update on worksheet_answers to authenticated;
create policy wa_insert on worksheet_answers for insert to authenticated
  with check (man_id = auth.uid() and app.is_active());
create policy wa_update on worksheet_answers for update to authenticated
  using (man_id = auth.uid()) with check (man_id = auth.uid());

-- 90-in-90 log, fishing: owner writes; owner/mentor/leader reads.
grant select, insert, update, delete on meeting_logs, fishing_contacts to authenticated;
create policy ml_read on meeting_logs for select to authenticated using (app.can_read_man(man_id));
create policy ml_ins  on meeting_logs for insert to authenticated with check (man_id = auth.uid() and app.is_active());
create policy ml_upd  on meeting_logs for update to authenticated using (man_id = auth.uid()) with check (man_id = auth.uid());
create policy ml_del  on meeting_logs for delete to authenticated using (man_id = auth.uid());

create policy fc_read on fishing_contacts for select to authenticated using (app.can_read_man(man_id));
create policy fc_ins  on fishing_contacts for insert to authenticated with check (man_id = auth.uid() and app.is_active());
create policy fc_upd  on fishing_contacts for update to authenticated using (man_id = auth.uid()) with check (man_id = auth.uid());
create policy fc_del  on fishing_contacts for delete to authenticated using (man_id = auth.uid());

-- Journal: shared entries → owner/mentor/leader. Unshared → owner + leaders
-- (Steven's call, Oct 2026).
grant select, insert, update, delete on journal_entries to authenticated;
create policy je_read on journal_entries for select to authenticated using (
  man_id = auth.uid() or app.is_leader()
  or (shared_with_mentors and (app.is_ap_of(auth.uid(), man_id) or app.is_sponsor_of(auth.uid(), man_id))));
create policy je_ins on journal_entries for insert to authenticated with check (man_id = auth.uid() and app.is_active());
create policy je_upd on journal_entries for update to authenticated using (man_id = auth.uid()) with check (man_id = auth.uid());
create policy je_del on journal_entries for delete to authenticated using (man_id = auth.uid());

-- ───────────────────────── meetings ─────────────────────────
-- Full rows (zoom_url/id/password) only to signed-in pending/active members.
grant select on meetings to authenticated;
grant insert, update, delete on meetings to authenticated;
create policy mt_read  on meetings for select to authenticated using (app.can_see_links());
create policy mt_write on meetings for insert to authenticated with check (app.is_leader());
create policy mt_upd   on meetings for update to authenticated using (app.is_leader()) with check (app.is_leader());
create policy mt_del   on meetings for delete to authenticated using (app.is_leader());

-- Public view: name, day, time, tagline, beginner. Nothing else, ever.
create view meetings_public as
  select id, name, day_of_week, start_time_utc, tagline, beginner
  from meetings where active;
grant select on meetings_public to anon, authenticated;

-- ───────────────────────── leader-only tables ─────────────────────────
grant select, insert, delete on leader_notes to authenticated;
create policy ln_read on leader_notes for select to authenticated using (app.is_leader());
create policy ln_ins  on leader_notes for insert to authenticated with check (app.is_leader() and leader_id = auth.uid());
create policy ln_del  on leader_notes for delete to authenticated using (app.is_leader() and leader_id = auth.uid());

grant select on panic_events, email_log, audit_log to authenticated;
create policy pe_read on panic_events for select to authenticated using (man_id = auth.uid() or app.is_leader());
create policy el_read on email_log    for select to authenticated using (app.is_leader());
create policy al_read on audit_log    for select to authenticated using (app.is_leader());

grant select on app_settings to authenticated;
grant update on app_settings to authenticated;
create policy as_read on app_settings for select to authenticated using (app.is_active());
create policy as_upd  on app_settings for update to authenticated using (app.is_admin()) with check (app.is_admin());
-- rate_limits: no grants at all (service role / definer functions only).

-- ───────────────────────── member-facing views ─────────────────────────
-- These run as the view owner so they can join across tables, and each one
-- carries its own guard in the WHERE clause.

-- Brother card: what any active member may know about another active member.
create view member_cards as
  select p.id, p.first_name, p.display_name, p.stage, p.timezone, p.home_group,
         p.sobriety_start_date,
         case when p.sobriety_start_date is null then null
              else (current_date - p.sobriety_start_date) end as day_count
  from profiles p
  where p.status = 'active' and p.deleted_at is null and app.is_active();
grant select on member_cards to authenticated;

-- Contact details honour contact_sharing opt-ins, city-level only.
create view member_contacts as
  select p.id, p.first_name, p.display_name,
         case when cs.share_phone  then p.phone  end as phone,
         case when cs.share_signal then coalesce(p.signal, p.phone) end as signal,
         case when cs.share_city   then p.city   end as city,
         case when cs.share_city   then p.country end as country,
         cs.directory_opt_in
  from profiles p
  join contact_sharing cs on cs.profile_id = p.id
  where p.status = 'active' and p.deleted_at is null
    and (cs.directory_opt_in or cs.share_phone or cs.share_signal)
    and app.is_active();
grant select on member_contacts to authenticated;

-- Sponsor Board: first name, timezone, day count, stage only.
create view sponsor_board as
  select r.id as request_id, r.type, r.status, r.created_at,
         p.first_name, coalesce(r.timezone, p.timezone) as timezone, p.stage,
         case when p.sobriety_start_date is null then null
              else (current_date - p.sobriety_start_date) end as day_count,
         exists (select 1 from match_offers o where o.request_id = r.id and o.offerer_id = auth.uid()
                 and o.status = 'offered') as i_offered
  from match_requests r join profiles p on p.id = r.requester_id
  where r.status in ('open','offered') and r.requester_id <> auth.uid()
    and p.deleted_at is null and app.is_sponsor_role();
grant select on sponsor_board to authenticated;

-- ───────────────────────── storage ─────────────────────────
-- Private bucket; path {man_id}/{step_id}/{version}/{file}. Reads via short-lived
-- signed URLs created with the reader's own session, so these policies apply.
insert into storage.buckets (id, name, public) values ('submissions','submissions', false)
  on conflict (id) do update set public = false;

create policy sub_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'submissions'
         and app.can_read_man(((storage.foldername(name))[1])::uuid));
create policy sub_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions'
              and (storage.foldername(name))[1] = auth.uid()::text
              and app.is_active());
-- No update/delete policies: uploads are append-only versions.
