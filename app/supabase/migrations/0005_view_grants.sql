-- 0005: View privileges (independent retest, Oct 2026).
-- Supabase grants anon/authenticated ALL on every new object the postgres
-- role creates in public. For views that meant INSERT/UPDATE/DELETE through
-- a view that runs as its owner (bypassing RLS): anyone could write
-- meetings_public, and an AP/sponsor could update or delete his man's
-- profile through my_men. Views here are read-only, SELECT only.

-- Every view in public: nothing for the API roles, then SELECT where intended.
do $$ declare v text; begin
  for v in select viewname from pg_views where schemaname = 'public' loop
    execute format('revoke all on public.%I from anon, authenticated', v);
  end loop;
end $$;

grant select on public.meetings_public to anon, authenticated;
grant select on public.member_cards, public.member_contacts, public.sponsor_board, public.my_men to authenticated;

-- New tables/views made by postgres in public start with no API access;
-- each migration grants exactly what it needs.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
