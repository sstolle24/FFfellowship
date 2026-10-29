-- 0013: Key 2's 21 items open together (Steven, Oct 2026).
-- Key 2 no longer opens one item at a time. When Key 2 opens, every item opens
-- at once and he works them in any order. The one exception is #20, "AP reviews
-- your 21 (cover sheet)": it opens once he has done his part of every other
-- item (background items such as the 90 in 90 count once they're under way),
-- and it still needs every turn-in before he can initial it.
-- His AP is emailed once, when he initials #20, instead of for every item (and
-- again only for an item the AP returned and he fixed). The AP and leader
-- columns are unchanged: Key 2 still completes only when every item is signed.
-- Keys stay strictly in order, and Key 1 / Key 3 keep their order inside.

create or replace function app.opens_together(k module_key) returns boolean
language sql immutable as $$ select k = 'key_2' $$;

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
  n int;
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
      if cur = 'locked' and not (blocked and not app.opens_together(m.key))
         and not (s.helper->>'type' = 'worksheet' and not app.videos_done(p_man, m.id))
         and not (s.helper->>'type' is not distinct from 'cover_sheet' and app.opens_together(m.key)) then
        update step_progress set status = 'open', updated_at = now() where id = s.id;
        cur := 'open';
        opened := opened + 1;
      end if;
      if app.blocks_next(cur, s.helper) then blocked := true; end if;
    end loop;
    -- Key 2: the AP review (#20 cover sheet) opens once his part of every other item is
    -- done, or under way for a background item.
    if app.opens_together(m.key) then
      update step_progress sp set status = 'open', updated_at = now()
        from program_steps ps
       where ps.id = sp.step_id and sp.man_id = p_man and ps.module_id = m.id
         and sp.status = 'locked' and ps.helper->>'type' = 'cover_sheet'
         and not exists (select 1 from step_progress sp2 join program_steps ps2 on ps2.id = sp2.step_id
                          where sp2.man_id = p_man and ps2.module_id = m.id and ps2.id <> ps.id
                            and app.blocks_next(sp2.status, ps2.helper));
      get diagnostics n = row_count;
      opened := opened + n;
    end if;
    -- One email per key, when it first opens (Key 1 is announced below: its first
    -- assignments are the videos, not a step).
    if opened > 0 and not was_open and m.key not in ('key_1', 'key_3_part_1') then
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
  -- Keys whose first assignment is a video open with the stage change, not a step.
  if old_stage = 'module_0' and st <> 'module_0' then
    ev := ev || (select jsonb_build_object('type','module_unlocked','man_id',p_man,'module','key_1','title',title)
                 from program_modules where key = 'key_1');
  end if;
  if old_stage in ('module_0','key_1','key_2') and st not in ('module_0','key_1','key_2') then
    ev := ev || (select jsonb_build_object('type','module_unlocked','man_id',p_man,'module','key_3_part_1','title',title)
                 from program_modules where key = 'key_3_part_1');
  end if;
  update profiles set stage = st where id = p_man and stage is distinct from st;
  return ev;
end $$;

create or replace function app.lock_reason(p_sp uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare r record; b record; todo text;
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).status <> 'locked' then return null; end if;
  if not app.module_open((r.sp).man_id, r.mkey) then
    return 'Finish ' || app.prev_key_label(r.mkey) || ' first.';
  end if;
  if (r.ps).helper->>'type' = 'worksheet' and not app.videos_done((r.sp).man_id, (r.ps).module_id) then
    return app.videos_first((r.ps).module_id);
  end if;
  if app.opens_together(r.mkey) then
    select string_agg('#' || ps.item_number, ', ' order by ps.order_no) into todo
      from program_steps ps
      join step_progress sp on sp.step_id = ps.id and sp.man_id = (r.sp).man_id
     where ps.module_id = (r.ps).module_id and ps.id <> (r.ps).id
       and app.blocks_next(sp.status, ps.helper);
    if todo is not null then return 'Finish your part of ' || todo || ' first.'; end if;
    return 'This item is locked.';
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

  -- Key 1 worksheet + AP step, Key 3 Part 1 worksheet: the key's videos first.
  if ((r.ps).helper->>'type' = 'worksheet' or (r.mkey = 'key_1' and (r.ps).gate_type = 'self_ap'))
     and not app.videos_done(auth.uid(), (r.ps).module_id) then
    perform app.fail(case when r.mkey = 'key_1' then 'Check off all 3 videos first.' else app.videos_first((r.ps).module_id) end);
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

  -- Key 2: his AP reviews all 21 together at the cover sheet (#20), so the AP is told then,
  -- and otherwise only when he re-initials an item the AP returned.
  if (r.ps).gate_type in ('self_ap','triple')
     and (not app.opens_together(r.mkey) or (r.ps).helper->>'type' = 'cover_sheet' or (r.sp).status = 'returned') then
    ev := ev || jsonb_build_object('type','ap_signoff_needed','man_id',auth.uid(),'step',(r.ps).title,
                                   'item',(r.ps).item_number,'step_id',(r.ps).id);
  elsif (r.ps).gate_type = 'leader' then
    ev := ev || jsonb_build_object('type','leader_review_needed','man_id',auth.uid(),'step',(r.ps).title,
                                   'step_id',(r.ps).id);
  end if;
  ev := ev || app.refresh_program(auth.uid());   -- opens his next assignment (Key 2: the AP review)
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

revoke execute on function app.opens_together(module_key) from public, anon, authenticated;

-- Men already in Key 2: open the rest of their items now.
select count(app.refresh_program(id)) from profiles where status = 'active' and deleted_at is null;
