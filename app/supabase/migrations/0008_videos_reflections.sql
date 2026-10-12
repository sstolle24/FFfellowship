-- 0008: Videos, Key 1 reflections (Steven, Oct 2026).
--   * videos.passcode. URL + passcode are entered by leaders in the app and are
--     never in the repo. Members can read them only for their own unlocked
--     videos (public.video_links); the columns aren't selectable directly.
--   * Key 3's movie is "My Name Is Bill W."; the Part 1 worksheet waits for it,
--     like the Key 1 worksheet waits for the 3 videos.
--   * Key 1 reflections: a one-page reflection (text and/or a file) per video,
--     required before that video counts as done. Same visibility as turn-ins
--     (himself, his active AP/sponsor, leaders); leaders get the turn-in email.
--   * All video saves go through public.save_video (one path, one set of rules).

-- ───────────────────────── schema ─────────────────────────
alter table videos add column if not exists passcode text;
alter table video_progress add column if not exists reflection text;
alter table video_progress add column if not exists reflection_file_path text;
alter table video_progress add column if not exists reflection_at timestamptz;

update videos set title = 'My Name Is Bill W.' where title like 'Bill W. movie%';

-- Links and passcodes: not selectable by members (column privileges).
revoke select on videos from authenticated;
grant select (id, module_id, order_no, title, duration_sec) on videos to authenticated;

-- Video progress: read as before (RLS vp_read = himself, active AP/sponsor, leaders);
-- writes only through save_video.
revoke insert, update on video_progress from authenticated;
drop policy if exists vp_write on video_progress;
drop policy if exists vp_update on video_progress;

-- ───────────────────────── helpers ─────────────────────────
create or replace function app.videos_first(p_module uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when count(*) = 1 then 'Watch "' || min(title) || '" first.'
              else 'Watch the ' || count(*) || ' videos first.' end
  from videos where module_id = p_module
$$;

-- Is this video open to the man: its key is open and every earlier video in it is done?
create or replace function app.video_unlocked(p_man uuid, p_video uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from videos v join program_modules pm on pm.id = v.module_id
     where v.id = p_video and app.module_open(p_man, pm.key)
       and not exists (select 1 from videos v2
             left join video_progress vp on vp.video_id = v2.id and vp.man_id = p_man
             where v2.module_id = v.module_id and v2.order_no < v.order_no and vp.watched_at is null))
$$;

-- Storage policy helper (runs as the caller, so it only answers for himself).
create or replace function app.my_video_unlocked(p_video text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_video ~ '^[0-9a-f-]{36}$' and app.is_active() and app.video_unlocked(auth.uid(), p_video::uuid)
$$;


-- ───────────────────────── sequencing: Key 3's worksheet waits for the movie ─────────────────────────
-- (Key 3 now announces itself on the stage change, like Key 1: its first assignment is the movie.)
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
         and not (s.helper->>'type' = 'worksheet' and not app.videos_done(p_man, m.id)) then
        update step_progress set status = 'open', updated_at = now() where id = s.id;
        cur := 'open';
        opened := opened + 1;
      end if;
      if app.blocks_next(cur, s.helper) then blocked := true; end if;
    end loop;
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
declare r record; b record;
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).status <> 'locked' then return null; end if;
  if not app.module_open((r.sp).man_id, r.mkey) then
    return 'Finish ' || app.prev_key_label(r.mkey) || ' first.';
  end if;
  if (r.ps).helper->>'type' = 'worksheet' and not app.videos_done((r.sp).man_id, (r.ps).module_id) then
    return app.videos_first((r.ps).module_id);
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

-- ───────────────────────── video guard: + reflections ─────────────────────────
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
  -- Key 1 reflections: his own folder only; required before the video counts as done.
  if new.reflection_file_path is not null
     and new.reflection_file_path not like format('%s/%s/%%', new.man_id, new.video_id) then
    perform app.fail('Upload path does not match this video.');
  end if;
  if tg_op = 'INSERT' or new.reflection is distinct from old.reflection
     or new.reflection_file_path is distinct from old.reflection_file_path then
    new.reflection_at := case when coalesce(trim(new.reflection), '') = '' and new.reflection_file_path is null
                              then null else now() end;
  end if;
  if k = 'key_1' and new.watched_at is not null
     and coalesce(trim(new.reflection), '') = '' and new.reflection_file_path is null then
    perform app.fail('Write your one-page reflection (or upload it) before checking off ' || v.title || '.');
  end if;
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

-- ───────────────────────── member API ─────────────────────────
-- His own unlocked videos' links and passcodes. Nothing for locked videos,
-- pending/inactive members or anon.
create or replace function public.video_links()
returns table (video_id uuid, video_url text, passcode text)
language sql stable security definer set search_path = public as $$
  select v.id, v.video_url, v.passcode from videos v
   where auth.uid() is not null and app.is_active() and app.video_unlocked(auth.uid(), v.id)
$$;

-- Notes, reflection and the "watched" check for one video (his own).
-- A NULL argument keeps what is saved; '' clears text.
create or replace function public.save_video(p_video uuid, p_notes text, p_reflection text,
  p_file_path text, p_watched boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v videos; k module_key; old video_progress; cur video_progress; ev jsonb := '[]';
begin
  if auth.uid() is null or not app.is_active() then perform app.fail('Your account must be approved first.'); end if;
  select * into v from videos where id = p_video;
  if v.id is null then perform app.fail('Video not found.'); end if;
  select key into k from program_modules where id = v.module_id;
  if not app.video_unlocked(auth.uid(), p_video) then
    perform app.fail(coalesce((select 'Watch ' || v2.title || ' first.' from videos v2
        left join video_progress vp on vp.video_id = v2.id and vp.man_id = auth.uid()
       where v2.module_id = v.module_id and v2.order_no < v.order_no and vp.watched_at is null
       order by v2.order_no limit 1), 'Finish ' || app.prev_key_label(k) || ' first.'));
  end if;
  select * into old from video_progress where man_id = auth.uid() and video_id = p_video;

  insert into video_progress as vp (man_id, video_id, notes, reflection, reflection_file_path, watched_at)
  values (auth.uid(), p_video,
          case when p_notes is null then old.notes else left(p_notes, 10000) end,
          case when p_reflection is null then old.reflection else left(nullif(trim(p_reflection), ''), 20000) end,
          coalesce(p_file_path, old.reflection_file_path),
          case when p_watched is null then old.watched_at when p_watched then coalesce(old.watched_at, now()) end)
  on conflict (man_id, video_id) do update set
    notes = excluded.notes, reflection = excluded.reflection,
    reflection_file_path = excluded.reflection_file_path, watched_at = excluded.watched_at
  returning * into cur;

  if k = 'key_1' and cur.reflection_at is not null and cur.reflection_at is distinct from old.reflection_at then
    perform app.audit('reflection_saved', 'video_progress', cur.id, jsonb_build_object('video', v.title));
    ev := ev || jsonb_build_object('type','turn_in_submitted','man_id',auth.uid(),
                                   'step', v.title || ' reflection', 'item', null);
  end if;
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

-- ───────────────────────── leader API ─────────────────────────
create or replace function public.leader_list_videos()
returns table (id uuid, module_key module_key, module_title text, order_no int, title text, video_url text, passcode text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  return query select v.id, pm.key, pm.title, v.order_no, v.title, v.video_url, v.passcode
    from videos v join program_modules pm on pm.id = v.module_id order by pm.order_no, v.order_no;
end $$;

create or replace function public.leader_set_video(p_video uuid, p_url text, p_passcode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u text := nullif(trim(p_url), '');
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  if u is not null and u !~* '^https://[^\s]+$' then perform app.fail('The link must start with https://'); end if;
  update videos set video_url = u, passcode = left(nullif(trim(p_passcode), ''), 100) where id = p_video;
  if not found then perform app.fail('Video not found.'); end if;
  -- The passcode itself is never written to the audit log.
  perform app.audit('video_link_set', 'videos', p_video, jsonb_build_object('has_link', u is not null,
    'has_passcode', nullif(trim(p_passcode), '') is not null));
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

-- ───────────────────────── uploads: reflection files ─────────────────────────
-- {his id}/{a step open/returned for him}/{n}/{file}   (turn-ins, as before)
-- {his id}/{a Key 1 video open to him}/{n}/{file}       (reflections)
drop policy if exists sub_obj_insert on storage.objects;
create policy sub_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions'
              and array_length(storage.foldername(name), 1) = 3
              and (storage.foldername(name))[1] = auth.uid()::text
              and (storage.foldername(name))[3] ~ '^[0-9]{1,6}$'
              and app.is_active()
              and (exists (select 1 from step_progress sp
                           where sp.man_id = auth.uid()
                             and sp.step_id::text = (storage.foldername(name))[2]
                             and sp.status in ('open','returned'))
                   or app.my_video_unlocked((storage.foldername(name))[2])));

-- ───────────────────────── grants ─────────────────────────
revoke all on function public.video_links(), public.save_video(uuid, text, text, text, boolean),
  public.leader_list_videos(), public.leader_set_video(uuid, text, text) from public, anon;
grant execute on function public.video_links(), public.save_video(uuid, text, text, text, boolean),
  public.leader_list_videos(), public.leader_set_video(uuid, text, text) to authenticated;
revoke execute on function app.videos_first(uuid), app.video_unlocked(uuid, uuid) from public, anon, authenticated;
revoke execute on function app.my_video_unlocked(text) from public, anon;
grant execute on function app.my_video_unlocked(text) to authenticated;   -- used by the storage policy

-- Men already in Key 3 with an untouched Part 1 worksheet: it now waits for the movie.
select app.resequence_progress();
