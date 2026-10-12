-- Finally Free Fellowship — newcomer/sobriety app
-- 0001: types and tables. RLS + policies live in 0002, gate functions in 0003.

-- gen_random_uuid() is built into Postgres 13+; no extension needed.

-- ───────────────────────── enums ─────────────────────────
create type user_role       as enum ('pending','newcomer','ap_sponsor','leader','admin');
create type member_status   as enum ('pending','active','inactive');
create type program_stage   as enum ('module_0','key_1','key_2','key_3','certification_review','certified','ministry_eligible');
create type rel_type        as enum ('ap','sponsor','temp_sponsor');
create type rel_status      as enum ('offered','accepted','active','ended');
create type match_type      as enum ('ap','sponsor');
create type match_status    as enum ('open','offered','pending_leader','matched','closed');
create type offer_status    as enum ('offered','accepted','declined','withdrawn');
create type module_key      as enum ('welcome','key_1','key_2','key_3_part_1','key_3_part_2','certification');
create type gate_type       as enum ('self','self_ap','triple','leader');
create type step_status     as enum ('locked','open','self_initialed','ap_initialed','leader_initialed','returned');
create type milestone_type  as enum ('detox21_certified','keys_complete','fellowship_certified','certified_another','ministry_eligible');

-- ───────────────────────── people ─────────────────────────
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  first_name          text not null,
  display_name        text,
  email               text not null,
  phone               text,
  signal              text,
  timezone            text not null default 'America/Chicago',
  country             text,
  city                text,
  role                user_role not null default 'pending',
  status              member_status not null default 'pending',
  sobriety_start_date date,
  program_start_date  date,
  primary_leader_id   uuid references profiles(id) on delete set null,
  stage               program_stage not null default 'module_0',
  home_group          text,
  service_position    text,
  heard_about         text,
  email_prefs         jsonb not null default '{}'::jsonb,   -- {"weekly_summary":false,...}; safety emails ignore prefs
  last_active_at      timestamptz not null default now(),
  deleted_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- Spec: profiles.intake_reason is leader-only. Kept in its own table so no
-- member query (select *) can ever pull it by accident.
create table profile_intake (
  profile_id    uuid primary key references profiles(id) on delete cascade,
  intake_reason text,
  created_at    timestamptz not null default now()
);

create table contact_sharing (
  profile_id        uuid primary key references profiles(id) on delete cascade,
  share_phone       boolean not null default false,
  share_signal      boolean not null default false,
  share_city        boolean not null default false,
  directory_opt_in  boolean not null default false,
  panic_recipients  jsonb not null default '[]'::jsonb      -- array of profile ids
);

create table relationships (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references profiles(id) on delete cascade,
  mentee_id    uuid not null references profiles(id) on delete cascade,
  type         rel_type not null,
  -- AP pairs are peers: one row with mutual = true gives both men AP rights.
  mutual       boolean not null default false,
  status       rel_status not null default 'offered',
  confirmed_by uuid references profiles(id),
  match_request_id uuid,
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz not null default now(),
  check (mentor_id <> mentee_id)
);
create index on relationships (mentee_id) where status = 'active';
create index on relationships (mentor_id) where status = 'active';

create table match_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references profiles(id) on delete cascade,
  type          match_type not null,
  timezone      text,
  best_times    text,
  contact_pref  text,
  notes         text,          -- leader + matched man only
  status        match_status not null default 'open',
  matched_mentor_id uuid references profiles(id),
  created_at    timestamptz not null default now()
);

create table match_offers (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references match_requests(id) on delete cascade,
  offerer_id  uuid not null references profiles(id) on delete cascade,
  status      offer_status not null default 'offered',
  created_at  timestamptz not null default now(),
  unique (request_id, offerer_id)
);

-- ───────────────────────── program content ─────────────────────────
create table program_modules (
  id          uuid primary key default gen_random_uuid(),
  key         module_key not null unique,
  order_no    int not null unique,
  title       text not null,
  description text,
  source_doc  text
);

create table videos (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references program_modules(id) on delete cascade,
  order_no     int not null,
  title        text not null,
  video_url    text,             -- members only
  duration_sec int,
  unique (module_id, order_no)
);

create table program_steps (
  id              uuid primary key default gen_random_uuid(),
  module_id       uuid not null references program_modules(id) on delete cascade,
  order_no        int not null,
  item_number     int,
  title           text not null,
  description     text,          -- verbatim from source doc
  turn_in         boolean not null default false,   -- orange
  gate_type       gate_type not null,
  requires_upload boolean not null default false,
  due_day         int,
  helper          jsonb,
  unique (module_id, order_no)
);

create table worksheet_questions (
  id              uuid primary key default gen_random_uuid(),
  module_id       uuid not null references program_modules(id) on delete cascade,
  order_no        int not null,
  timestamp_label text,
  prompt          text not null,
  answer_slots    int not null default 1,
  unique (module_id, order_no)
);

-- ───────────────────────── a man's progress ─────────────────────────
create table video_progress (
  id         uuid primary key default gen_random_uuid(),
  man_id     uuid not null references profiles(id) on delete cascade,
  video_id   uuid not null references videos(id) on delete cascade,
  watched_at timestamptz,
  notes      text,
  unique (man_id, video_id)
);

create table worksheet_answers (
  id          uuid primary key default gen_random_uuid(),
  man_id      uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references worksheet_questions(id) on delete cascade,
  slot        int not null default 1,
  answer      text,
  updated_at  timestamptz not null default now(),
  unique (man_id, question_id, slot)
);

create table step_progress (
  id                  uuid primary key default gen_random_uuid(),
  man_id              uuid not null references profiles(id) on delete cascade,
  step_id             uuid not null references program_steps(id) on delete cascade,
  status              step_status not null default 'locked',
  self_initialed_at   timestamptz,
  ap_initial_by       uuid references profiles(id),
  ap_initialed_at     timestamptz,
  leader_initial_by   uuid references profiles(id),
  leader_initialed_at timestamptz,
  returned_at         timestamptz,
  returned_by         uuid references profiles(id),
  review_note         text,
  read_to_group       boolean not null default false,
  updated_at          timestamptz not null default now(),
  unique (man_id, step_id)
);
create index on step_progress (status, updated_at);

create table meetings (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  day_of_week          int not null check (day_of_week between 0 and 6),  -- 0 = Sunday, UTC
  start_time_utc       time not null,
  tagline              text,
  beginner             boolean not null default false,
  zoom_url             text,
  zoom_id              text,
  zoom_password        text,
  secretary_first_name text,
  active               boolean not null default true
);

create table meeting_link_joins (
  id         uuid primary key default gen_random_uuid(),
  man_id     uuid not null references profiles(id) on delete cascade,
  meeting_id uuid not null references meetings(id) on delete cascade,
  joined_at  timestamptz not null default now()
);

create table submissions (
  id               uuid primary key default gen_random_uuid(),
  step_progress_id uuid not null references step_progress(id) on delete cascade,
  man_id           uuid not null references profiles(id) on delete cascade,
  body_text        text,
  file_path        text,   -- storage: submissions/{man_id}/{step_id}/{version}/{filename}
  version          int not null,
  created_at       timestamptz not null default now(),
  unique (step_progress_id, version)
);

create table milestones (
  id             uuid primary key default gen_random_uuid(),
  man_id         uuid not null references profiles(id) on delete cascade,
  type           milestone_type not null,
  awarded_by     uuid references profiles(id),
  awarded_at     timestamptz not null default now(),
  related_man_id uuid references profiles(id)
);
create unique index milestones_once on milestones (man_id, type) where type <> 'certified_another';

create table meeting_logs (
  id         uuid primary key default gen_random_uuid(),
  man_id     uuid not null references profiles(id) on delete cascade,
  date       date not null,
  meeting_id uuid references meetings(id) on delete set null,
  other_name text,
  location   text,
  notes      text,
  counts_90  boolean not null default true,
  created_at timestamptz not null default now()
);

create table journal_entries (
  id                  uuid primary key default gen_random_uuid(),
  man_id              uuid not null references profiles(id) on delete cascade,
  meeting_id          uuid references meetings(id) on delete set null,
  body                text not null,
  key_insight         text,
  shared_with_mentors boolean not null default false,
  created_at          timestamptz not null default now()
);

create table fishing_contacts (
  id         uuid primary key default gen_random_uuid(),
  man_id     uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  slot       int not null check (slot between 1 and 3),
  name       text not null,
  method     text,
  note       text,
  unique (man_id, week_start, slot)
);

create table panic_events (
  id         uuid primary key default gen_random_uuid(),
  man_id     uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  recipients jsonb not null default '[]'::jsonb
);

create table leader_notes (
  id         uuid primary key default gen_random_uuid(),
  man_id     uuid not null references profiles(id) on delete cascade,
  leader_id  uuid not null references profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);

create table sobriety_resets (
  id         uuid primary key default gen_random_uuid(),
  man_id     uuid not null references profiles(id) on delete cascade,
  old_date   date,
  new_date   date not null,
  created_at timestamptz not null default now()
);

create table email_log (
  id       uuid primary key default gen_random_uuid(),
  to_id    uuid references profiles(id) on delete set null,
  template text not null,
  sent_at  timestamptz not null default now(),
  meta     jsonb not null default '{}'::jsonb
);
create index on email_log (to_id, template);

create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  action       text not null,
  target_table text,
  target_id    uuid,
  detail       jsonb,
  at           timestamptz not null default now()
);

create table app_settings (
  key   text primary key,
  value jsonb not null
);
insert into app_settings values
  ('purge_submissions_after_days', '30'),
  ('panic_rate_limit', '{"max":3,"window_minutes":10}');

create table rate_limits (
  key        text not null,
  hit_at     timestamptz not null default now()
);
create index on rate_limits (key, hit_at);
