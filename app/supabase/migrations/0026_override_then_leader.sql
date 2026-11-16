-- 0026: A leader who overrides the AP sign-off can also give the leader initials (Nov 2026).
-- Before, the leader who signed the AP column (0010 override) had to wait for a
-- different leader. Now he can sign both. A leader who gave AP initials as the
-- man's actual AP still needs a different leader for the leader column.

create or replace function public.initial_leader(p_sp uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; man uuid; ev jsonb := '[]';
begin
  if not app.is_leader() then perform app.fail('Only leaders can give leader initials.'); end if;
  select * into r from app.load_sp(p_sp);
  man := (r.sp).man_id;
  if man = auth.uid() then perform app.fail('You cannot approve your own leader gate.'); end if;
  -- He may give the leader initials after signing the AP column as a leader override
  -- (0026). If he signed it as the man's own AP, a different leader still does.
  if (r.sp).ap_initial_by = auth.uid() and not (r.sp).ap_override then
    perform app.fail('You gave his AP initials, so a different leader gives the leader initials.');
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
