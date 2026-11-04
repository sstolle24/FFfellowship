-- 0018: State / province on profiles (Nov 2026).
-- Entered at sign-up or in Profile; shared in the Directory only when he
-- shares his city and country. Leaders filter Members & Roles by it.

alter table profiles add column if not exists state text;
grant update (state) on profiles to authenticated;

create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}');
begin
  insert into profiles (id, email, first_name, timezone, country, state, city, heard_about, sobriety_start_date)
  values (new.id, new.email,
          coalesce(nullif(trim(meta->>'first_name'),''), 'Brother'),
          coalesce(nullif(meta->>'timezone',''), 'America/Chicago'),
          nullif(meta->>'country',''), nullif(left(trim(meta->>'state'), 60),''), nullif(meta->>'city',''),
          nullif(meta->>'heard_about',''),
          nullif(meta->>'sobriety_start_date','')::date);
  insert into profile_intake (profile_id, intake_reason) values (new.id, nullif(meta->>'intake_reason',''));
  insert into contact_sharing (profile_id) values (new.id);
  return new;
end $$;

-- New column on the end so the view keeps its grants (0005: SELECT only).
create or replace view member_contacts as
  select p.id, p.first_name, p.display_name,
         case when cs.share_phone  then p.phone  end as phone,
         case when cs.share_signal then p.signal end as signal,
         case when cs.share_city   then p.city   end as city,
         case when cs.share_city   then p.country end as country,
         cs.directory_opt_in,
         case when cs.share_city   then p.state  end as state
  from profiles p
  join contact_sharing cs on cs.profile_id = p.id
  where p.status = 'active' and p.deleted_at is null
    and (cs.directory_opt_in or cs.share_phone or cs.share_signal)
    and app.is_active();
