# Career Vault: automated job & internship fetcher

Adds a **Jobs & Internships** section to Career Vault. Openings are collected from company job boards
and from links students share, reviewed by an ACC career admin, and shown to students next to the
seniors' experiences for the same company. The whole feature is behind a flag that is **off by
default**. While it is off, students see nothing new and every existing page behaves as before.

## What students get (only when an admin turns the flag on)

- **Jobs & Internships tab:** search, filters (type, location, work mode, branch / year
  eligibility, minimum stipend / CTC with an "include undisclosed" switch, season, deadline), and
  "new since your last visit". Pay that is not published is shown as "Undisclosed", never ₹0.
- **Job page:** eligibility check against the student's roll number, programme and graduation year;
  Apply on the company's site; save; track the application with a status and a private note;
  "Not for me"; report a problem; copy link / share on WhatsApp.
- **Company pages:** open roles and Career Vault experiences in one place. Optional numbers seniors
  share on the experience form (stipend, CTC, interview rounds) appear only as rounded summaries,
  once at least 3 seniors have reported them.
- **Share a link** to an opening. It is checked and processed automatically, and an admin reviews
  it before it appears.
- **Job alerts by email** (daily / weekly, unsubscribe without logging in). These emails are off
  until an admin turns them on.

## What career admins get

- **Review queue:** pending and flagged postings, bulk approve with undo, reject with a reason, and
  edits with history.
- **All postings:** take down (reversible), merge duplicates, delete permanently (spam / test data
  only, with an audit line).
- **Companies:** aliases, candidates, merge / split / undo with a merge log, and linking existing
  experiences to companies.
- **Sources & Operations:** add job boards (Greenhouse, Lever, Ashby, SmartRecruiters, Workable),
  per-board keyword rules, health and run history, feature flags, AI-extraction status and usage,
  weekly usage numbers (counts only), an activity log, and alerts.
- **Optional daily email** listing postings waiting for review (off by default).

## How it works

- A separate **worker process** (`server-acc/worker.js`, new compose service `fetcher-acc`, same
  image as the API) runs the schedule:
  - fetch the job boards 4× a day;
  - recheck liveness daily;
  - process student links every 10 minutes;
  - send job alerts and review reminders daily (both off by default).
- Board postings are filtered to India early-career roles and deduplicated across sources.
  **Nothing is published without an admin's approval.**
- Student links are fetched with an SSRF guard: private / loopback addresses and odd ports are
  refused, DNS is checked at connect time, size and time are capped. LinkedIn and similar sites are
  stored, not fetched. Pages without structured data go to an AI extraction step behind a provider
  switch: local Ollama, Groq or Gemini, chosen by env. AI output is verified against the page text
  by code, and the step can be turned off from Operations.

## Changes to existing files

Everything new lives under `careers` paths (`server-acc/{routes,controllers,services,middlewares,scripts}/careers*`,
`client-acc/src/pages/{Careers,admin/careers}`, `client-acc/src/api/careersApi.js`, tests). Existing
files touched:

| File | Change |
|---|---|
| `server-acc/server.js` | Mounts the two careers routers |
| `server-acc/prisma/schema.prisma` | Additions only (new models / enums / nullable columns); no existing line removed or changed |
| `server-acc/package.json` (+ lock) | Scripts `worker`, `test`, `careers:job`, `careers:seed`; deps `cheerio`, `fastest-levenshtein`, `node-cron`, `undici`, `zod`; dev dep `vitest` |
| `server-acc/config/db.js` | Prisma `omit` so self-reported private fields (CPI, programme, graduation year, a senior's reported stipend / CTC / rounds / year) are never returned by any query unless asked for explicitly |
| `server-acc/controllers/ForumController.js` | Optional `companyId` and optional reported numbers on add / edit post; `company` in the post list (+ open-roles count) |
| `client-acc/src/App.jsx` | Routes for the new pages |
| `client-acc/src/layout/DashboardLayout.jsx` | Sidebar entries (+ review count badge for career admins) |
| `client-acc/src/pages/CareerVaultuser/index.jsx` | Tabs, optional company picker and optional "numbers for juniors" on the share form, open-roles chip |
| `docker-compose.yml` | New `fetcher-acc` service |

The client adds no new dependencies.

## Database migrations (all additive)

21 migrations, each reviewed before applying. None of them contains `DROP`, `RENAME`,
`ALTER COLUMN`, `SET NOT NULL` on an existing column, or changes existing rows:

`careers_foundation`, `careers_ingestion`, `careers_user_cpi`, `careers_tracking`,
`careers_expiry_reason`, `careers_link_shares`, `careers_published_index`, `careers_link_dismiss`,
`careers_posting_reports`, `careers_hidden_postings`, `careers_application_notes`,
`careers_source_archive`, `careers_saved_searches`, `careers_graduation_year`,
`careers_internship_season`, `careers_usage_counts`, `careers_more_ats_kinds`,
`careers_source_keyword_rules`, `careers_reject_candidate`, `careers_posting_deletions`,
`careers_senior_reports`.

Two of them add enum values (`AlertFrequency` is a new enum; `SourceKind` gains `SMARTRECRUITERS`
and `WORKABLE`). Postgres cannot drop enum values, so those two values stay even if the adapters are
removed later.

## New environment variables (`server-acc/.env.example`)

| Variable | Purpose |
|---|---|
| `CAREERS_TZ` | Schedule time zone (default `Asia/Kolkata`) |
| `LLM_PROVIDER` | `ollama` (default), `groq` or `gemini` |
| `OLLAMA_URL` | Only for `ollama` (default `http://localhost:11434`) |
| `CAREERS_LLM_FAST_MODEL`, `CAREERS_LLM_STRONG_MODEL` | Model ids (empty = provider default / no escalation) |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | Only for that provider; server-side only |
| `DEV_SEED_PASSWORD` | Local development seed only; not needed in production |

Existing variables reused: `SMTP_*` (alert / reminder emails), `CLIENT_URL` (links in emails),
`SECRET_KEY` (keyed hash for weekly visitor counts).

## Deploy

The full operating guide for maintainers and career admins is `docs/careers/SOP.md`.

1. `cd server-acc && npm ci && npx prisma migrate deploy` (applies the 21 migrations).
2. `npm run careers:seed` (setting defaults and the company list; only inserts what is missing, so
   it is safe to re-run).
3. `docker compose up -d --build backend-acc fetcher-acc`.
4. As a career admin, open **Sources & Ops** (the Operations page). Check that the Worker card says
   **Running**, run **Fetch all now** from Sources, review the queue, then turn on **Show Jobs &
   Internships to students**.

## Roll back

1. Turn **Show Jobs & Internships to students** off in Operations: students immediately see nothing new, no
   redeploy needed.
2. `docker compose stop fetcher-acc` stops all fetching and emails.
3. The migrations are additive, so they can stay in place; the old code ignores the new tables and
   columns.

## Testing

- `npm test` in `server-acc`: **797 tests** (58 files) pass.
- `npm run build` in `client-acc` passes. Every client file added or changed has 0 lint errors, and
  `npx eslint src` stays at the existing baseline (36).
- Checked locally against Postgres 16 with real job boards: ingestion from 12 boards, dedup across
  board + student link, company merge / split / undo, the SSRF guard, the flag on/off without a
  restart, and the AI step (stop on an unusable provider, daily cap).
- **Not verified yet:**
  - Email delivery through a real SMTP server (checked only with nodemailer's JSON transport).
  - A live Gemini call (the provider is unit-tested; testing used Groq).

## Security

A separate security report about existing (non-careers) code will be sent to the maintainers
privately. It is not included here.
