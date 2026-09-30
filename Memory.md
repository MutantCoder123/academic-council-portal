# Memory: session handoff log

> The coding AI's working memory. **Read first, update last**, every session.
> Keep "Current state" short and always true. Append to the Session log; never rewrite old entries.
> This file is empty until coding starts. That's intentional.

---

## Current state (overwrite this section each session)

- **Phase / task:** P0 done (8/8); P1-T1..T3 done. **Next: P1-T4** (runSource / ingestAll / dedup / upsert / health / liveness). Then wire `possibleDuplicatePostings` into the merge response (C-43).
- **Remotes:** `origin` = https://github.com/MutantCoder123/academic-council-portal (push here), `upstream` = PradeepSD476 (never push)
- **Branches:** code = `feat/jobs-fetcher` (in `academic-council-portal/`); docs = orphan `planning-docs` (worktree at `planning/`). Both pushed to `origin` on 29 Sep.
- **LOCAL-ONLY MODE (user, 30 Sep): commit locally, do NOT push or merge anything until the user explicitly says so.** On 30 Sep all local commits were rewritten to author = Indranil Saha with the Claude co-author trailers removed, so **the history differs from GitHub: the next push must be `git push --force-with-lease`** (only when the user says). Backups: branches `backup/code-before-author-fix`, `backup/planning-before-author-fix`.
- **`planning/upstream_vulnerabilities.md` is gitignored**: local only, never commit or paste it anywhere.
- **Last commit:** `14d1d01` feat(careers): P1-T3 ATS adapters, board verification and seeded sources (code branch is 11 commits ahead of upstream `main`, all local)
- **LLM provider:** local Ollama `qwen2.5:7b` for testing; **Gemini for the final phase** (P1-T10b is required, before P4-T2). No API key needed until then.
- **Local env working?** Yes. Postgres = `docker compose up -d postgres-acc` (container `acc-postgres`, port 5432, creds from the repo-root `.env`). API: `cd server-acc && npm run dev` (:3000). Client: `cd client-acc && npm run dev` (:5173).
- **Dev logins:** `devstudent_2401cs98@iitp.ac.in` (STUDENT, CS, 2024) and `devadmin_2401ee97@iitp.ac.in` (CAREER_ADMIN, EE, 2024), password = the `DEV_SEED_PASSWORD` value in the local `server-acc/.env` (never write it in committed files).
- **Tests:** `npm test` → 177 passed (9 files).
- **Blockers:** none.

## Where things are (fill in as files are created; saves re-reading the codebase)

| What | Path | Notes |
|---|---|---|
| Local env files (gitignored) | `server-acc/.env`, `client-acc/.env` | Server `.env` has DB URL, random SECRET_KEY, dummy MINIO_* (required at import), LLM + careers keys |
| Dev seed | `server-acc/scripts/careers/seedLocalDev.js` | 2 users + 12 demo experiences with inconsistently spelled company names; idempotent |
| Vitest config | `server-acc/vitest.config.js` | `tests/**/*.test.js`, node env |
| Tests | `server-acc/tests/careers/` | fixtures go in `tests/careers/fixtures/` |
| Env names | `server-acc/.env.example` | names only |
| Careers settings | `server-acc/services/careers/settings.js` | `SETTINGS` map (default, editable, zod schema); `getSetting`, `getAllSettings`, `setSetting` (validates; null → `Prisma.JsonNull`), 30 s cache |
| Job lock | `services/careers/jobLock.js` | `withJobLock(key, name, fn)`, `JOB_LOCKS` constants (81001-81004); xact lock in a 1 h transaction; never throws; heartbeat after a run |
| Heartbeat / academic year | `services/careers/heartbeat.js`, `academicYear.js` | |
| Middlewares | `middlewares/careers/requireCareerAdmin.js` (also exports `isCareerAdmin`, `CAREER_ADMIN_ROLES`), `requireCareersEnabled.js` | |
| Routers | `routes/careers.js` (student), `routes/careersAdmin.js` (admin), mounted at `/api/v1` in `server.js` | |
| Controllers | `controllers/careers/statusController.js`, `adminSettingsController.js` | |
| Normalisers | `services/careers/text/normalize.js` (`normalizeCompanyName`, `normalizeTitle`, `normalizeLocation`, `INDIA_CITY_ALIASES`), `text/html.js` (`htmlToText`, `decodeEntities`) | |
| Company matching | `services/careers/companies/matcher.js` (`buildIndex`, `addToIndex`, `resolveName`, `similarity`), `resolveCompany.js`, `companyIndex.js` (`loadCompanyIndex`), `slug.js` (`slugify`, `uniqueSlug`) | |
| Registry seed | `server-acc/prisma/seedCareers.js` (`npm run careers:seed`) | 60 companies; safe in production |
| Errors | `services/careers/errors.js` | `CareersError(status, code, message, details)`, `sendError(res, err, ctx)` (zod → 400, P2002 → 409, P2025 → 404), `parseId` |
| Merge/split/undo | `services/careers/companies/mergeService.js` | `MOVABLE` = aliases, experiences, postings, sources; undo newest-first only |
| Admin company API | `controllers/careers/adminCompaniesController.js`, `adminMergeController.js`; routes in `routes/careersAdmin.js` | |
| Admin UI | `client-acc/src/pages/admin/careers/` (`Companies.jsx` + dialogs), `client-acc/src/api/careersApi.js` | Route `/admin/careers/companies`; sidebar "Companies" |
| Ingestion schema | `prisma/migrations/20260930021750_careers_ingestion/` | Source, SourceRun, Posting, PostingSource, PostingReview, LinkSubmission, Extraction, LlmUsage |
| Processors | `services/careers/text/compensation.js`, `fingerprint.js`, `skills.js` + `skillsDictionary.js`, `workMode.js`, `relevance.js` + `relevanceRules.js` | all pure |
| ATS adapters | `services/careers/ingest/adapters/{greenhouse,lever,ashby,index}.js`, `ingest/http.js` | `fetchPostings(source)` → `{ postings, fetchedCount, skipped }` |
| Board check | `scripts/careers/verifyBoard.js <kind> <token> [--save] [--raw]` | |
| Registry schema | `server-acc/prisma/schema.prisma` (bottom) + `prisma/migrations/20260929174031_careers_foundation/` | Company, CompanyAlias, CompanyMergeLog, AppSetting, Experience.companyId |

## Decisions made during coding (small ones; big ones also go to change_specsheet.md)

- `Company` only has relations to `CompanyAlias` and `Experience` for now; `postings` / `sources` relations are added in P1-T1 when those models exist (a schema-only change, no SQL).
- Migrations are applied with `npx prisma migrate deploy` **after** reviewing the `--create-only` SQL. This applies exactly the reviewed file; `migrate dev` could regenerate it.
- Client lint gate changed (change_specsheet C-33): lint only the files we touch (0 errors); `npx eslint src` must stay ≤ 36.
- Job lock = transaction-scoped advisory lock (C-34). Don't switch to session locks.
- `/careers/status` returns `{ enabled, visibleToStudents, isCareerAdmin }`. Clients use `enabled` to show the UI.
- PUT `/careers/admin/settings` is all-or-nothing: any invalid, unknown or non-editable key → 400 and nothing is written. `runRequest` and `workerHeartbeat` are not editable there.
- Aliases that normalise to an existing key aren't stored (unique `normalizedAlias`), so the exact-match tier only matters for aliases whose normal form differs.
- Fuzzy threshold 0.92: one typo in a 10-letter name scores 0.90 and does NOT match (tested). Admins can lower `careers.fuzzyThreshold`.
- Split undo folds everything the split-off company has (incl. rows attached later) back into the original, and deletes the name alias the split created.
- RawPosting shape (all adapters): `{ externalId, title, companyName, locationText, url, descriptionText, workplaceText, employmentTypeText, compensationText, postedAt, deadline }`. Ashby `employmentType: "Intern"` and Greenhouse metadata can give the type: combine with `guessType(title)` in P1-T4.
- Relevance: `evaluateRelevance` returns `location: 'unknown'` for non-geographic text such as "Hybrid" or "N/A". P1-T4 must add `location` to `uncertainFields` in that case.
- Compensation: stipend must say monthly, else UNCLEAR; CTC in lakh/crore is annual; no period conversion; 0 only for "unpaid".

## Gotchas / things that surprised me

- **`npx prisma format` reformats existing models** (it re-aligned 2 FinanceVault lines). After formatting, check `git diff prisma/schema.prisma | grep '^-[^-]'` returns nothing, and restore any upstream whitespace.
- Prisma may touch `prisma/migrations/migration_lock.toml` (line endings only). `git checkout --` it; never commit it.
- `config/minio.js` **throws at import if `MINIO_BUCKET_NAME` is missing**; with dummy values the server just logs "Minio bucket initialization failed" and runs.
- Upstream `GET /posts/:id/comments` returns 500 if `page`/`limit` are missing (passes NaN to Prisma). The client always sends them. Not our bug (noted below).
- Versions resolved: **zod 4**, **node-cron 4**, **vitest 5**, cheerio 1.2, undici 7. Check APIs against these majors (e.g. zod 4 error formatting, node-cron 4 `schedule` options).
- Don't redirect logs to `/tmp_*` in Git Bash on Windows (permission denied). Use the session scratchpad.
- A required `Json` column rejects plain `null` in Prisma; use `Prisma.JsonNull` (see settings.js).
- **Docker Desktop doesn't auto-start**: after a reboot, "Can't reach database server at localhost:5432" means start Docker Desktop, then `docker compose up -d postgres-acc`.
- **Files checked out by git are CRLF** (autocrlf=true), e.g. `schema.prisma` after the history rewrite. Scripted edits must match `\r\n`; the Edit tool is safer.
- Stop the API before `npx prisma generate` on Windows (the running server locks the query engine DLL).
- Playwright MCP writes to `ACC Open Project/.playwright-mcp/` (outside both git folders). Delete it after testing; it holds page snapshots of logged-in sessions.
- React Fast Refresh lint: `.jsx` files may only export components; put helpers in `.js` files.
- The Greenhouse Databricks board is 9.6 MB (881 jobs) with 0 India early-career roles, which is why it isn't a source.
- zod 4: `z.prettifyError` prefixes messages with a "✖" glyph. For API responses use `error.issues.map(i => i.message)`.
- cheerio `htmlToText`: add list bullets **before** block line breaks, or the bullet lands on its own line.
- The dev DB now has `careers.visibleToStudents=false` and `careers.submissionDailyLimit=5` rows (written by the P0-T4 checks) and a test heartbeat `lockTestThrow`. Harmless.
- The forbidden-SQL grep must not match `ON DELETE` / `ON UPDATE` in FK clauses. Use: `grep -n -i -E '\b(DROP|RENAME|ALTER COLUMN|SET NOT NULL|TRUNCATE)\b|^\s*(DELETE|UPDATE)\b' migration.sql`.

## Verified facts (e.g. ATS response shapes, board tokens that work)

- (29 Sep, dev laptop) Ollama 0.34.4 installed; models present: `qwen2.5:7b` (4.7 GB, Q4_K_M, 32k ctx), `llama3.2:1b`. GPU RTX 4060 8 GB, RAM 15.5 GB.
- `POST /api/chat` with `format` = JSON schema works on `qwen2.5:7b`, and nullable types `{"type":["string","null"]}` are accepted. Cold call about 14 s. Response fields: `message.content`, `done_reason`, `prompt_eval_count`, `eval_count`.
- Observed model errors (motivation for `verify.js`): intern labelled FULL_TIME, `overall_confidence: 100`, pay text paraphrased not verbatim.
- (30 Sep) ATS response shapes, verified live and saved as fixtures (`tests/careers/fixtures/`): see change_specsheet C-41. Board results: C-40. Kept after relevance at verification time: stripe 17, paytm 16, rubrik 3 (all interns), groww 3, inmobi 2, sarvam 2, cloudflare 2, razorpay 1, meesho 1, zeta 1, cred 0.

## Upstream issues noticed (do NOT fix)

- **Security** issues go in `planning/upstream_vulnerabilities.md` (13 items recorded on 29 Sep). The
  user sends that file privately to the maintainers. **Never paste it into the public PR.**
- Other (non-security) upstream bugs:
  - `ForumController.getComments`: missing `page`/`limit` → `take: NaN` → Prisma error → 500 (should be 400 or default paging).
  - Client lint: 1,115 pre-existing errors (1,078 vendored `public/` jQuery files, 36 in `src/`, 1 in `vite.config.js`).

---

## Session log (append newest at the bottom)

<!--
Template for each entry:

### YYYY-MM-DD, <task id>: <one-line summary>
- Did:
- Files touched:
- Checks run + actual results: (paste summary lines, e.g. "Tests: 42 passed")
- Not verified / skipped (and why):
- Next step:
-->

### 2026-09-29, P0-T1: local environment + dev seed
- Did: started `acc-postgres` via docker compose; created gitignored `server-acc/.env` (DB URL from the repo-root `.env`, random SECRET_KEY, dummy MINIO_*, careers/LLM keys, DEV_SEED_PASSWORD) and `client-acc/.env` (`VITE_API_URL=http://localhost:3000/api`); `npm ci` in both; `prisma migrate deploy` applied all 18 upstream migrations; `prisma migrate diff` DB→schema = empty (no upstream drift); wrote and ran `seedLocalDev.js`.
- Files touched: `server-acc/scripts/careers/seedLocalDev.js` (commit becda3b).
- Checks run + actual results: seed run 1 → "2 users upserted, 12 experiences created"; run 2 → "0 experiences created (12 already present)". Login student → 200, `/auth/me` = STUDENT CS 2024; login admin → 200, CAREER_ADMIN EE 2024; wrong password → 401; `GET /posts` total = 12. Client `npm run build` → "✓ built in 15.60s". Lint baseline: 1,115 errors (not ours).
- Not verified: the client UI in a browser (build only).
- Next step: P0-T2.

### 2026-09-29, P0-T2: test tooling + deps
- Did: `npm i node-cron cheerio fastest-levenshtein zod undici`, `npm i -D vitest`; scripts test/test:watch/worker/careers:job/careers:seed; `vitest.config.js`; sanity test; `.env.example` (names only).
- Files touched: package.json, package-lock.json, vitest.config.js, tests/careers/sanity.test.js, .env.example (commit 543cb36).
- Checks run + actual results: `npm test` → "Test Files 1 passed (1) · Tests 1 passed (1)"; server restart → `/health` {"status":"OK"}, "Server is running on PORT: 3000".
- Next step: P0-T3.

### 2026-09-29, P0-T3: careers_foundation migration
- Did: added the Company/CompanyAlias/CompanyMergeLog/AppSetting models + 3 enums + nullable `Experience.companyId` (+ index); `migrate dev --create-only`; reviewed the SQL; applied with `migrate deploy`.
- Files touched: `prisma/schema.prisma` (+76, −0), `prisma/migrations/20260929174031_careers_foundation/migration.sql` (commit b0021cc).
- Checks run + actual results: statement list = 3× CREATE TYPE, 4× CREATE TABLE, 2× CREATE UNIQUE INDEX, 6× CREATE INDEX, 1× ALTER TABLE ADD COLUMN (`Experience.companyId INTEGER`, nullable), 2× ADD CONSTRAINT FOREIGN KEY. No DROP/RENAME/ALTER COLUMN/SET NOT NULL. `migrate status` → "Database schema is up to date!". Data: experiences 12 (all companyId null), users 2. Existing endpoints after restart: login 200, GET /posts 200 (total 12), toggle-like 200/200, toggle-bookmark 200/200, comments (page=1&limit=10) 200, add comment 201, delete comment 200 (smoke comment removed).
- Next step: P0-T4.

### 2026-09-29, P0-T4: settings, job lock, middlewares, routers
- Did: settings service (11 keys, zod, cache), transaction-scoped job lock + heartbeat, academicYear, requireCareerAdmin / requireCareersEnabled, `GET /careers/status`, `GET/PUT /careers/admin/settings`, mounted in server.js (+4 lines).
- Files: see "Where things are" (commit 09a25f1).
- Checks + actual results: `npm test` → 8 passed. HTTP: status student `{enabled:false, isCareerAdmin:false}` 200; admin `{enabled:true, isCareerAdmin:true}` 200; student GET/PUT settings → **403 JSON** `FORBIDDEN`; no cookie → 401; PUT threshold 1.7 → 400 "Too big: expected number to be <=1"; PUT workerHeartbeat → 400 "cannot be changed here"; unknown key → 400; valid PUT → 200 and student status flips to enabled:true, and back to false after reverting. Lock script: A `{ran:true, ok:true}`, B concurrent `{ran:false}` ("skipped: already running elsewhere"), C after A `{ran:true}` (lock released), throwing job caught `{ran:true, ok:false}`, heartbeat written.
- Next: P0-T5.

### 2026-09-29, P0-T5: text normalisers
- Did: `normalize.js` (company/title/location + India city aliases), `html.js` (cheerio). Fixed bullet ordering. Added trailing "and" noise (C-37).
- Checks + actual results: `npm test` → 60 passed (52 new assertions in normalize/html tests), incl. "Google India", "Google LLC", "google", "GOOGLE INDIA PVT. LTD." → `google`; "Software Engineer Intern - Summer 2026" ≠ "Software Engineer"; "Bangalore, India" → `bengaluru`.
- Commit bed0a0c. Next: P0-T6.

### 2026-09-29, P0-T6: matcher, resolver, seed
- Did: matcher (exact → normalised → fuzzy, min length 5, tie → none), resolveCompany (CANDIDATE creation, P2002 race fallback), companyIndex, slug, seedCareers (settings + 60 companies).
- Checks + actual results: `npm test` → **87 passed (6 files)**, incl. Beta ≠ Meta, Databriks (0.90) below the 0.92 threshold, tie → none, concurrent-insert fallback. Seed run 1: "7 settings created, 60 companies created, 85 aliases created"; run 2: "0 … 0 … 0 aliases created" (idempotent). Real-DB resolution: Google India / GOOGLE LLC → Google (normalized); J.P. Morgan → JPMorgan Chase (exact); D.E. Shaw & Co. → D. E. Shaw; Goldmann Sachs → Goldman Sachs (fuzzy 0.929); Acme Robotics → none; duplicateNormalizedNames = 0. Found "Flipkart Internet Pvt Ltd" unmatched → added alias → now resolves (86 aliases).
- Commit 1414870. Next: P0-T7.

### 2026-09-30, git identity + local-only mode
- The user asked for commits authored by them, with no Claude co-author, and no push/merge until told. Set repo-local `user.name/email`; rewrote all local commits on both branches (author + trailers; contents identical to the backup branches). Rules added to AI_Rules §2 and to memory.

### 2026-09-30, P0-T7: merge/split/undo + admin company API
- Did: `errors.js`, `mergeService.js`, `adminCompaniesController.js`, `adminMergeController.js`, routes.
- Checks + actual results: 24/24 PASS end-to-end over HTTP. A resolver-created candidate merged into Google, experiences followed; split back out; undo of the older merge → 409 "Undo the later split (#2) first."; undo split and undo merge restored every row and status; double undo → 409; alias owned elsewhere → 409 ALIAS_TAKEN; last alias delete → 400; approve candidate → ACTIVE; `javascript:` website → 400; student → 403. Demo experiences unlinked afterwards (backfill starts clean). Companies #61 "Google Cloud India" (ACTIVE) and #62 (MERGED) remain as history.
- Commit ac083d0.

### 2026-09-30, P0-T8: admin Companies UI
- Did: Companies page + detail/merge/split/create dialogs + History (undo), route, sidebar.
- Checks + actual results: changed files lint exit 0; `npx eslint src` = 36 errors (baseline); build ✓. Browser (Playwright): list at 1280 px; search "cloud" → open → Merge into… → Google → toast "Merged Google Cloud India into Google."; History → Undo → Confirm → "Undid merge #3."; 375 px: no horizontal overflow, detail opens as a bottom sheet; student at `/admin/careers/companies` → "Access Denied.". Fixed "1 aliases" pluralisation; moved `plural` to `format.js` (Fast Refresh lint).
- Commit 6f2a3c6.

### 2026-09-30, P1-T1: careers_ingestion migration
- SQL: 11 CREATE TYPE, 8 CREATE TABLE, 13 CREATE INDEX, 2 CREATE UNIQUE INDEX, 6 FK constraints, all on new tables; forbidden scan = 0. `migrate deploy` ✓, status up to date. Seed: 2 system sources (idempotent). Merge/split/undo verified with a throwaway posting + source (4/4 PASS), then deleted. Posting defaults confirmed honest (NOT_DISCLOSED, null stipend, type UNKNOWN).
- Commit 8fbec00.

### 2026-09-30, P1-T2: deterministic processors
- 148 tests (61 new). Bugs found by tests and fixed: "js" in "Node.js" matched JavaScript; "not a remote role" was REMOTE; canonicalizeSkills order.
- Commit dff2d82.

### 2026-09-30, P1-T3: ATS adapters + sources
- Probed live responses first; wrote mappers against them; saved fixtures (3 jobs each; scanned for emails/phones: none). Scanned 40 candidate boards: 14 reachable in the first pass revealed foreign leaks → relevance rework (C-39) → rescan clean. Seeded 11 sources (C-40). `npm test` → 177 passed.
- Commit 14d1d01. Next: P1-T4.
