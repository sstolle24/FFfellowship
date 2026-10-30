-- 0014: Admin "Unlock Key 2" for a man with no AP (Oct 2026).
-- One button on his page in the Leader area. It finishes Module 0 and Key 1 for
-- him as a recorded admin override: videos checked (his own reflections are
-- kept; missing ones note the override), Fishing worksheet initialed, and the
-- AP go-over signed in the AP column by the admin as an override. Then the app
-- opens Key 2 as usual and emails him. Anything he already did is left as is.
-- Only for a man with no active AP or sponsor; his AP signs Key 1 otherwise.

create or replace function public.admin_unlock_key2(p_man uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  note constant text := 'Admin unlocked Key 2 (no AP).';
  ev jsonb;
begin
  if not app.is_admin() then perform app.fail('Only an admin can unlock Key 2.'); end if;
  if p_man = auth.uid() then perform app.fail('Another admin unlocks your own Key 2.'); end if;
  if not exists (select 1 from profiles where id = p_man and status = 'active' and deleted_at is null) then
    perform app.fail('Approve his account first.');
  end if;
  if app.module_done(p_man, 'key_1') then perform app.fail('Key 2 is already open for him.'); end if;
  if app.has_any_mentor(p_man) then
    perform app.fail('He has an AP or sponsor — they sign off Key 1 (or a leader can override the AP sign-off).');
  end if;
  perform app.ensure_progress(p_man);

  -- Module 0
  update step_progress sp set status = 'self_initialed', self_initialed_at = coalesce(sp.self_initialed_at, now()), updated_at = now()
    from program_steps ps join program_modules pm on pm.id = ps.module_id
   where ps.id = sp.step_id and sp.man_id = p_man and pm.key = 'welcome' and sp.status in ('locked', 'open', 'returned');

  -- Key 1 videos, in order (each needs a reflection: his own is kept)
  for v in select vv.id from videos vv join program_modules pm on pm.id = vv.module_id where pm.key = 'key_1' order by vv.order_no loop
    insert into video_progress (man_id, video_id, watched_at, reflection)
      values (p_man, v.id, now(), note)
      on conflict (man_id, video_id) do update
        set watched_at = coalesce(video_progress.watched_at, now()),
            reflection = case when coalesce(trim(video_progress.reflection), '') = '' and video_progress.reflection_file_path is null
                              then excluded.reflection else video_progress.reflection end;
  end loop;

  -- Key 1 Fishing worksheet (his part)
  update step_progress sp set status = 'self_initialed', self_initialed_at = coalesce(sp.self_initialed_at, now()), updated_at = now()
    from program_steps ps join program_modules pm on pm.id = ps.module_id
   where ps.id = sp.step_id and sp.man_id = p_man and pm.key = 'key_1' and ps.helper->>'type' = 'worksheet'
     and sp.status in ('locked', 'open', 'returned');

  -- Key 1 AP go-over: signed in the AP column by the admin, as an override
  update step_progress sp set status = 'ap_initialed', self_initialed_at = coalesce(sp.self_initialed_at, now()),
         ap_initial_by = auth.uid(), ap_initialed_at = now(), ap_override = true, ap_override_reason = note, updated_at = now()
    from program_steps ps join program_modules pm on pm.id = ps.module_id
   where ps.id = sp.step_id and sp.man_id = p_man and pm.key = 'key_1' and ps.gate_type = 'self_ap'
     and sp.status not in ('ap_initialed', 'leader_initialed');

  ev := app.refresh_program(p_man);   -- opens Key 2 and sets his stage
  -- He skipped Key 1, so only the Key 2 email goes out.
  select coalesce(jsonb_agg(e), '[]') into ev from jsonb_array_elements(ev) e where e->>'module' is distinct from 'key_1';
  if not app.module_done(p_man, 'key_1') then perform app.fail('Key 1 could not be completed for him.'); end if;
  perform app.audit('admin_unlock_key2', 'profiles', p_man, jsonb_build_object('note', note));
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

revoke all on function public.admin_unlock_key2(uuid) from public, anon;
grant execute on function public.admin_unlock_key2(uuid) to authenticated;
