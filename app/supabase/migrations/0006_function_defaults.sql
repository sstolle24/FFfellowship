-- 0006: New functions start with no API access (independent retest, Oct 2026).
-- Supabase grants anon/authenticated EXECUTE on every new function the
-- postgres role creates in public, and Postgres itself grants EXECUTE to
-- PUBLIC (which every role inherits). Every function so far revokes these
-- and grants explicitly; this makes that the default for later ones too.

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;

-- PUBLIC's EXECUTE is a global default, and per-schema default privileges can
-- only add to global ones, so the line above can't remove it on its own.
-- This applies to every schema postgres creates functions in (public, app):
-- future migrations grant EXECUTE explicitly, as 0002/0003 already do.
alter default privileges for role postgres revoke execute on functions from public;
