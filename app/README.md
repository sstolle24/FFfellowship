# Finally Free Fellowship — newcomer / sobriety app

Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, RLS),
Resend for email, scheduled jobs via Netlify or Vercel cron. This is **only** the
newcomer/sobriety environment — ministry is a separate future site.

The existing single-file site at the repo root keeps running on GitHub Pages; this app
deploys separately from the `app/` folder.

## What's where

| Path | What it is |
|---|---|
| `supabase/migrations/0001_schema.sql` | Tables and enums (spec data model) |
| `supabase/migrations/0002_rls.sql` | RLS on every table, default deny; member-safe views (`meetings_public`, `member_cards`, `member_contacts`, `sponsor_board`, `my_men`); storage policies |
| `supabase/migrations/0003_functions.sql` | **All gates, server-side**: initials, returns, unlocks, milestones, matching, approvals, roles, panic, export/delete. Every approval/return/role/relationship change is audit-logged |
| `supabase/migrations/0004_security_fixes.sql` | Fixes from the Oct 2026 independent security test (links for approved men only, deactivated mentors lose access, member card/contact limits, upload bucket limits, helper grants, …) |
| `supabase/migrations/0005_view_grants.sql` | Views are SELECT-only for the API roles (Supabase grants ALL on new objects by default); new tables/views start with no API access |
| `supabase/migrations/0006_function_defaults.sql` | New functions start with no EXECUTE for anon/authenticated/PUBLIC; each migration grants what it needs |
| `supabase/migrations/0007_sequential_program.sql` | Sequential program: keys in order, assignments in order inside each key, background items, clear "Finish … first" refusals; re-sequences existing progress without undoing anything a man did |
| `supabase/migrations/0008_videos_reflections.sql` | Video passcodes (leader-entered, readable only for a man's own unlocked videos), Key 3 movie gating, Key 1 one-page reflections, single `save_video` path |
| `supabase/seed/build_seed.py` → `seed.sql` | Program content generated **verbatim** from the 10-26 source docs (Key 1 worksheet, The 21, Bill's Story Parts 1 & 2) + the current meeting schedule (no Zoom links) |
| `supabase/tests/` | Security + gate tests against a real Postgres (`npm run test:db`) |
| `public/brand/`, `scripts/build_brand.py` | Self-hosted FF cross logo (1x/2x PNG + WebP). The script regenerates the logo, favicon, apple-touch-icon and Open Graph image from the source PNG |
| `src/app/(public)` | Home, About, How It Works, Meetings, FAQ, Get Started, Get Help Now, Pastor's Corner, Give, Privacy, Login |
| `src/app/app` | Member area: Dashboard, My Program, item page, cover sheet, packet, Meetings & Links, 90 in 90, Journal, Fishing, Sponsor/AP + Sponsor Board, My Brothers, Sponsor Desk, Directory, Profile & Privacy |
| `src/app/leader` | Pipeline, Review Queue, Man Detail, Matching Board, Members & Roles, Meetings Admin, Reports (CSV) |
| `src/lib/email.ts`, `src/lib/events.ts` | Email templates (preference-aware, logged to `email_log`) and event → email routing |
| `src/lib/jobs.ts`, `src/app/api/cron/[job]` | Daily / weekly-member / weekly-leader jobs |

## Setup

1. **Supabase project.** In the SQL editor run, in order:
   `0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`, `0004_security_fixes.sql`, `0005_view_grants.sql`, `0006_function_defaults.sql`, `0007_sequential_program.sql`, `0008_videos_reflections.sql`, then `seed/seed.sql`.
   (Or `supabase db push` with the CLI.) The migrations create the private `submissions` bucket.
2. **Auth settings** (Supabase → Authentication):
   - Email provider on, "Confirm email" on.
   - Site URL = your domain; add `https://YOUR-DOMAIN/auth/callback` to Redirect URLs.
   - Configure custom SMTP (can be Resend) so confirmation emails come from your domain.
   - Rate limits are on by default; the app adds its own per-IP/per-email limits on sign-up and login.
3. **Cloudflare Turnstile**: create a widget for your domain; set the site key + secret.
   (Without a secret, sign-up skips the check in development only — it is required in production.)
4. **Resend**: verify your sending domain, set `RESEND_API_KEY` and `EMAIL_FROM`. With no key,
   emails are printed to the server log instead (handy locally).
5. **Environment**: copy `.env.example` to `.env.local` (and into Netlify/Vercel).
6. **First admin**: sign up through the site, then in the SQL editor:
   ```sql
   update profiles set status = 'active', role = 'admin', program_start_date = current_date
     where email = 'you@example.com';
   select app.refresh_program(id) from profiles where email = 'you@example.com';
   ```
   After that, everyone is approved and promoted from **Members & Roles**.
7. **Meeting links**: open **Meetings Admin** and paste each meeting's Zoom link, ID and passcode
   (they're deliberately not in the repo). Times are entered in your own timezone.
8. **Videos**: open **Meetings & Videos** and paste each Key 1 recording's link and passcode, and the Vimeo link for *My Name Is Bill W.* Never put links or passcodes in the repo (it's public). Men see them only once that video is unlocked for them.

## Deploy

**Netlify**: new site from this repo, **Base directory `app`**. Netlify detects Next.js.
The three scheduled functions in `netlify/functions/` call the cron routes — set `CRON_SECRET`.

**Vercel**: root directory `app`; `vercel.json` registers the crons (set `CRON_SECRET`).

**Or Supabase pg_cron** (any host):
```sql
select cron.schedule('ff-daily', '0 14 * * *', $$select net.http_get(
  url := 'https://YOUR-DOMAIN/api/cron/daily',
  headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'))$$);
-- likewise weekly-member '0 15 * * 0' and weekly-leader '0 14 * * 1'
```

## Tests

```bash
npm test               # unit tests, then the database suite
npm run test:db        # rebuilds a local Postgres from the migrations, then runs the security suite
npx vitest run src     # unit tests (timezone math, security helpers)
```
`supabase/tests/reset_test_db.sh` expects a local Postgres 16 (see the script for host/port env vars).
The shim (`supabase_shim.sql`) reproduces Supabase's default grants, so missing revokes show up in the tests.
The suite proves, among others, the four required cases: a newcomer can't read another newcomer's
submissions (rows or storage), an ended sponsor loses access immediately, anon can't read
`meetings.zoom_*`, and a man can't approve his own leader gate.

## Decisions baked in (Oct 2026)

- **Keys are strictly sequential**: Module 0 → Key 1 → Key 2 → Key 3 (Part 1, Part 2) → Certification. A key opens only when every
  item of the previous one is fully signed off (self, AP and leader as each item's gate defines; Key 2 also needs a leader's Detox-21 certification).
- **Assignments inside a key are sequential too**: Key 1 is Video 1 → 2 → 3 → Fishing worksheet → AP go-over; Key 2 is #1 → #21; Key 3 is
  Part 1 → Part 2. The next one opens when he has finished *his* part of every earlier one (his initials, which already require any turn-in or
  worksheet answers) — he doesn't wait for AP/leader initials to keep moving. A returned item never re-locks what follows.
- **Key 1 reflections**: a one-page reflection (typed and/or uploaded) on each of the 3 videos, required before that video counts as done.
  Visible to him, his active AP/sponsor and leaders (like turn-ins); leaders get the turn-in email. Key 3's Part 1 worksheet waits for the movie.
- **Background items** (`program_steps.helper.background = true`) start when they open and don't hold back the next item:
  Key 2 #2 (pray 30 days), #10 (90 in 90), #12 (service position, day 14), #16 (get an AP), #18 (sponsor by day 90), #19 (sponsor someone, day 30).
  They still need every sign-off before Key 2 completes. Change the list in the Table editor.

- **Meeting links are for approved members only.** Pending men see the public schedule with a note that links appear after approval; joins are recorded. Program content stays hidden until approval.
- **Unshared journal entries**: visible to the owner and leaders. Shared ones also to his active AP/sponsor.
- `intake_reason` lives in its own leaders-only table (`profile_intake`) so no member query can ever select it.
- AP pairs are a single `relationships` row with `mutual = true`; both men get AP rights.
- AP matches go active on acceptance (leader confirmation optional, per spec); sponsor matches need a leader.
- Key 1 AP step: with no active AP/sponsor, his **primary leader** confirms (any leader if none assigned).
- Day-75 / "no sponsor" alerts count from **program start** (Key 2 #18 is due 90 days after joining).
- Worksheet statements with no question (e.g. "15 years later, 100k people recovered…") show as notes and don't need answers.
- Deleted accounts: deactivated at once, relationships ended. After 30 days (`app_settings.purge_submissions_after_days`) the daily job erases turn-ins, worksheet answers, journal, video notes, 90-in-90 log, fishing, panic events and match requests, blanks email/phone/Signal/city, and deletes the login (auth user).
- Marking a man inactive ends all his AP/sponsor relationships at once. Only admins can change a leader's or admin's status.
- AP and leader initials on the same item must come from two different men.
- Panic Button: always alerts his AP, sponsor and primary leader, plus the men he picks — picks are limited to Directory members, the men he walks with, and leaders.

## Not in v1

- In-app messaging (My Brothers shows contacts per opt-in instead).
- Directory **map** — v1 groups opted-in men by country/city; a pin map would need geocoding.
- The "Your Pond" / Hall of Fame list from the old site (not in the spec).

To change program wording, edit the source doc, export it to `.txt`, and re-run
`python3 supabase/seed/build_seed.py key1.txt key2.txt key3.txt > supabase/seed/seed.sql`.
The seed deletes and re-creates program content, so it refuses to run once any man has progress —
on a live database, update the `program_steps` / `worksheet_questions` rows in place instead.
