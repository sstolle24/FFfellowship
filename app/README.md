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
| `supabase/seed/build_seed.py` → `seed.sql` | Program content generated **verbatim** from the 10-26 source docs (Key 1 worksheet, The 21, Bill's Story Parts 1 & 2) + the current meeting schedule (no Zoom links) |
| `supabase/tests/` | Security + gate tests against a real Postgres (`npm run test:db`) |
| `src/app/(public)` | Home, About, How It Works, Meetings, FAQ, Get Started, Get Help Now, Pastor's Corner, Give, Privacy, Login |
| `src/app/app` | Member area: Dashboard, My Program, item page, cover sheet, packet, Meetings & Links, 90 in 90, Journal, Fishing, Sponsor/AP + Sponsor Board, My Brothers, Sponsor Desk, Directory, Profile & Privacy |
| `src/app/leader` | Pipeline, Review Queue, Man Detail, Matching Board, Members & Roles, Meetings Admin, Reports (CSV) |
| `src/lib/email.ts`, `src/lib/events.ts` | Email templates (preference-aware, logged to `email_log`) and event → email routing |
| `src/lib/jobs.ts`, `src/app/api/cron/[job]` | Daily / weekly-member / weekly-leader jobs |

## Setup

1. **Supabase project.** In the SQL editor run, in order:
   `0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`, then `seed/seed.sql`.
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
8. **Videos**: set `video_url` on the three Key 1 videos and the Bill W. movie (Table editor → `videos`).

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
npm run test:db        # rebuilds a local Postgres from the migrations, then runs the security suite
npx vitest run src     # unit tests (timezone math)
```
`supabase/tests/reset_test_db.sh` expects a local Postgres 16 (see the script for host/port env vars).
The suite proves, among others, the four required cases: a newcomer can't read another newcomer's
submissions (rows or storage), an ended sponsor loses access immediately, anon can't read
`meetings.zoom_*`, and a man can't approve his own leader gate.

## Decisions baked in (Oct 2026)

- **Pending members see meeting links** (and their joins are recorded). Program content stays hidden until approval.
- **Unshared journal entries**: visible to the owner and leaders. Shared ones also to his active AP/sponsor.
- `intake_reason` lives in its own leaders-only table (`profile_intake`) so no member query can ever select it.
- AP pairs are a single `relationships` row with `mutual = true`; both men get AP rights.
- AP matches go active on acceptance (leader confirmation optional, per spec); sponsor matches need a leader.
- Key 1 AP step: with no active AP/sponsor, his **primary leader** confirms (any leader if none assigned).
- Day-75 / "no sponsor" alerts count from **program start** (Key 2 #18 is due 90 days after joining).
- Worksheet statements with no question (e.g. "15 years later, 100k people recovered…") show as notes and don't need answers.
- Deleted accounts: deactivated at once, relationships ended; turn-ins, worksheet answers and journal purged after 30 days (`app_settings.purge_submissions_after_days`).

## Not in v1

- In-app messaging (My Brothers shows contacts per opt-in instead).
- Directory **map** — v1 groups opted-in men by country/city; a pin map would need geocoding.
- The "Your Pond" / Hall of Fame list from the old site (not in the spec).

To change program wording, edit the source doc, export it to `.txt`, and re-run
`python3 supabase/seed/build_seed.py key1.txt key2.txt key3.txt > supabase/seed/seed.sql`.
The seed deletes and re-creates program content, so it refuses to run once any man has progress —
on a live database, update the `program_steps` / `worksheet_questions` rows in place instead.
