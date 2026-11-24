-- 0030: Holiday season look (Nov 2026).
-- During the holidays the home page gets a festive banner (light snowfall,
-- a message, and an optional featured video or picture, e.g. Santa talking
-- about the program). The featured item is a public What's Happening item, so
-- its video/picture is uploaded there as usual.
-- mode: 'auto' (Nov 20 – Jan 6, Pacific time), 'on' or 'off'. Admins change it.

insert into app_settings values ('holiday', jsonb_build_object(
  'mode', 'auto',
  'headline', 'Merry Christmas from Finally Free',
  'message', 'The holidays can be the hardest time of year to stay free. You don''t have to do it alone — meetings run every day, including Christmas and New Year''s.',
  'featured_event', null))
on conflict (key) do nothing;

-- Read by the public home page: the setting, and the featured item only if it's public.
create or replace function public.holiday_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mode', coalesce(s.value->>'mode', 'auto'),
    'headline', s.value->>'headline',
    'message', s.value->>'message',
    'featured_event', (select e.id from community_events e
                        where e.id::text = s.value->>'featured_event' and not e.members_only))
  from app_settings s where s.key = 'holiday'
$$;

create or replace function public.admin_set_holiday(p_mode text, p_headline text, p_message text, p_featured uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not app.is_admin() then perform app.fail('Only an admin can change the holiday banner.'); end if;
  if p_mode not in ('auto', 'on', 'off') then perform app.fail('Choose auto, on or off.'); end if;
  if p_featured is not null and not exists (select 1 from community_events where id = p_featured and not members_only) then
    perform app.fail('The featured item must be a public What''s Happening item.');
  end if;
  insert into app_settings values ('holiday', jsonb_build_object(
    'mode', p_mode,
    'headline', left(nullif(trim(coalesce(p_headline, '')), ''), 120),
    'message', left(nullif(trim(coalesce(p_message, '')), ''), 600),
    'featured_event', p_featured))
  on conflict (key) do update set value = excluded.value;
  perform app.audit('holiday_banner_set', 'app_settings', null, jsonb_build_object('mode', p_mode));
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

revoke all on function public.holiday_settings(), public.admin_set_holiday(text, text, text, uuid) from public;
grant execute on function public.holiday_settings() to anon, authenticated;
grant execute on function public.admin_set_holiday(text, text, text, uuid) to authenticated;
