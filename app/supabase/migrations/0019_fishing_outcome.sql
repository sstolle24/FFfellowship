-- 0019: Fishing follow-up (Nov 2026).
-- After he reaches out, each of his 3 gets a "how did it go?" note and a
-- reached check, for this week and last week (The Path on Monday goes over
-- last week's). Names stay locked once the week is committed (0009); these
-- two fields can always be filled in. His AP/sponsor and leaders can read them
-- (same read rule as the rest of fishing_contacts).

alter table fishing_contacts add column if not exists outcome text check (char_length(outcome) <= 500);
alter table fishing_contacts add column if not exists reached_at timestamptz;
