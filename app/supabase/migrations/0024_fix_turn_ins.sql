-- 0024: Members can fix a turn-in themselves (Nov 2026).
--   * Remove a turn-in (file or typed) while the item is open. On a returned
--     item, only what he added since the return; what his AP returned stays.
--   * Undo his own initials while his AP hasn't signed yet: the item goes back
--     to open so he can fix it and initial again.
-- Both are audited. Removing a file's turn-in also lets the server delete the file.

create or replace function public.remove_submission(p_sub uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s submissions; r record;
begin
  select * into s from submissions where id = p_sub;
  if s.id is null or s.man_id <> auth.uid() or not app.is_active() then perform app.fail('Not your turn-in.'); end if;
  select * into r from app.load_sp(s.step_progress_id);
  if (r.sp).status not in ('open', 'returned') then
    perform app.fail('Undo your initials first — then you can remove it.');
  end if;
  if (r.sp).status = 'returned' and s.created_at <= (r.sp).returned_at then
    perform app.fail('This is the version your AP returned — it stays. Turn in a new one instead.');
  end if;
  delete from submissions where id = p_sub;
  perform app.audit('submission_removed', 'submissions', p_sub,
    jsonb_build_object('step_progress', s.step_progress_id, 'version', s.version, 'had_file', s.file_path is not null));
  return jsonb_build_object('ok', true, 'file_path', s.file_path, 'events', '[]'::jsonb);
end $$;

create or replace function public.withdraw_initial(p_sp uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from app.load_sp(p_sp);
  if (r.sp).man_id <> auth.uid() or not app.is_active() then perform app.fail('You can only undo your own initials.'); end if;
  if (r.sp).status <> 'self_initialed' then
    perform app.fail(case when (r.sp).status in ('ap_initialed', 'leader_initialed')
      then 'Your AP already signed this item — ask your AP or a leader to return it.'
      else 'This item isn''t initialed.' end);
  end if;
  update step_progress set status = case when returned_at is not null then 'returned'::step_status else 'open'::step_status end,
         self_initialed_at = null, updated_at = now()
   where id = p_sp;
  perform app.audit('initial_withdrawn', 'step_progress', p_sp, null);
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

revoke all on function public.remove_submission(uuid), public.withdraw_initial(uuid) from public, anon;
grant execute on function public.remove_submission(uuid), public.withdraw_initial(uuid) to authenticated;
