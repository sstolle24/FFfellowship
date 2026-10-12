-- 0004: Security fixes from the independent test (Oct 2026).
-- Each section is tagged with the finding it closes (H1…L5). Safe to run on a
-- database that already has 0001–0003 applied.

-- ───────────────────────── H1: links are for approved members only ─────────────────────────
-- Pending men see the public schedule (meetings_public) until a leader approves them.
create or replace function app.can_see_links() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and status = 'active' and deleted_at is null)
$$;

-- ───────────────────────── H2 + M4: AP / sponsor checks ─────────────────────────
-- `who` must be an active, non-deleted member, and only the two men involved
-- (or a leader) may ask — so nobody can probe other men's relationships.
create or replace function app.is_ap_of(who uuid, man uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (coalesce(auth.uid() in (who, man), false) or app.is_leader())
    and exists (select 1 from profiles p where p.id = who and p.status = 'active' and p.deleted_at is null)
    and exists (select 1 from relationships r
      where r.status = 'active' and r.type = 'ap'
        and ((r.mentor_id = who and r.mentee_id = man)
          or (r.mutual and r.mentor_id = man and r.mentee_id = who)))
$$;

create or replace function app.is_sponsor_of(who uuid, man uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (coalesce(auth.uid() in (who, man), false) or app.is_leader())
    and exists (select 1 from profiles p where p.id = who and p.status = 'active' and p.deleted_at is null)
    and exists (select 1 from relationships r
      where r.status = 'active' and r.type in ('sponsor','temp_sponsor')
        and r.mentor_id = who and r.mentee_id = man)
$$;

-- ───────────────────────── H3: Signal only when he shared Signal ─────────────────────────
create or replace view member_contacts as
  select p.id, p.first_name, p.display_name,
         case when cs.share_phone  then p.phone  end as phone,
         case when cs.share_signal then p.signal end as signal,
         case when cs.share_city   then p.city   end as city,
         case when cs.share_city   then p.country end as country,
         cs.directory_opt_in
  from profiles p
  join contact_sharing cs on cs.profile_id = p.id
  where p.status = 'active' and p.deleted_at is null
    and (cs.directory_opt_in or cs.share_phone or cs.share_signal)
    and app.is_active();

-- ───────────────────────── M2: member cards only for men he has reason to see ─────────────────────────
-- Rows: himself, men listed in the Directory, men he has an active relationship
-- or open match with, and leaders. Leaders (who can read every profile anyway)
-- see all cards so initialer names resolve in Man Detail. No raw sobriety date.
drop view if exists member_cards;
create view member_cards as
  select p.id, p.first_name, p.display_name, p.stage, p.timezone, p.home_group,
         case when p.sobriety_start_date is null then null
              else (current_date - p.sobriety_start_date) end as day_count,
         (p.role in ('leader','admin')) as is_leader
  from profiles p
  left join contact_sharing cs on cs.profile_id = p.id
  where p.status = 'active' and p.deleted_at is null and app.is_active()
    and (p.id = auth.uid()
      or coalesce(cs.directory_opt_in, false)
      or p.role in ('leader','admin')
      or app.is_leader()
      or exists (select 1 from relationships r
                 where r.status = 'active'
                   and ((r.mentor_id = p.id and r.mentee_id = auth.uid())
                     or (r.mentee_id = p.id and r.mentor_id = auth.uid())))
      or exists (select 1 from match_offers o join match_requests mr on mr.id = o.request_id
                 where o.status in ('offered','accepted')
                   and mr.status in ('open','offered','pending_leader')
                   and ((mr.requester_id = auth.uid() and o.offerer_id = p.id)
                     or (mr.requester_id = p.id and o.offerer_id = auth.uid()))));
grant select on member_cards to authenticated;

-- Panic picks are limited to the same people the picker offers: Directory
-- members, his active AP/sponsor/sponsees, and leaders. His AP, sponsor and
-- primary leader are always alerted (as designed).
create or replace function public.trigger_panic() returns jsonb
language plpgsql security definer set search_path = public as $$
declare lim jsonb; recent int; ids uuid[]; pid uuid;
begin
  if not app.is_active() then perform app.fail('Account not active.'); end if;
  select value into lim from app_settings where key = 'panic_rate_limit';
  select count(*) into recent from panic_events where man_id = auth.uid()
    and created_at > now() - make_interval(mins => coalesce((lim->>'window_minutes')::int, 10));
  if recent >= coalesce((lim->>'max')::int, 3) then
    perform app.fail('Alert already sent — your brothers have been notified. Call someone now.');
  end if;

  select array_agg(distinct x) into ids from (
    select pick as x from (
      select (jsonb_array_elements_text(panic_recipients))::uuid as pick
      from contact_sharing where profile_id = auth.uid()) picks
    where exists (select 1 from contact_sharing c where c.profile_id = pick and c.directory_opt_in)
       or exists (select 1 from profiles l where l.id = pick and l.role in ('leader','admin'))
       or exists (select 1 from relationships r where r.status = 'active'
                  and ((r.mentor_id = pick and r.mentee_id = auth.uid())
                    or (r.mentee_id = pick and r.mentor_id = auth.uid())))
    union select mentor_id from relationships where mentee_id = auth.uid() and status = 'active'
    union select mentee_id from relationships where mentor_id = auth.uid() and status = 'active' and type = 'ap' and mutual
    union select primary_leader_id from profiles where id = auth.uid()
  ) t join profiles p on p.id = t.x and p.status = 'active' and p.deleted_at is null
  where x is not null and x <> auth.uid();

  insert into panic_events (man_id, recipients) values (auth.uid(), to_jsonb(coalesce(ids, '{}')))
    returning id into pid;
  return jsonb_build_object('ok', true, 'events', jsonb_build_array(
    jsonb_build_object('type','panic','man_id',auth.uid(),'recipients',to_jsonb(coalesce(ids,'{}')))));
end $$;

-- ───────────────────────── H2 + M3: status changes ─────────────────────────
create or replace function public.set_member_status(p_man uuid, p_status member_status) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t profiles;
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  if p_man = auth.uid() then perform app.fail('You cannot change your own status.'); end if;
  select * into t from profiles where id = p_man and deleted_at is null;
  if t.id is null then perform app.fail('Member not found.'); end if;
  if t.role in ('leader','admin') and not app.is_admin() then
    perform app.fail('Only an admin can change a leader''s or admin''s status.');
  end if;
  if p_status = 'active' and t.status = 'pending' then
    perform app.fail('Use Approve to activate a pending sign-up.');
  end if;
  if t.role = 'admin' and t.status = 'active' and p_status <> 'active'
     and (select count(*) from profiles where role = 'admin' and status = 'active' and deleted_at is null) <= 1 then
    perform app.fail('That would leave no active admin.');
  end if;

  update profiles set status = p_status where id = p_man;
  if p_status = 'inactive' then
    -- Same as delete_my_account: access ends the moment he is deactivated.
    update relationships set status = 'ended', ended_at = now()
     where p_man in (mentor_id, mentee_id) and status <> 'ended';
    update match_requests set status = 'closed' where requester_id = p_man and status <> 'matched';
    update match_offers set status = 'withdrawn' where offerer_id = p_man and status = 'offered';
  end if;
  perform app.audit('status_changed', 'profiles', p_man, jsonb_build_object('from', t.status, 'to', p_status));
  return jsonb_build_object('ok', true, 'events', app.refresh_program(p_man));
end $$;

-- ───────────────────────── M6: Key 1 worksheet needs the 3 videos ─────────────────────────
create or replace function public.initial_self(p_sp uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; missing int[]; snap jsonb; since timestamptz; ev jsonb := '[]';
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).man_id <> auth.uid() or not app.is_active() then
    perform app.fail('You can only initial your own items.');
  end if;
  if (r.sp).status not in ('open','returned') then perform app.fail('This item is not open for your initials.'); end if;
  since := coalesce((r.sp).returned_at, '-infinity'::timestamptz);

  -- Key 1 worksheet and AP step: all 3 videos first.
  if r.mkey = 'key_1' and ((r.ps).gate_type = 'self_ap' or (r.ps).helper->>'type' = 'worksheet') then
    if exists (select 1 from videos v join program_modules pm on pm.id = v.module_id and pm.key = 'key_1'
               left join video_progress vp on vp.video_id = v.id and vp.man_id = auth.uid()
               where vp.watched_at is null) then
      perform app.fail('Check off all 3 videos first.');
    end if;
  end if;
  -- Key 1 AP step: worksheet first.
  if r.mkey = 'key_1' and (r.ps).gate_type = 'self_ap' then
    if exists (select 1 from program_steps ps join program_modules pm on pm.id = ps.module_id and pm.key = 'key_1'
               join step_progress sp on sp.step_id = ps.id and sp.man_id = auth.uid()
               where ps.helper->>'type' = 'worksheet' and not app.step_done(sp.status, ps.gate_type)) then
      perform app.fail('Finish the worksheet first.');
    end if;
  end if;

  -- Worksheet: either answers for every question, or an uploaded file.
  if (r.ps).helper->>'type' = 'worksheet' then
    if not exists (select 1 from submissions s where s.step_progress_id = p_sp
                   and s.file_path is not null and s.created_at > since)
       and exists (select 1 from worksheet_questions q where q.module_id = (r.ps).module_id
                   and q.answer_slots > 0
                   and not exists (select 1 from worksheet_answers a where a.question_id = q.id
                                   and a.man_id = auth.uid() and coalesce(trim(a.answer),'') <> '')) then
      perform app.fail('Answer every question (or upload your completed worksheet) before initialing.');
    end if;
    -- Snapshot answers into a submission version so reviewers see exactly what was initialed.
    select jsonb_agg(jsonb_build_object('q', q.order_no, 'label', q.timestamp_label, 'prompt', q.prompt,
             'answers', (select coalesce(jsonb_agg(a.answer order by a.slot), '[]') from worksheet_answers a
                         where a.question_id = q.id and a.man_id = auth.uid())) order by q.order_no)
      into snap from worksheet_questions q where q.module_id = (r.ps).module_id;
    insert into submissions (step_progress_id, man_id, body_text, version)
      values (p_sp, auth.uid(), snap::text,
              coalesce((select max(version) from submissions where step_progress_id = p_sp), 0) + 1);
  end if;

  -- Orange turn-ins: something must be turned in (since any return).
  if ((r.ps).turn_in or (r.ps).requires_upload) and not exists (
       select 1 from submissions s where s.step_progress_id = p_sp and s.created_at > since) then
    perform app.fail('Turn in (type or upload) your work for this item first.');
  end if;

  if (r.ps).helper->>'type' = 'cover_sheet' then
    missing := app.missing_turn_ins(auth.uid());
    if cardinality(missing) > 0 then
      perform app.fail('Turn-ins still missing for items: ' || array_to_string(missing, ', '));
    end if;
  end if;

  update step_progress set status = 'self_initialed', self_initialed_at = now(),
         ap_initial_by = null, ap_initialed_at = null, leader_initial_by = null, leader_initialed_at = null,
         updated_at = now()
   where id = p_sp;
  perform app.audit('initial_self', 'step_progress', p_sp, null);

  if (r.ps).gate_type in ('self_ap','triple') then
    ev := ev || jsonb_build_object('type','ap_signoff_needed','man_id',auth.uid(),'step',(r.ps).title,
                                   'item',(r.ps).item_number,'step_id',(r.ps).id);
  elsif (r.ps).gate_type = 'leader' then
    ev := ev || jsonb_build_object('type','leader_review_needed','man_id',auth.uid(),'step',(r.ps).title,
                                   'step_id',(r.ps).id);
  end if;
  ev := ev || app.refresh_program(auth.uid());
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

-- ───────────────────────── M1: AP and leader initials from different men ─────────────────────────
create or replace function public.initial_leader(p_sp uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; man uuid; ev jsonb := '[]';
begin
  if not app.is_leader() then perform app.fail('Only leaders can give leader initials.'); end if;
  select * into r from app.load_sp(p_sp);
  man := (r.sp).man_id;
  if man = auth.uid() then perform app.fail('You cannot approve your own leader gate.'); end if;
  if (r.sp).ap_initial_by = auth.uid() then
    perform app.fail('A different leader must give leader initials.');
  end if;
  if (r.ps).gate_type = 'triple' and (r.sp).status <> 'ap_initialed' then
    perform app.fail('Waiting on his AP''s initials first.');
  elsif (r.ps).gate_type = 'leader' and (r.sp).status <> 'self_initialed' then
    perform app.fail('He hasn''t submitted this yet.');
  elsif (r.ps).gate_type not in ('triple','leader') then
    perform app.fail('This item has no leader column.');
  end if;

  update step_progress set status = 'leader_initialed', leader_initial_by = auth.uid(),
         leader_initialed_at = now(), updated_at = now() where id = p_sp;
  perform app.audit('initial_leader', 'step_progress', p_sp, jsonb_build_object('man', man));
  ev := ev || jsonb_build_object('type','approved','man_id',man,'step',(r.ps).title,
                                 'item',(r.ps).item_number,'step_id',(r.ps).id);

  if r.mkey = 'certification' then
    if app.award(man, 'fellowship_certified', auth.uid()) then
      ev := ev || jsonb_build_object('type','milestone','man_id',man,'milestone','fellowship_certified');
    end if;
  end if;
  ev := ev || app.refresh_program(man);
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

-- ───────────────────────── M5: submissions bucket ─────────────────────────
update storage.buckets
   set file_size_limit = 20 * 1024 * 1024,
       allowed_mime_types = array[
         'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'text/plain', 'application/rtf', 'text/rtf',
         'application/vnd.oasis.opendocument.text']
 where id = 'submissions';

-- Path must be {his id}/{a step that is open or returned for him}/{numeric version}/{file}.
drop policy if exists sub_obj_insert on storage.objects;
create policy sub_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions'
              and array_length(storage.foldername(name), 1) = 3
              and (storage.foldername(name))[1] = auth.uid()::text
              and (storage.foldername(name))[3] ~ '^[0-9]{1,6}$'
              and app.is_active()
              and exists (select 1 from step_progress sp
                          where sp.man_id = auth.uid()
                            and sp.step_id::text = (storage.foldername(name))[2]
                            and sp.status in ('open','returned')));

-- ───────────────────────── L4: purge can scrub contact fields ─────────────────────────
-- The daily purge nulls email/phone/signal/city on deleted accounts and then
-- removes the auth user, so references to him from other men's records fall
-- back to null instead of blocking the delete.
alter table profiles alter column email drop not null;
alter table leader_notes alter column leader_id drop not null;
do $$
declare fk record;
begin
  for fk in
    select c.conrelid::regclass as tbl, c.conname, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
      and c.confdeltype = 'a'   -- NO ACTION
      and (c.conrelid::regclass::text, a.attname::text) in (
        ('step_progress','ap_initial_by'), ('step_progress','leader_initial_by'), ('step_progress','returned_by'),
        ('relationships','confirmed_by'), ('milestones','awarded_by'), ('milestones','related_man_id'),
        ('match_requests','matched_mentor_id'), ('leader_notes','leader_id'))
  loop
    execute format('alter table %s drop constraint %I', fk.tbl, fk.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references profiles(id) on delete set null',
                   fk.tbl, fk.conname, fk.col);
  end loop;
end $$;

-- ───────────────────────── M4: internal helpers are not callable by members ─────────────────────────
-- RLS policies and member views only need the identity helpers below; the rest
-- run inside SECURITY DEFINER gate functions as the owner.
revoke execute on function
  app.load_sp(uuid), app.module_done(uuid, module_key), app.has_milestone(uuid, milestone_type),
  app.missing_turn_ins(uuid), app.has_any_mentor(uuid), app.step_done(step_status, gate_type),
  app.audit(text, text, uuid, jsonb), app.award(uuid, milestone_type, uuid, uuid),
  app.refresh_program(uuid), app.ensure_progress(uuid), app.fail(text),
  app.handle_new_user(), app.guard_worksheet_answer(),
  app.me(), app.my_profile()
  from public, anon, authenticated;
-- Kept for authenticated (used by RLS policies / member views):
--   app.is_active, app.can_see_links, app.is_leader, app.is_admin, app.is_sponsor_role,
--   app.is_ap_of, app.is_sponsor_of, app.can_read_man
grant execute on function app.is_active(), app.can_see_links(), app.is_leader(), app.is_admin(),
  app.is_sponsor_role(), app.is_ap_of(uuid, uuid), app.is_sponsor_of(uuid, uuid), app.can_read_man(uuid)
  to authenticated;

-- ───────────────────────── L5: email_log keeps no message content ─────────────────────────
-- Older rows stored every template variable (return notes, phone numbers).
update email_log
   set meta = jsonb_build_object('template', template, 'dedupe', meta->'dedupe', 'step_id', meta->'step_id')
 where meta - 'template' - 'dedupe' - 'step_id' <> '{}'::jsonb;
