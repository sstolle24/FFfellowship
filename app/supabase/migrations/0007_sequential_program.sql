-- 0007: Sequential program (Steven, Oct 2026).
--   * Keys stay strictly in order: a key opens only when the previous one is
--     fully signed off (self, AP and leader as each item's gate defines).
--   * Inside a key, assignments open one at a time: the next one opens once
--     the man has finished HIS part of every earlier one (self-initial, which
--     already requires any turn-in or worksheet answers). AP/leader initials
--     are not needed to keep moving inside a key.
--   * Background items (helper.background = true) start when they open and
--     don't block the next item while their timer runs. They still need every
--     sign-off before the key completes.
--   * Key 1: Video 1 → Video 2 → Video 3 → Fishing worksheet → AP go-over.
--   * A returned item never re-locks the items after it.
-- Locked items refuse initials, turn-ins, uploads and worksheet answers
-- because every write path already requires status open/returned; this file
-- makes the unlocking sequential and gives each refusal a clear reason.

-- ───────────────────────── content ─────────────────────────
update program_steps ps set title = 'Fishing worksheet'
  from program_modules pm
 where pm.id = ps.module_id and pm.key = 'key_1' and ps.helper->>'type' = 'worksheet';
update program_modules set title = 'Key 1 — The 3 Videos and the Fishing worksheet' where key = 'key_1';

-- Background (timed / waiting-on-others) items in Key 2:
--   #2 Pray 30 days, #10 90 in 90, #12 service position (day 14),
--   #16 get an AP, #18 sponsor by day 90, #19 sponsor someone (day 30).
update program_steps ps set helper = coalesce(ps.helper, '{}'::jsonb) || '{"background": true}'::jsonb
  from program_modules pm
 where pm.id = ps.module_id and pm.key = 'key_2' and ps.item_number in (2, 10, 12, 16, 18, 19);

-- ───────────────────────── helpers ─────────────────────────
-- His part is done (a returned item was done once; it doesn't re-lock what follows).
create or replace function app.self_done(s step_status) returns boolean
language sql immutable as $$ select s in ('self_initialed','ap_initialed','leader_initialed','returned') $$;

-- Does this item hold back the items after it?
create or replace function app.blocks_next(s step_status, helper jsonb) returns boolean
language sql immutable as $$
  select not (app.self_done(s) or (coalesce((helper->>'background')::boolean, false) and s <> 'locked'))
$$;

create or replace function app.key_label(k module_key) returns text
language sql immutable as $$
  select case k when 'welcome' then 'Module 0' when 'key_1' then 'Key 1' when 'key_2' then 'Key 2'
    when 'key_3_part_1' then 'Key 3 Part 1' when 'key_3_part_2' then 'Key 3 Part 2' else 'Certification' end
$$;

-- What must be finished before this key opens (for messages).
create or replace function app.prev_key_label(k module_key) returns text
language sql immutable as $$
  select case k when 'key_1' then 'Module 0' when 'key_2' then 'Key 1' when 'key_3_part_1' then 'Key 2'
    when 'key_3_part_2' then 'Key 3 Part 1' when 'certification' then 'Key 3' end
$$;

create or replace function app.videos_done(p_man uuid, p_module uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from videos v
    left join video_progress vp on vp.video_id = v.id and vp.man_id = p_man
    where v.module_id = p_module and vp.watched_at is null)
$$;

-- Is this key open for him? Strictly sequential.
create or replace function app.module_open(p_man uuid, p_key module_key) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_man and status = 'active' and deleted_at is null) then
    return false;
  end if;
  return case p_key
    when 'welcome'       then true
    when 'key_1'         then app.module_done(p_man, 'welcome')
    when 'key_2'         then app.module_done(p_man, 'key_1')
    when 'key_3_part_1'  then app.module_done(p_man, 'key_2')
    -- Key 3's two parts are assignments of one key: Part 2 opens once Part 1 is self-done.
    when 'key_3_part_2'  then app.module_done(p_man, 'key_2') and exists (
        select 1 from step_progress sp join program_steps ps on ps.id = sp.step_id
        join program_modules pm on pm.id = ps.module_id
        where sp.man_id = p_man and pm.key = 'key_3_part_1' and app.self_done(sp.status))
    when 'certification' then app.module_done(p_man, 'key_3_part_1') and app.module_done(p_man, 'key_3_part_2')
    else false end;
end $$;

-- Why is this item locked? NULL when it isn't.
create or replace function app.lock_reason(p_sp uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare r record; b record;
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).status <> 'locked' then return null; end if;
  if not app.module_open((r.sp).man_id, r.mkey) then
    return 'Finish ' || app.prev_key_label(r.mkey) || ' first.';
  end if;
  if r.mkey = 'key_1' and (r.ps).helper->>'type' = 'worksheet'
     and not app.videos_done((r.sp).man_id, (r.ps).module_id) then
    return 'Watch the 3 videos first.';
  end if;
  select ps.item_number, ps.title into b
    from program_steps ps
    left join step_progress sp on sp.step_id = ps.id and sp.man_id = (r.sp).man_id
   where ps.module_id = (r.ps).module_id and ps.order_no < (r.ps).order_no
     and app.blocks_next(coalesce(sp.status, 'locked'), ps.helper)
   order by ps.order_no limit 1;
  if b.title is not null then
    return 'Finish ' || coalesce('#' || b.item_number, 'the ' || b.title) || ' first.';
  end if;
  return 'This item is locked.';
end $$;

-- ───────────────────────── unlocking ─────────────────────────
create or replace function app.refresh_program(p_man uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ev jsonb := '[]';
  m record;
  s record;
  st program_stage;
  old_stage program_stage;
  was_open boolean;
  blocked boolean;
  opened int;
  cur step_status;
begin
  if not exists (select 1 from profiles where id = p_man and status = 'active') then return ev; end if;
  perform app.ensure_progress(p_man);
  select stage into old_stage from profiles where id = p_man;

  for m in select * from program_modules order by order_no loop
    continue when not app.module_open(p_man, m.key);
    was_open := exists (select 1 from step_progress sp join program_steps ps on ps.id = sp.step_id
                        where sp.man_id = p_man and ps.module_id = m.id and sp.status <> 'locked');
    blocked := false;
    opened := 0;
    for s in select sp.id, sp.status, ps.helper from step_progress sp
               join program_steps ps on ps.id = sp.step_id
              where sp.man_id = p_man and ps.module_id = m.id order by ps.order_no loop
      cur := s.status;
      if cur = 'locked' and not blocked
         and not (m.key = 'key_1' and s.helper->>'type' = 'worksheet' and not app.videos_done(p_man, m.id)) then
        update step_progress set status = 'open', updated_at = now() where id = s.id;
        cur := 'open';
        opened := opened + 1;
      end if;
      if app.blocks_next(cur, s.helper) then blocked := true; end if;
    end loop;
    -- One email per key, when it first opens (Key 1 is announced below: its first
    -- assignments are the videos, not a step).
    if opened > 0 and not was_open and m.key <> 'key_1' then
      ev := ev || jsonb_build_object('type','module_unlocked','man_id',p_man,'module',m.key,'title',m.title);
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
  if old_stage = 'module_0' and st <> 'module_0' then
    ev := ev || (select jsonb_build_object('type','module_unlocked','man_id',p_man,'module','key_1','title',title)
                 from program_modules where key = 'key_1');
  end if;
  update profiles set stage = st where id = p_man and stage is distinct from st;
  return ev;
end $$;

-- ───────────────────────── videos: in order, and only in an open key ─────────────────────────
create or replace function app.guard_video_progress() returns trigger
language plpgsql security definer set search_path = public as $$
declare v videos; k module_key; prev text;
begin
  select * into v from videos where id = new.video_id;
  select key into k from program_modules where id = v.module_id;
  if not app.module_open(new.man_id, k) then
    perform app.fail('Finish ' || app.prev_key_label(k) || ' first.');
  end if;
  -- Video N opens once Video N-1 is checked off.
  select v2.title into prev from videos v2
    left join video_progress vp on vp.video_id = v2.id and vp.man_id = new.man_id
   where v2.module_id = v.module_id and v2.order_no < v.order_no and vp.watched_at is null
   order by v2.order_no limit 1;
  if prev is not null then perform app.fail('Watch ' || prev || ' first.'); end if;
  -- No un-checking once he has moved past it.
  if tg_op = 'UPDATE' and old.watched_at is not null and new.watched_at is null then
    if exists (select 1 from videos v2 join video_progress vp on vp.video_id = v2.id and vp.man_id = new.man_id
               where v2.module_id = v.module_id and v2.order_no > v.order_no and vp.watched_at is not null)
       or (k = 'key_1' and exists (select 1 from step_progress sp join program_steps ps on ps.id = sp.step_id
               where sp.man_id = new.man_id and ps.module_id = v.module_id and app.self_done(sp.status))) then
      perform app.fail('This video stays checked — you have already moved past it.');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists video_progress_guard on video_progress;
create trigger video_progress_guard before insert or update on video_progress
  for each row execute function app.guard_video_progress();

create or replace function app.after_video_progress() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.watched_at is distinct from old.watched_at then
    perform app.refresh_program(new.man_id);   -- may open the next assignment
  end if;
  return null;
end $$;
drop trigger if exists video_progress_refresh on video_progress;
create trigger video_progress_refresh after insert or update on video_progress
  for each row execute function app.after_video_progress();

-- ───────────────────────── clear refusals on locked items ─────────────────────────
create or replace function app.guard_worksheet_answer() returns trigger
language plpgsql security definer set search_path = public as $$
declare sp_id uuid; st step_status;
begin
  new.updated_at := now();
  select sp.id, sp.status into sp_id, st from worksheet_questions q
    join program_steps ps on ps.module_id = q.module_id and ps.helper->>'type' = 'worksheet'
    join step_progress sp on sp.step_id = ps.id and sp.man_id = new.man_id
   where q.id = new.question_id;
  if st = 'locked' then
    perform app.fail(coalesce(app.lock_reason(sp_id), 'This worksheet is locked.'));
  end if;
  if st is null or st not in ('open','returned') then
    perform app.fail('This worksheet is locked right now (not open, or already initialed).');
  end if;
  return new;
end $$;

create or replace function public.add_submission(p_sp uuid, p_body text, p_file_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v int; sub_id uuid;
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).man_id <> auth.uid() or not app.is_active() then perform app.fail('Not your step'); end if;
  if (r.sp).status = 'locked' then perform app.fail(coalesce(app.lock_reason(p_sp), 'This item is locked.')); end if;
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
      'step', (r.ps).title, 'item', (r.ps).item_number, 'step_id', (r.ps).id)));
end $$;

create or replace function public.next_submission_version(p_sp uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).man_id <> auth.uid() then perform app.fail('Not your step'); end if;
  if (r.sp).status = 'locked' then perform app.fail(coalesce(app.lock_reason(p_sp), 'This item is locked.')); end if;
  return coalesce((select max(version) from submissions where step_progress_id = p_sp), 0) + 1;
end $$;

create or replace function public.initial_self(p_sp uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; missing int[]; snap jsonb; since timestamptz; ev jsonb := '[]';
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).man_id <> auth.uid() or not app.is_active() then
    perform app.fail('You can only initial your own items.');
  end if;
  if (r.sp).status = 'locked' then perform app.fail(coalesce(app.lock_reason(p_sp), 'This item is locked.')); end if;
  if (r.sp).status not in ('open','returned') then perform app.fail('This item is not open for your initials.'); end if;
  since := coalesce((r.sp).returned_at, '-infinity'::timestamptz);

  -- Key 1 worksheet and AP step: all 3 videos first.
  if r.mkey = 'key_1' and ((r.ps).gate_type = 'self_ap' or (r.ps).helper->>'type' = 'worksheet') then
    if not app.videos_done(auth.uid(), (r.ps).module_id) then
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
  ev := ev || app.refresh_program(auth.uid());   -- opens his next assignment
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

-- For item pages: why an item is locked (anyone who may read his program).
create or replace function public.step_lock_reason(p_sp uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare man uuid;
begin
  select man_id into man from step_progress where id = p_sp;
  if man is null or not app.can_read_man(man) then return null; end if;
  return app.lock_reason(p_sp);
end $$;
revoke all on function public.step_lock_reason(uuid) from public, anon;
grant execute on function public.step_lock_reason(uuid) to authenticated;

-- Internal helpers stay member-proof (0004/0006).
revoke execute on function app.self_done(step_status), app.blocks_next(step_status, jsonb),
  app.key_label(module_key), app.prev_key_label(module_key), app.videos_done(uuid, uuid),
  app.module_open(uuid, module_key), app.lock_reason(uuid),
  app.guard_video_progress(), app.after_video_progress()
  from public, anon, authenticated;

-- ───────────────────────── existing progress ─────────────────────────
-- Re-lock only items he never touched (no initials, turn-ins, uploads or
-- worksheet answers), then let the new rules open exactly what he has earned.
-- Anything he already initialed, typed or uploaded keeps its status.
create or replace function app.resequence_progress() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update step_progress sp set status = 'locked', updated_at = now()
    from program_steps ps
   where ps.id = sp.step_id and sp.status = 'open'
     and sp.self_initialed_at is null and sp.returned_at is null
     and not exists (select 1 from submissions s where s.step_progress_id = sp.id)
     and not (ps.helper->>'type' = 'worksheet' and exists (
           select 1 from worksheet_answers a join worksheet_questions q on q.id = a.question_id
            where a.man_id = sp.man_id and q.module_id = ps.module_id and coalesce(trim(a.answer), '') <> ''));
  get diagnostics n = row_count;
  perform app.refresh_program(id) from profiles where status = 'active' and deleted_at is null;
  return n;
end $$;
revoke execute on function app.resequence_progress() from public, anon, authenticated;
select app.resequence_progress();
