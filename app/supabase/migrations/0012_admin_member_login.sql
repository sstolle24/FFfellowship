-- 0012: Admins help members with sign-in (Oct 2026).
-- An admin can change a member's sign-in email and send him a password reset
-- link (by email, or copied to text him). The sign-in account itself
-- (auth.users) is changed by the server with the service key; these functions
-- check the caller is an admin, keep profiles.email in step, and audit it.

create or replace function public.admin_set_member_email(p_man uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email, ''))); old text;
begin
  if not app.is_admin() then perform app.fail('Only an admin can change a member''s email.'); end if;
  if length(e) > 254 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then perform app.fail('Enter a valid email address.'); end if;
  select email into old from profiles where id = p_man and deleted_at is null;
  if not found then perform app.fail('Member not found.'); end if;
  if lower(coalesce(old, '')) = e then perform app.fail('That is already his email.'); end if;
  if exists (select 1 from profiles where lower(email) = e and id <> p_man) then
    perform app.fail('Another account already uses that email.');
  end if;
  update profiles set email = e where id = p_man;
  perform app.audit('email_changed', 'profiles', p_man, jsonb_build_object('from', old, 'to', e));
  return jsonb_build_object('ok', true, 'old_email', old, 'events', '[]'::jsonb);
end $$;

-- Called before the server makes a reset link: admin check, his email, and the audit entry.
create or replace function public.admin_password_reset(p_man uuid, p_how text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  if not app.is_admin() then perform app.fail('Only an admin can send a password reset.'); end if;
  if p_how not in ('emailed', 'copied') then perform app.fail('Choose email or copy link.'); end if;
  select email into e from profiles where id = p_man and deleted_at is null;
  if e is null then perform app.fail('Member not found.'); end if;
  perform app.audit('password_reset_link', 'profiles', p_man, jsonb_build_object('how', p_how));
  return jsonb_build_object('ok', true, 'email', e, 'events', '[]'::jsonb);
end $$;

revoke all on function public.admin_set_member_email(uuid, text), public.admin_password_reset(uuid, text) from public, anon;
grant execute on function public.admin_set_member_email(uuid, text), public.admin_password_reset(uuid, text) to authenticated;
