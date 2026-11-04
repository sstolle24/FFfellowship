-- 0016: Key 3 opens at 16 of the 21 (Steven, Nov 2026).
-- Key 3 no longer waits for Key 2's certification. It opens once he has done
-- his part (his own initials) of 16 of the 21 Key 2 items, about 76%. Items
-- like the 90 in 90 can take months, so he keeps going in Key 3 while they
-- finish. Key 2 still has to be fully signed off and certified (Detox-21)
-- before the certification packet opens. A returned item doesn't re-lock Key 3.

-- How many of the 21 open Key 3 (one place to change it).
create or replace function app.key3_opens_at() returns int
language sql immutable as $$ select 16 $$;

-- Key 2 items whose part he has done (a returned item counts: it was done once).
create or replace function app.key2_self_done(p_man uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from step_progress sp
    join program_steps ps on ps.id = sp.step_id
    join program_modules pm on pm.id = ps.module_id and pm.key = 'key_2'
   where sp.man_id = p_man and app.self_done(sp.status)
$$;

create or replace function app.key3_open(p_man uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.module_done(p_man, 'key_2')
      or (app.module_done(p_man, 'key_1') and app.key2_self_done(p_man) >= app.key3_opens_at())
$$;

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
    when 'key_3_part_1'  then app.key3_open(p_man)
    -- Key 3's two parts are assignments of one key: Part 2 opens once Part 1 is self-done.
    when 'key_3_part_2'  then app.key3_open(p_man) and exists (
        select 1 from step_progress sp join program_steps ps on ps.id = sp.step_id
        join program_modules pm on pm.id = ps.module_id
        where sp.man_id = p_man and pm.key = 'key_3_part_1' and app.self_done(sp.status))
    -- Key 2 must still be finished and certified before the certification packet.
    when 'certification' then app.module_done(p_man, 'key_2')
                              and app.module_done(p_man, 'key_3_part_1') and app.module_done(p_man, 'key_3_part_2')
    else false end;
end $$;

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
    when app.key3_open(p_man)                            then 'key_3'
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
  if r.mkey in ('key_3_part_1', 'key_3_part_2') and not app.key3_open((r.sp).man_id) then
    return 'Finish your part of ' || app.key3_opens_at() || ' of the 21 Key 2 items first ('
           || app.key2_self_done((r.sp).man_id) || ' done so far).';
  end if;
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

revoke execute on function app.key3_opens_at(), app.key2_self_done(uuid), app.key3_open(uuid) from public, anon, authenticated;

-- Men already past 16: open Key 3 now.
select count(app.refresh_program(id)) from profiles where status = 'active' and deleted_at is null;
