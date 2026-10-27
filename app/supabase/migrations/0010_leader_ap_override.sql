-- 0010: Leaders can override AP authorization (Oct 2026).
-- Any active leader may give the AP-column sign-off on a man's item (Key 1 AP
-- go-over, Key 2, Key 3) when his AP/sponsor can't. A reason is required, the
-- item is marked as a leader override, his AP/sponsor is told, and the
-- two-person rule still holds: the leader who overrode can't also give the
-- leader initials (0004 / M1).

alter table step_progress add column if not exists ap_override boolean not null default false;
alter table step_progress add column if not exists ap_override_reason text;

-- An override belongs to that one sign-off: clear it whenever the AP column is cleared
-- (he re-initials, or the item is returned).
create or replace function app.clear_ap_override() returns trigger
language plpgsql as $$
begin
  if new.ap_initialed_at is null then
    new.ap_override := false;
    new.ap_override_reason := null;
  end if;
  return new;
end $$;
drop trigger if exists step_progress_clear_override on step_progress;
create trigger step_progress_clear_override before update on step_progress
  for each row execute function app.clear_ap_override();

create or replace function public.leader_override_ap(p_sp uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; man uuid; missing int[]; ev jsonb := '[]';
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  if coalesce(trim(p_reason), '') = '' then perform app.fail('Give a reason for overriding the AP sign-off.'); end if;
  select * into r from app.load_sp(p_sp);
  man := (r.sp).man_id;
  if man = auth.uid() then perform app.fail('You cannot sign off your own item.'); end if;
  if (r.ps).gate_type not in ('self_ap','triple') then perform app.fail('This item has no AP column.'); end if;
  if (r.sp).status <> 'self_initialed' then perform app.fail('Waiting on his own initials first.'); end if;

  if (r.ps).helper->>'type' = 'cover_sheet' then
    missing := app.missing_turn_ins(man);
    if cardinality(missing) > 0 then
      perform app.fail('Cover sheet incomplete — turn-ins missing for items: ' || array_to_string(missing, ', '));
    end if;
  end if;

  update step_progress set status = 'ap_initialed', ap_initial_by = auth.uid(), ap_initialed_at = now(),
         ap_override = true, ap_override_reason = left(trim(p_reason), 500), updated_at = now()
   where id = p_sp;
  perform app.audit('ap_override', 'step_progress', p_sp,
    jsonb_build_object('man', man, 'reason', left(trim(p_reason), 500)));

  ev := ev || jsonb_build_object('type','ap_overridden','man_id',man,'leader_id',auth.uid(),
                                 'step',(r.ps).title,'item',(r.ps).item_number,'step_id',(r.ps).id,
                                 'reason',left(trim(p_reason), 500));
  if (r.ps).gate_type = 'triple' then
    ev := ev || jsonb_build_object('type','leader_review_needed','man_id',man,'step',(r.ps).title,
                                   'item',(r.ps).item_number,'step_id',(r.ps).id);
  else
    ev := ev || jsonb_build_object('type','approved','man_id',man,'step',(r.ps).title,'step_id',(r.ps).id);
  end if;
  ev := ev || app.refresh_program(man);
  return jsonb_build_object('ok', true, 'events', ev);
end $$;

revoke all on function public.leader_override_ap(uuid, text) from public, anon;
grant execute on function public.leader_override_ap(uuid, text) to authenticated;
revoke execute on function app.clear_ap_override() from public, anon, authenticated;
