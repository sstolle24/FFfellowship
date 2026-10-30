-- 0015: Leaders can deny a sign-up (Oct 2026).
-- A pending sign-up a leader won't approve (spam, wrong place, not a fit) is
-- closed like a deleted account: hidden everywhere at once and purged by the
-- daily job after the usual grace period. The reason stays with leaders
-- (audit log); emailing him a short note is the leader's choice, made in the app.

create or replace function public.deny_member(p_man uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not app.is_leader() then perform app.fail('Leaders only.'); end if;
  update profiles set status = 'inactive', deleted_at = now()
   where id = p_man and status = 'pending' and deleted_at is null;
  if not found then perform app.fail('No pending sign-up with that id.'); end if;
  perform app.audit('member_denied', 'profiles', p_man,
    case when nullif(trim(p_reason), '') is null then null else jsonb_build_object('note', left(trim(p_reason), 500)) end);
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

revoke all on function public.deny_member(uuid, text) from public, anon;
grant execute on function public.deny_member(uuid, text) to authenticated;
