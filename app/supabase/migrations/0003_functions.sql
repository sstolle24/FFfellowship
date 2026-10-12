-- 0003: Server-side gates. Every approval, return, unlock, milestone,
-- relationship change and role change happens here, inside the database,
-- so the UI can never skip a step. Each RPC returns
--   {"ok": true, "events": [...]}
-- and the server action turns events into emails.

-- ───────────────────────── internal helpers ─────────────────────────
create or replace function app.audit(p_action text, p_table text, p_id uuid, p_detail jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, target_table, target_id, detail)
  values (auth.uid(), p_action, p_table, p_id, p_detail)
$$;

create or replace function app.fail(p_msg text) returns void
language plpgsql as $$ begin raise exception using message = p_msg, errcode = 'P0001'; end $$;

-- Has this step reached the end of its gate?
create or replace function app.step_done(s step_status, g gate_type) returns boolean
language sql immutable as $$
  select case g
    when 'self'    then s in ('self_initialed','ap_initialed','leader_initialed')
    when 'self_ap' then s in ('ap_initialed','leader_initialed')
    else s = 'leader_initialed' end
$$;

create or replace function app.ensure_progress(p_man uuid) returns void
language sql security definer set search_path = public as $$
  insert into step_progress (man_id, step_id)
  select p_man, s.id from program_steps s
  on conflict (man_id, step_id) do nothing
$$;

create or replace function app.module_done(p_man uuid, p_key module_key) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare m program_modules;
begin
  select * into m from program_modules where key = p_key;
  if m.id is null then return false; end if;

  if p_key = 'key_2' then   -- needs all 21 leader-initialed AND a leader's confirmation
    return exists (select 1 from milestones where man_id = p_man and type = 'detox21_certified');
  end if;

  if exists (select 1 from program_steps ps
             left join step_progress sp on sp.step_id = ps.id and sp.man_id = p_man
             where ps.module_id = m.id
               and not app.step_done(coalesce(sp.status,'locked'), ps.gate_type)) then
    return false;
  end if;

  if p_key = 'key_1' and exists (select 1 from videos v
       left join video_progress vp on vp.video_id = v.id and vp.man_id = p_man
       where v.module_id = m.id and vp.watched_at is null) then
    return false;
  end if;
  return true;
end $$;

create or replace function app.has_milestone(p_man uuid, p_type milestone_type) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from milestones where man_id = p_man and type = p_type)
$$;

create or replace function app.award(p_man uuid, p_type milestone_type, p_by uuid, p_related uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_type <> 'certified_another' and app.has_milestone(p_man, p_type) then return false; end if;
  insert into milestones (man_id, type, awarded_by, related_man_id) values (p_man, p_type, p_by, p_related);
  perform app.audit('milestone_awarded', 'milestones', p_man, jsonb_build_object('type', p_type, 'related', p_related));
  return true;
end $$;

-- Opens whatever the man has earned, awards automatic milestones, sets stage.
-- Never re-locks anything. Returns events (module_unlocked / milestone).
create or replace function app.refresh_program(p_man uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ev jsonb := '[]';
  m record;
  prev_done boolean := true;
  unlocked boolean;
  n int;
  part1 step_status;
  st program_stage;
begin
  if not exists (select 1 from profiles where id = p_man and status = 'active') then return ev; end if;
  perform app.ensure_progress(p_man);

  for m in select * from program_modules order by order_no loop
    unlocked := prev_done;
    if m.key = 'key_3_part_2' then
      -- Part 2 opens once Part 1 has been self-initialed (not when Part 1 is leader-done).
      select sp.status into part1 from step_progress sp
        join program_steps ps on ps.id = sp.step_id
        join program_modules pm on pm.id = ps.module_id
        where sp.man_id = p_man and pm.key = 'key_3_part_1' limit 1;
      unlocked := part1 in ('self_initialed','ap_initialed','leader_initialed')
                  or (part1 = 'returned' and exists (
                        select 1 from step_progress sp join program_steps ps on ps.id = sp.step_id
                        where sp.man_id = p_man and ps.module_id = m.id and sp.status <> 'locked'));
    elsif m.key = 'certification' then
      unlocked := app.module_done(p_man, 'key_3_part_1') and app.module_done(p_man, 'key_3_part_2');
    end if;

    if unlocked then
      update step_progress sp set status = 'open', updated_at = now()
        from program_steps ps
        where ps.id = sp.step_id and ps.module_id = m.id and sp.man_id = p_man and sp.status = 'locked';
      get diagnostics n = row_count;
      if n > 0 then
        ev := ev || jsonb_build_object('type','module_unlocked','man_id',p_man,'module',m.key,'title',m.title);
      end if;
    end if;

    if m.key <> 'key_3_part_1' then   -- Part 2's own rule handles Part 1 → Part 2
      prev_done := prev_done and unlocked and app.module_done(p_man, m.key);
    else
      prev_done := prev_done and unlocked;  -- Part 2 checks Part 1 separately
    end if;
  end loop;

  -- keys_complete: both Key 3 parts leader-initialed
  if app.module_done(p_man,'key_3_part_1') and app.module_done(p_man,'key_3_part_2')
     and app.module_done(p_man,'key_2') then
    if app.award(p_man, 'keys_complete', auth.uid()) then
      ev := ev || jsonb_build_object('type','milestone','man_id',p_man,'milestone','keys_complete');
    end if;
  end if;

  -- ministry_eligible: fellowship_certified + certified_another
  if app.has_milestone(p_man,'fellowship_certified') and app.has_milestone(p_man,'certified_another') then
    if app.award(p_man, 'ministry_eligible', auth.uid()) then
      ev := ev || jsonb_build_object('type','milestone','man_id',p_man,'milestone','ministry_eligible');
    end if;
  end if;

  st := case
    when app.has_milestone(p_man,'ministry_eligible')    then 'ministry_eligible'
    when app.has_milestone(p_man,'fellowship_certified') then 'certified'
    when app.has_milestone(p_man,'keys_complete')        then 'certification_review'
    when app.module_done(p_man,'key_2')                  then 'key_3'
    when app.module_done(p_man,'key_1')                  then 'key_2'
    when app.module_done(p_man,'welcome')                then 'key_1'
    else 'module_0' end;
  update profiles set stage = st where id = p_man and stage is distinct from st;
  return ev;
end $$;

-- Loads a progress row with its step + module, and checks it exists.
create or replace function app.load_sp(p_sp uuid,
  out sp step_progress, out ps program_steps, out mkey module_key)
language plpgsql stable security definer set search_path = public as $$
begin
  select * into sp from step_progress where id = p_sp;
  if sp.id is null then perform app.fail('Step not found'); end if;
  select * into ps from program_steps where id = sp.step_id;
  select key into mkey from program_modules where id = ps.module_id;
end $$;

create or replace function app.has_any_mentor(p_man uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from relationships r where r.status = 'active'
    and ((r.mentee_id = p_man) or (r.type = 'ap' and r.mutual and r.mentor_id = p_man)))
$$;

-- Key 2 #20: every orange item must have something uploaded/submitted.
create or replace function app.missing_turn_ins(p_man uuid) returns int[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(ps.item_number order by ps.item_number), '{}')
  from program_steps ps
  join program_modules pm on pm.id = ps.module_id and pm.key = 'key_2'
  join step_progress sp on sp.step_id = ps.id and sp.man_id = p_man
  where ps.turn_in
    and not exists (select 1 from submissions s where s.step_progress_id = sp.id)
$$;

-- ───────────────────────── sign-up ─────────────────────────
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}');
begin
  insert into profiles (id, email, first_name, timezone, country, city, heard_about, sobriety_start_date)
  values (new.id, new.email,
          coalesce(nullif(trim(meta->>'first_name'),''), 'Brother'),
          coalesce(nullif(meta->>'timezone',''), 'America/Chicago'),
          nullif(meta->>'country',''), nullif(meta->>'city',''),
          nullif(meta->>'heard_about',''),
          nullif(meta->>'sobriety_start_date','')::date);
  insert into profile_intake (profile_id, intake_reason) values (new.id, nullif(meta->>'intake_reason',''));
  insert into contact_sharing (profile_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- Worksheet answers are editable only while that worksheet step is open/returned.
create or replace function app.guard_worksheet_answer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not exists (
    select 1 from worksheet_questions q
    join program_steps ps on ps.module_id = q.module_id and ps.helper->>'type' = 'worksheet'
    join step_progress sp on sp.step_id = ps.id and sp.man_id = new.man_id
    where q.id = new.question_id and sp.status in ('open','returned')) then
    perform app.fail('This worksheet is locked right now (not open, or already initialed).');
  end if;
  return new;
end $$;
create trigger worksheet_answer_guard before insert or update on worksheet_answers
  for each row execute function app.guard_worksheet_answer();

-- ───────────────────────── activity ─────────────────────────
create or replace function public.touch_activity() returns void
language sql security definer set search_path = public as $$
  update profiles set last_active_at = now() where id = auth.uid()
$$;

-- ───────────────────────── submissions ─────────────────────────
create or replace function public.next_submission_version(p_sp uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).man_id <> auth.uid() then perform app.fail('Not your step'); end if;
  return coalesce((select max(version) from submissions where step_progress_id = p_sp), 0) + 1;
end $$;

create or replace function public.add_submission(p_sp uuid, p_body text, p_file_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v int; sub_id uuid;
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).man_id <> auth.uid() or not app.is_active() then perform app.fail('Not your step'); end if;
  if (r.sp).status not in ('open','returned') then
    perform app.fail('You can only turn in work while the item is open or returned.');
  end if;
  if coalesce(trim(p_body),'') = '' and p_file_path is null then perform app.fail('Nothing to turn in'); end if;
  v := coalesce((select max(version) from submissions where step_progress_id = p_sp), 0) + 1;
  if p_file_path is not null and p_file_path not like
       format('%s/%s/%s/%%', auth.uid(), (r.sp).step_id, v) then
    perform app.fail('Upload path does not match this step/version');
  end if;
  insert into submissions (step_progress_id, man_id, body_text, file_path, version)
    values (p_sp, auth.uid(), p_body, p_file_path, v) returning id into sub_id;
  perform app.audit('submission_added', 'submissions', sub_id, jsonb_build_object('version', v));
  return jsonb_build_object('ok', true, 'version', v, 'events',
    jsonb_build_array(jsonb_build_object('type','turn_in_submitted','man_id',auth.uid(),
      'step', (r.ps).title, 'item', (r.ps).item_number)));
end $$;

-- ───────────────────────── initials ─────────────────────────
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

  -- Key 1 AP step: videos and worksheet first.
  if r.mkey = 'key_1' and (r.ps).gate_type = 'self_ap' then
    if exists (select 1 from videos v join program_modules pm on pm.id = v.module_id and pm.key = 'key_1'
               left join video_progress vp on vp.video_id = v.id and vp.man_id = auth.uid()
               where vp.watched_at is null) then
      perform app.fail('Check off all 3 videos first.');
    end if;
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
    ev := ev || jsonb_build_object('type','ap_signoff_needed','man_id',auth.uid(),'step',(r.ps).title,'item',(r.ps).item_number);
  elsif (r.ps).gate_type = 'leader' then
    ev := ev || jsonb_build_object('type','leader_review_needed','man_id',auth.uid(),'step',(r.ps).title);
  end if;
  ev := ev || app.refresh_program(auth.uid());
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

create or replace function public.initial_ap(p_sp uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; man uuid; allowed boolean; missing int[]; ev jsonb := '[]'; pl uuid;
begin
  select * into r from app.load_sp(p_sp);
  man := (r.sp).man_id;
  if man = auth.uid() then perform app.fail('You cannot initial your own item in the AP column.'); end if;
  if (r.ps).gate_type not in ('self_ap','triple') then perform app.fail('This item has no AP column.'); end if;
  if (r.sp).status <> 'self_initialed' then perform app.fail('Waiting on his own initials first.'); end if;

  allowed := app.is_ap_of(auth.uid(), man) or app.is_sponsor_of(auth.uid(), man);
  -- Key 1 only: with no active AP/sponsor, his primary leader (any leader if none assigned) may confirm.
  if not allowed and r.mkey = 'key_1' and not app.has_any_mentor(man) and app.is_leader() then
    select primary_leader_id into pl from profiles where id = man;
    allowed := pl is null or pl = auth.uid();
  end if;
  if not allowed then perform app.fail('Only his active AP or sponsor can give AP initials.'); end if;

  if (r.ps).helper->>'type' = 'cover_sheet' then
    missing := app.missing_turn_ins(man);
    if cardinality(missing) > 0 then
      perform app.fail('Cover sheet incomplete — turn-ins missing for items: ' || array_to_string(missing, ', '));
    end if;
  end if;

  update step_progress set status = 'ap_initialed', ap_initial_by = auth.uid(), ap_initialed_at = now(),
         updated_at = now() where id = p_sp;
  perform app.audit('initial_ap', 'step_progress', p_sp, jsonb_build_object('man', man));
  if (r.ps).gate_type = 'triple' then
    ev := ev || jsonb_build_object('type','leader_review_needed','man_id',man,'step',(r.ps).title,'item',(r.ps).item_number);
  else
    ev := ev || jsonb_build_object('type','approved','man_id',man,'step',(r.ps).title);
  end if;
  ev := ev || app.refresh_program(man);
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

create or replace function public.initial_leader(p_sp uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; man uuid; ev jsonb := '[]';
begin
  if not app.is_leader() then perform app.fail('Only leaders can give leader initials.'); end if;
  select * into r from app.load_sp(p_sp);
  man := (r.sp).man_id;
  if man = auth.uid() then perform app.fail('You cannot approve your own leader gate.'); end if;
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
  ev := ev || jsonb_build_object('type','approved','man_id',man,'step',(r.ps).title,'item',(r.ps).item_number);

  if r.mkey = 'certification' then
    if app.award(man, 'fellowship_certified', auth.uid()) then
      ev := ev || jsonb_build_object('type','milestone','man_id',man,'milestone','fellowship_certified');
    end if;
  end if;
  ev := ev || app.refresh_program(man);
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

create or replace function public.return_step(p_sp uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; man uuid; allowed boolean := false; pl uuid;
begin
  if coalesce(trim(p_note),'') = '' then perform app.fail('A note is required when returning an item.'); end if;
  select * into r from app.load_sp(p_sp);
  man := (r.sp).man_id;
  if man = auth.uid() then perform app.fail('You cannot return your own item.'); end if;

  if (r.sp).status = 'self_initialed' then
    allowed := app.is_leader() or app.is_ap_of(auth.uid(), man) or app.is_sponsor_of(auth.uid(), man);
  elsif (r.sp).status = 'ap_initialed' then
    allowed := app.is_leader();
  end if;
  if not allowed then perform app.fail('You can''t return this item at its current stage.'); end if;

  update step_progress set status = 'returned', returned_at = now(), returned_by = auth.uid(),
         review_note = p_note, self_initialed_at = null,
         ap_initial_by = null, ap_initialed_at = null, leader_initial_by = null, leader_initialed_at = null,
         updated_at = now()
   where id = p_sp;
  perform app.audit('return_step', 'step_progress', p_sp, jsonb_build_object('man', man, 'note', p_note));
  return jsonb_build_object('ok', true, 'events', jsonb_build_array(
    jsonb_build_object('type','returned','man_id',man,'step',(r.ps).title,'item',(r.ps).item_number,'note',p_note)));
end $$;

create or replace function public.set_read_to_group(p_sp uuid, p_value boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  select * into r from app.load_sp(p_sp);
  if r.mkey <> 'key_2' or (r.ps).item_number not between 13 and 15 then
    perform app.fail('Read-to-group applies to Key 2 items 13–15.');
  end if;
  update step_progress set read_to_group = p_value, updated_at = now() where id = p_sp;
  perform app.audit('read_to_group', 'step_progress', p_sp, jsonb_build_object('value', p_value));
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

-- ───────────────────────── leader confirmations ─────────────────────────
create or replace function public.leader_certify_key2(p_man uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev jsonb := '[]'; open_items int[];
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  if p_man = auth.uid() then perform app.fail('You cannot certify yourself.'); end if;
  select coalesce(array_agg(ps.item_number order by ps.item_number), '{}') into open_items
    from program_steps ps join program_modules pm on pm.id = ps.module_id and pm.key = 'key_2'
    left join step_progress sp on sp.step_id = ps.id and sp.man_id = p_man
    where coalesce(sp.status,'locked') <> 'leader_initialed';
  if cardinality(open_items) > 0 then
    perform app.fail('Not all 21 are leader-initialed. Still open: ' || array_to_string(open_items, ', '));
  end if;
  if app.award(p_man, 'detox21_certified', auth.uid()) then
    ev := ev || jsonb_build_object('type','milestone','man_id',p_man,'milestone','detox21_certified');
  end if;
  ev := ev || app.refresh_program(p_man);
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

create or replace function public.leader_award_certified_another(p_mentor uuid, p_mentee uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev jsonb := '[]';
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  if p_mentor = auth.uid() then perform app.fail('Another leader must confirm your own milestone.'); end if;
  if not app.has_milestone(p_mentee, 'fellowship_certified') then
    perform app.fail('That man is not fellowship certified yet.');
  end if;
  if not exists (select 1 from relationships where mentor_id = p_mentor and mentee_id = p_mentee
                 and type in ('sponsor','temp_sponsor') and status in ('active','ended')) then
    perform app.fail('He was never this man''s sponsor.');
  end if;
  if exists (select 1 from milestones where man_id = p_mentor and type = 'certified_another'
             and related_man_id = p_mentee) then
    perform app.fail('Already awarded for this man.');
  end if;
  perform app.award(p_mentor, 'certified_another', auth.uid(), p_mentee);
  ev := ev || jsonb_build_object('type','milestone','man_id',p_mentor,'milestone','certified_another');
  ev := ev || app.refresh_program(p_mentor);
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

-- ───────────────────────── members & roles ─────────────────────────
create or replace function public.approve_member(p_man uuid, p_primary_leader uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev jsonb;
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  update profiles set status = 'active',
         role = case when role = 'pending' then 'newcomer'::user_role else role end,
         program_start_date = coalesce(program_start_date, current_date),
         primary_leader_id = coalesce(p_primary_leader, primary_leader_id, auth.uid())
   where id = p_man and status = 'pending' and deleted_at is null;
  if not found then perform app.fail('No pending sign-up with that id.'); end if;
  perform app.audit('member_approved', 'profiles', p_man, null);
  ev := jsonb_build_array(jsonb_build_object('type','account_approved','man_id',p_man));
  return jsonb_build_object('ok', true, 'events', ev || app.refresh_program(p_man));
end $$;

create or replace function public.set_member_role(p_man uuid, p_role user_role) returns jsonb
language plpgsql security definer set search_path = public as $$
declare old user_role;
begin
  if not app.is_admin() then perform app.fail('Only an admin can change roles.'); end if;
  if p_man = auth.uid() and p_role <> 'admin' and
     (select count(*) from profiles where role = 'admin' and status = 'active') <= 1 then
    perform app.fail('You are the last admin.');
  end if;
  select role into old from profiles where id = p_man;
  update profiles set role = p_role where id = p_man;
  perform app.audit('role_changed', 'profiles', p_man, jsonb_build_object('from', old, 'to', p_role));
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

create or replace function public.set_member_status(p_man uuid, p_status member_status) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  if p_man = auth.uid() then perform app.fail('You cannot change your own status.'); end if;
  update profiles set status = p_status where id = p_man;
  perform app.audit('status_changed', 'profiles', p_man, jsonb_build_object('to', p_status));
  return jsonb_build_object('ok', true, 'events', app.refresh_program(p_man));
end $$;

create or replace function public.set_primary_leader(p_man uuid, p_leader uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  if p_leader is not null and not exists (select 1 from profiles where id = p_leader and role in ('leader','admin')) then
    perform app.fail('That person is not a leader.');
  end if;
  update profiles set primary_leader_id = p_leader where id = p_man;
  perform app.audit('primary_leader_set', 'profiles', p_man, jsonb_build_object('leader', p_leader));
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

create or replace function public.set_sobriety_date(p_date date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare old date;
begin
  if p_date > current_date then perform app.fail('Sobriety date can''t be in the future.'); end if;
  select sobriety_start_date into old from profiles where id = auth.uid();
  update profiles set sobriety_start_date = p_date where id = auth.uid();
  insert into sobriety_resets (man_id, old_date, new_date) values (auth.uid(), old, p_date);
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

-- ───────────────────────── matching ─────────────────────────
create or replace function public.create_match_request(p_type match_type, p_timezone text,
  p_best_times text, p_contact_pref text, p_notes text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not app.is_active() then perform app.fail('Your account must be approved first.'); end if;
  if exists (select 1 from match_requests where requester_id = auth.uid() and type = p_type
             and status in ('open','offered','pending_leader')) then
    perform app.fail('You already have an open request of that kind.');
  end if;
  insert into match_requests (requester_id, type, timezone, best_times, contact_pref, notes)
    values (auth.uid(), p_type, p_timezone, p_best_times, p_contact_pref, p_notes) returning id into rid;
  perform app.audit('match_requested', 'match_requests', rid, jsonb_build_object('type', p_type));
  return jsonb_build_object('ok', true, 'id', rid, 'events', jsonb_build_array(
    jsonb_build_object('type','match_requested','man_id',auth.uid(),'request_id',rid,'kind',p_type)));
end $$;

create or replace function public.close_match_request(p_request uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update match_requests set status = 'closed'
   where id = p_request and (requester_id = auth.uid() or app.is_leader()) and status <> 'matched';
  if not found then perform app.fail('Request not found.'); end if;
  update match_offers set status = 'withdrawn' where request_id = p_request and status = 'offered';
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

create or replace function public.offer_match(p_request uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare req match_requests; oid uuid;
begin
  if not app.is_sponsor_role() then perform app.fail('Only AP/sponsors and leaders can make offers.'); end if;
  select * into req from match_requests where id = p_request;
  if req.id is null or req.status not in ('open','offered') then perform app.fail('That request is no longer open.'); end if;
  if req.requester_id = auth.uid() then perform app.fail('That''s your own request.'); end if;
  insert into match_offers (request_id, offerer_id) values (p_request, auth.uid())
    on conflict (request_id, offerer_id) do update set status = 'offered', created_at = now()
    returning id into oid;
  update match_requests set status = 'offered' where id = p_request;
  perform app.audit('match_offered', 'match_offers', oid, null);
  return jsonb_build_object('ok', true, 'events', jsonb_build_array(
    jsonb_build_object('type','offer_received','man_id',req.requester_id,'offerer_id',auth.uid(),'kind',req.type)));
end $$;

create or replace function public.accept_offer(p_offer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o match_offers; req match_requests; rid uuid; ev jsonb;
begin
  select * into o from match_offers where id = p_offer;
  select * into req from match_requests where id = o.request_id;
  if req.requester_id is distinct from auth.uid() then perform app.fail('Not your request.'); end if;
  if o.status <> 'offered' or req.status not in ('open','offered') then perform app.fail('Offer no longer available.'); end if;

  update match_offers set status = case when id = p_offer then 'accepted'::offer_status else 'declined'::offer_status end
   where request_id = req.id and status = 'offered';

  if req.type = 'ap' then
    -- AP: leader confirmation optional, so the pair goes active right away.
    insert into relationships (mentor_id, mentee_id, type, mutual, status, match_request_id, started_at)
      values (o.offerer_id, auth.uid(), 'ap', true, 'active', req.id, now()) returning id into rid;
    update match_requests set status = 'matched', matched_mentor_id = o.offerer_id where id = req.id;
    ev := jsonb_build_array(jsonb_build_object('type','match_confirmed','man_id',auth.uid(),
                                               'mentor_id',o.offerer_id,'kind','ap'));
  else
    insert into relationships (mentor_id, mentee_id, type, status, match_request_id)
      values (o.offerer_id, auth.uid(), 'sponsor', 'accepted', req.id) returning id into rid;
    update match_requests set status = 'pending_leader', matched_mentor_id = o.offerer_id where id = req.id;
    ev := jsonb_build_array(jsonb_build_object('type','match_needs_leader','man_id',auth.uid(),
                                               'mentor_id',o.offerer_id,'relationship_id',rid));
  end if;
  perform app.audit('relationship_created', 'relationships', rid, jsonb_build_object('type', req.type));
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

create or replace function public.leader_confirm_relationship(p_rel uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r relationships;
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  update relationships set status = 'active', confirmed_by = auth.uid(), started_at = now()
   where id = p_rel and status in ('offered','accepted') returning * into r;
  if r.id is null then perform app.fail('Nothing to confirm.'); end if;
  update match_requests set status = 'matched' where id = r.match_request_id;
  perform app.audit('relationship_confirmed', 'relationships', p_rel, null);
  return jsonb_build_object('ok', true, 'events', jsonb_build_array(
    jsonb_build_object('type','match_confirmed','man_id',r.mentee_id,'mentor_id',r.mentor_id,'kind',r.type)));
end $$;

create or replace function public.leader_create_relationship(p_mentor uuid, p_mentee uuid, p_type rel_type) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  if not exists (select 1 from profiles where id in (p_mentor, p_mentee) and status = 'active'
                 having count(*) = 2) then
    perform app.fail('Both men must be active members.');
  end if;
  insert into relationships (mentor_id, mentee_id, type, mutual, status, confirmed_by, started_at)
    values (p_mentor, p_mentee, p_type, p_type = 'ap', 'active', auth.uid(), now()) returning id into rid;
  update match_requests set status = 'matched', matched_mentor_id = p_mentor
   where requester_id = p_mentee and status in ('open','offered','pending_leader')
     and type = case when p_type = 'ap' then 'ap'::match_type else 'sponsor'::match_type end;
  perform app.audit('relationship_created', 'relationships', rid, jsonb_build_object('type', p_type, 'direct', true));
  return jsonb_build_object('ok', true, 'events', jsonb_build_array(
    jsonb_build_object('type','match_confirmed','man_id',p_mentee,'mentor_id',p_mentor,'kind',p_type)));
end $$;

create or replace function public.end_relationship(p_rel uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r relationships;
begin
  select * into r from relationships where id = p_rel;
  if r.id is null or not (r.mentor_id = auth.uid() or r.mentee_id = auth.uid() or app.is_leader()) then
    perform app.fail('Not found.');
  end if;
  -- Access is revoked the instant status leaves 'active' — every policy checks it.
  update relationships set status = 'ended', ended_at = now() where id = p_rel;
  perform app.audit('relationship_ended', 'relationships', p_rel, null);
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

-- ───────────────────────── meetings & panic ─────────────────────────
create or replace function public.join_meeting(p_meeting uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m meetings;
begin
  if not app.can_see_links() then perform app.fail('Sign in to get meeting links.'); end if;
  select * into m from meetings where id = p_meeting and active;
  if m.id is null then perform app.fail('Meeting not found.'); end if;
  insert into meeting_link_joins (man_id, meeting_id) values (auth.uid(), p_meeting);
  return jsonb_build_object('ok', true, 'zoom_url', m.zoom_url, 'zoom_id', m.zoom_id, 'zoom_password', m.zoom_password);
end $$;

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
    select (jsonb_array_elements_text(panic_recipients))::uuid as x from contact_sharing where profile_id = auth.uid()
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

-- ───────────────────────── your data ─────────────────────────
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
    'panic_events', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from panic_events x where man_id = me),
    'sobriety_resets', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from sobriety_resets x where man_id = me)
  ) into out;
  perform app.audit('data_exported', 'profiles', me, null);
  return out;
end $$;

create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update profiles set deleted_at = now(), status = 'inactive' where id = auth.uid() and deleted_at is null;
  update relationships set status = 'ended', ended_at = now()
   where auth.uid() in (mentor_id, mentee_id) and status <> 'ended';
  update match_requests set status = 'closed' where requester_id = auth.uid() and status <> 'matched';
  perform app.audit('account_deleted', 'profiles', auth.uid(), null);
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

-- Server-side rate limiter for sign-up / login actions (service role only).
create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from rate_limits where hit_at < now() - interval '1 day';
  select count(*) into n from rate_limits where key = p_key
    and hit_at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then return false; end if;
  insert into rate_limits (key) values (p_key);
  return true;
end $$;

-- ───────────────────────── grants ─────────────────────────
revoke all on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.rate_limit_hit(text,int,int) from authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rate_limit_hit(text,int,int) to service_role;
  end if;
end $$;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
-- Internal mutators must not be callable directly by members.
revoke execute on function app.audit(text,text,uuid,jsonb), app.award(uuid,milestone_type,uuid,uuid),
  app.refresh_program(uuid), app.ensure_progress(uuid) from authenticated;
