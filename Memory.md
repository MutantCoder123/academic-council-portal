# Memory: session handoff log

> The coding AI's working memory. **Read first, update last**, every session.
> Keep "Current state" short and always true. Append to the Session log; never rewrite old entries.
> This file is empty until coding starts. That's intentional.

---

## Current state (overwrite this section each session)

- **Phase / task:** P0, P2 done; P1 done except **P1-T10b** (Gemini; deferred until the key arrives; REQUIRED before P4-T2). P3-T1 done. **Next: P3-T2** (experience backfill).
- **Remotes:** `origin` = https://github.com/MutantCoder123/academic-council-portal (push here), `upstream` = PradeepSD476 (never push)
- **Branches:** code = `feat/jobs-fetcher` (in `academic-council-portal/`); docs = orphan `planning-docs` (worktree at `planning/`). Both pushed to `origin` on 29 Sep.
- **LOCAL-ONLY MODE (user, 30 Sep): commit locally, do NOT push or merge anything until the user explicitly says so.** On 30 Sep all local commits were rewritten to author = Indranil Saha with the Claude co-author trailers removed, so **the history differs from GitHub: the next push must be `git push --force-with-lease`** (only when the user says). Backups: branches `backup/code-before-author-fix`, `backup/planning-before-author-fix`.
- **`planning/upstream_vulnerabilities.md` is gitignored**: local only, never commit or paste it anywhere.
- **Last commit:** `42a8087` feat(careers): P3-T1 company directory and company pages with live postings and linked experiences (all local, not pushed)
- **LLM provider:** local Ollama `qwen2.5:7b` for testing; **Gemini for the final phase** (P1-T10b is required, before P4-T2). No API key needed until then.
- **Local env working?** Yes. Postgres = `docker compose up -d postgres-acc` (container `acc-postgres`, port 5432, creds from the repo-root `.env`). API: `cd server-acc && npm run dev` (:3000). Client: `cd client-acc && npm run dev` (:5173).
- **Dev logins:** `devstudent_2401cs98@iitp.ac.in` (STUDENT, CS, 2024) and `devadmin_2401ee97@iitp.ac.in` (CAREER_ADMIN, EE, 2024), password = the `DEV_SEED_PASSWORD` value in the local `server-acc/.env` (never write it in committed files).
- **Tests:** `npm test` → 421 passed (17 files).
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
| Ingest pipeline | `services/careers/ingest/{runSource,ingestAll,buildPosting,upsertPosting,dedup,health,liveness}.js` | pure: `buildPostingData`, `isSamePosting`, `findPossibleDuplicates`, `nextHealth`, `statusWhenSeen`, `shouldExpire` |
| Job CLI | `scripts/careers/runJob.js ingest [sourceId]` (`npm run careers:job -- ingest`) | takes the worker's lock, no heartbeat |
| Worker | `server-acc/worker.js` (`npm run worker`), jobs in `services/careers/jobs.js` | compose service `fetcher-acc` (container `acc-fetcher`) |
| Review / sources / ops API | `controllers/careers/adminReviewController.js`, `adminSourcesController.js`, `adminOpsController.js`; logic in `services/careers/postings/{editPosting,reviewService}.js`, `services/careers/ops/{alerts,llmStatus}.js` | routes in `routes/careersAdmin.js` |
| Review UI | `client-acc/src/pages/admin/careers/{ReviewQueue,ReviewCandidates,ReviewLinks,PostingEditor,ManualPosting}.jsx`, `components/{PostingFields,UncertainField,ConfidenceMeter,CompanyPicker}.jsx`, `components/postingForm.js` | routes `/admin/careers/review`, `/admin/careers/new`; sidebar "Jobs Review" |
| Sources / ops UI | `client-acc/src/pages/admin/careers/{Sources,AddSourceDialog,Operations,FlagsCard}.jsx`, `components/{HealthBadge,StatCard}.jsx` | routes `/admin/careers/sources`, `/admin/careers/ops` |
| Student links | `services/careers/links/{ipGuard,canonicalUrl,blockedDomains,atsLink,jsonLd,safeFetch,processSubmission,recheckLiveness}.js`, `controllers/careers/submissionsController.js`, `middlewares/careers/submissionRateLimit.js` | worker job `linksAndExtraction` (*/10), CLI `npm run careers:job -- links` |
| LLM extraction | `services/careers/extract/{schema,prompt,callModel,providerStatus,verify,outcome,llmError,pricing,budget,runExtractions,applyExtraction}.js`, `extract/providers/ollama.js`, `postings/branchCodes.js` | runs in the `linksAndExtraction` job after processSubmissions |
| Eligibility / CPI | `services/careers/postings/eligibility.js` (`eligibilityProfile`, `postingEligibility`, `cpiBody`, `toCpi`), `controllers/careers/eligibilityController.js`; migration `20261002042222_careers_user_cpi` | CPI hidden by the global omit in `config/db.js` |
| Student postings API | `services/careers/postings/query.js` (`postingsQuery`, `compensationWhere`, `eligibilityWhere`, `baseWhere`, `withEligibility`, `orderByFor`), `controllers/careers/postingsController.js` (`listPostings`, `getPosting`), `controllers/careers/companiesController.js` (`searchCompanies`) | routes in `routes/careers.js`; `/careers/companies/search` has no flag gate |
| Student jobs UI | `client-acc/src/pages/Careers/JobsPage.jsx`, `pages/Careers/components/*`, `pages/Careers/lib/{format,filters}.js`, `hooks/useCareersStatus.js` | route `/dashboard/career-vault/jobs`; sidebar "Jobs & Internships" only when `useCareersStatus().enabled` |
| Job detail + share link | `client-acc/src/pages/Careers/JobDetailPage.jsx`, `components/{SourceLinks,SubmitLinkModal,MySubmissions}.jsx` | route `/dashboard/career-vault/jobs/:id`; `lib/format.js` has `formatDate`, `collectedBy`, `submissionStatus`, `safeHref` |
| Company pages | `server-acc/services/careers/companies/directory.js`, `services/careers/postings/cards.js`, `controllers/careers/companiesController.js` (`listCompanies`, `getCompanyPage`); client `pages/Careers/{CompaniesPage,CompanyPage}.jsx`, `components/{ExperienceCard,PageTitle}.jsx` | routes `/dashboard/career-vault/companies[/:slug]` |
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
- Liveness "seen" = every externalId the board returned (also those dropped by the relevance filter), so a rule change never expires a still-listed job.
- `User.cpi` is never returned unless a query `select`s it (global omit, C-66). Don't add `omit: { cpi: false }` anywhere except `/careers/me/*`; the T2 eligibility filter reads CPI with its own `select`.
- `ExperienceCard` renders the description with the same `dangerouslySetInnerHTML` + classes as `CareerVaultuser/index.jsx` (AI_Rules §9: same rendering; no new client deps, so no DOMPurify). The underlying stored-XSS / self-publish issue is item 14 in the private security report (2 Oct). If the maintainers add a sanitiser, use it in ExperienceCard too.

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
- Dev DB has a deliberate bogus source `GREENHOUSE/this-board-does-not-exist-acc` (id 15) for the FAILING checks. Disable or delete it before any demo.
- On Windows, `kill -TERM` from Git Bash ends node without running the SIGTERM handler, so graceful shutdown can only be verified in Docker/Linux.
- Resizing the Playwright window from 1280 to 375 leaves the upstream sidebar half-open over the content; reload at 375 before judging the mobile layout.
- Relevance lets through titles like "Risk Analyst | Exp - 1 to 3 Yrs" ("analyst" counts as junior). Admins reject them; consider an experience-range rule later.
- A `position: fixed` modal rendered inside an element with `backdrop-blur` (our `cardClass`) is trapped inside that element. Render dialogs outside cards (FlagsCard does).
- `10-0-0-1.nip.io` (public DNS answering 10.0.0.1) is a handy live test for the connect-time DNS guard.
- Grounding can't catch a wrong value that does appear on the page: on a Peerlist page Qwen took the company from sidebar noise ("Colecta" for a Google job). It ends up as a CANDIDATE company (flagged), so review catches it.
- Hosted job platforms (Keka, Peerlist, Semesteria) aren't the employer; when the page names no company, the hostname fallback gives e.g. "keka" (flagged candidate).
- Keyword work-mode override can be wrong on pages listing other jobs (MyGyan: page says Onsite, keywords gave HYBRID). Consider preferring the model's value when its word is in the page header.
- `boards.greenhouse.io/<board>/jobs/<id>` links (e.g. Stripe) redirect more than 3 times, so the recheck can't verify them (logged, not counted). Their postings also have an ATS observation, which the nightly ingest covers.
- Prisma `String[]` / `Int[]` columns without a default hold NULL when a create omits them, Prisma *reads* NULL as `[]`, and `{ isEmpty: true }` does not match NULL. Filter "empty" with `OR: [{ f: { isEmpty: true } }, { f: { equals: null } }]`, and always write `[]`.
- React Router 7's `setSearchParams` updates in a transition, so a controlled checkbox bound to the URL shows its old state for a moment after a click. Playwright's `check()`/`uncheck()` then fails ("did not change its state"); use `click()` and wait.
- Browser checks without putting the dev password in a tool call: in `browser_run_code_unsafe`, `page.goto('file:///…/server-acc/.env')`, read it with `page.evaluate`, then `page.request.post('/auth/login')` (the cookie lands in the browser context). `require` is not available there. Screenshots can only be saved under `ACC Open Project/` (`.playwright-mcp/`), which must be deleted afterwards.
- Browser checks without the Playwright MCP: the MCP's own package is in the npx cache (`%LOCALAPPDATA%/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core`). Import it from a Node script and launch with `executablePath: %LOCALAPPDATA%/ms-playwright/chromium-1223/chrome-win64/chrome.exe` (its default headless-shell build 1247 isn't installed). The script reads the dev password from `.env` itself. Script: scratchpad `browser_p2t4.mjs`.
- The dashboard layout has its own `<h1>Portal Dashboard</h1>`; select page headings inside `main main`.

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

### 2026-10-01, P1-T4: ATS ingest run, dedup, upsert, health, liveness
- Did: runSource / ingestAll / buildPosting / upsertPosting / dedup / health / liveness (ATS part), runJob.js, merge response now reports `possibleDuplicatePostings` (C-43 closed). Fixed 0-salary placeholder (C-47).
- Checks run + actual results (dev DB reset first):
  - Run 1: `TOTAL sources=11 failed=0 fetched=1669 kept=47 new=45 dup=2 seen=0`; all sources OK. Per source kept: stripe 17, rubrik 3, groww 3, inmobi 2, cloudflare 2, razorpay 1, paytm 15, meesho 1, zeta 1, cred 0, sarvam 2.
  - Run 2: `new=0 dup=0 seen=47`; 47/47 observations have lastSeenAt > firstSeenAt; 45 postings PENDING_REVIEW.
  - Bogus board added: `#15 FAILED FAILING error: HTTP 404 from boards-api.greenhouse.io` while the other 11 stayed OK; consecutiveFailures 2 after two runs.
  - Liveness: fake LIVE observation on source #6: run A `missed/dropped/expired 1/0/0`, run B `1/1/1` → posting EXPIRED, observation isLive=false missedRuns=2.
  - Dedup merges checked by hand: Stripe "Software Engineer, Intern" (two Bengaluru reqs), Paytm "Talent Acquisition Intern - Bangalore" (two reqs) → correct.
  - Quality notes: 19/45 type UNKNOWN ("Associate", "Analyst" titles) → flagged; 1 Stripe new-grad role in Bucharest kept as location unknown (flagged, as designed). 0 deadlines published.
  - `npm test` → 214 passed.
- Next step: P1-T5 worker.

### 2026-10-01, P1-T5: worker
- Did: `worker.js` (node-cron 4, tz Asia/Kolkata, noOverlap, start heartbeat, SIGTERM/SIGINT), `services/careers/jobs.js`, `fetcher-acc` compose service (`docker compose config --services` lists it).
- Checks run + actual results: started two workers together; wrote `careers.runRequest = {sourceId: 6}` at 12:22:47Z. Worker 1: `run request: source 6 ...` then `source #6 GREENHOUSE/groww OK fetched=7 kept=3 new=0 dup=0 seen=3`; worker 2: `job runRequests skipped: already running elsewhere`. Afterwards `runRequest = null`, heartbeat `{ at: 12:24:00Z, job: 'runRequests' }`.
- Not verified: SIGTERM handler output (Windows has no real signals; check on the VM / in Docker). The fetcher-acc image was not built locally (same Dockerfile as backend-acc).
- Next step: P1-T6.

### 2026-10-01, P1-T6: review queue, sources and ops admin API
- Did: review list (pending/flagged), posting detail, PATCH, approve (+edits), reject, expire, reopen, bulk-approve, manual create, submissions list; sources list/create(validate)/patch/run/run-all/runs; ops summary + alerts. Unit tests for planEdit, checkCompensation, bulkSkipReason, reviewWhere, mergeRunRequest, alerts, IST boundaries.
- Checks run + actual results (`scratchpad/http_t6.mjs`, API on :3000):
```
PASS  student gets 403 on all 17 new admin endpoints  (403,403,403,403,403,403,403,403,403,403,403,403,403,403,403,403,403)
PASS  review pending/flagged 200  (pending=18 flagged=22 counts={"pending":18,"flagged":22,"candidates":6,"submissions":0})
PASS  tabs never overlap
PASS  flagged items all have uncertain fields or low confidence
PASS  bad tab -> 400
PASS  posting detail has observations + reviews  (#72 Associate, Mid Market Sales)
PASS  missing posting -> 404
PASS  PATCH saves changes with a diff  ({"type":{"from":"UNKNOWN","to":"INTERNSHIP"},"skills":{"from":[],"to":["React","Python"]}})
PASS  PATCH clears the edited field from uncertainFields
PASS  EDIT review row written with changes
PASS  PATCH 0 for undisclosed pay -> 400
PASS  PATCH unknown field -> 400
PASS  approve -> LIVE + publishedAt, uncertain cleared  (Approved. The posting is live.)
PASS  approve twice -> 409
PASS  expire LIVE -> EXPIRED
PASS  reopen approved posting -> LIVE  (Reopened as LIVE.)
PASS  reject without reason -> 400
PASS  reject -> REJECTED with reason
PASS  reopen rejected -> PENDING_REVIEW
PASS  bulk-approve approves clean ones, skips flagged with reasons  (Approved 2; skipped 2. [{"id":94,"reason":"MANUAL postings need an individual review"},{"id":93,"reason":"MANUAL postings need an individual review"}])
PASS  manual create with a new company name -> 201 PENDING, company flagged  (Posting created and waiting for review.)
PASS  manual duplicate apply link -> 409
PASS  manual publish with a CANDIDATE company -> 409 COMPANY_NOT_ACTIVE  (Another Candidate 1790857891350 is CANDIDATE. Approve or merge it in Companies first, or pick another company.)
PASS  manual publish with an ACTIVE company -> 201 LIVE  (Posting published.)
PASS  manual without company -> 400
PASS  submissions list 200
PASS  sources list  (14 sources)
PASS  add board with a bad token -> 400 BOARD_INVALID
PASS  add an existing board -> 409
PASS  add board with an invalid token format -> 400
PASS  disable source -> DISABLED
PASS  run a disabled source -> 409
PASS  enable source -> UNKNOWN
PASS  run now -> 202 + runRequest {sourceId: 4}
PASS  second source while one waits -> ALL
PASS  run-all -> 202
PASS  recent runs  (4 runs)
PASS  cannot disable a system source
PASS  ops summary  ({"sources":{"total":12,"ok":10,"failing":1,"zeroResults":0,"disabled":0},"queue":{"pending":16,"flagged":22,"candidates":8,"submissions":{"received":0,"extracting":0,"failed":0,"storedOnly":0}},"postings":{"live":14,"expiredLast7d":0,"newLast24h":52}})
PASS  ops alerts include the failing bogus board  (red:SOURCE_FAILING)
PASS  ops llm block present (reachability unknown until P1-T10)

41/41 passed
```
- Endpoints checked: GET review, GET/PATCH postings/:id, POST postings/:id/{approve,reject,expire,reopen}, POST postings/bulk-approve, POST postings, GET submissions, GET/POST sources, PATCH sources/:id, POST sources/:id/run, POST sources/run-all, GET sources/:id/runs, GET ops.
- Dev data changed by the checks: some postings approved (LIVE), one rejected, two manual postings + candidate companies `Acme Robotics Test <ts>` / `Another Candidate <ts>` created.
- Next step: P1-T7.

### 2026-10-01, P1-T7: review queue UI + manual entry
- Did: Jobs review page (4 tabs with counts, bulk approve), PostingEditor (two panes on xl, uncertain highlight, confidence meter, sticky footer: Reject with reason / Save / Approve & publish / Mark expired / Reopen), ManualPosting, CompanyPicker; routes + sidebar.
- Checks run + actual results (browser, admin login, 1280 px): flagged Cloudflare #71 type changed to Full-time + Approve & publish → DB `LIVE`, `publishedAt` set, `uncertainFields []`, review `APPROVE {type: UNKNOWN→FULL_TIME}`; "Incident Response Analyst - React" rejected → `REJECTED`, reason "Not an early-career role"; Pending → Select page → "Approved 16; skipped 0" and the empty state reads "No postings waiting for review. Last ingestion: 1 Oct 2026, 5:53 pm, 1669 jobs fetched, 52 new postings in the last 24 hours."; manual posting (Groww, RANGE ₹60,000–80,000) Publish now → `LIVE`, tier MANUAL; candidate "Acme Robotics Test …" approved from the tab. Student login → Access Denied on /admin/careers/review. 375 px: no horizontal scroll (scrollWidth 375), editor stacks with the footer visible; confidence meter label now wraps.
- Lint: changed files 0 errors; `npx eslint src` = 36 errors (baseline). `npm run build` ✓.
- Not verified in the browser: Save without approve (covered by the T6 HTTP checks).
- Next step: P1-T8.

### 2026-10-01, P1-T8: Sources + Operations UI
- Did: Sources page (health badges, error text for FAILING, enable/disable, Run now / Run all, recent runs, Add board dialog), Operations page (alerts banner red→amber with links, 5 stat cards, Feature flags card with toggles + limits, confirmation dialog for student visibility), routes + sidebar "Sources & Ops".
- Checks run + actual results (browser, 1280 px): Sources shows `FAILING Bogus test board … HTTP 404 from boards-api.greenhouse.io (2 failed runs in a row)` in red; Operations shows red alert `Bogus test board is failing: HTTP 404 …`. Heartbeat set to 45 min ago → red `The worker has not reported for 45 minutes. No sources are being fetched.` and Worker card "Stale". Toggle "Show Jobs & Internships to students" → confirmation dialog → student `GET /careers/status` = `{"enabled":true,"visibleToStudents":true}`; switched back off afterwards. 375 px: no element overflows on ops / review / new / sources (checked by script).
- Bugs found + fixed: confirm dialog trapped inside the blurred card; header buttons wrapping / overflowing on mobile.
- Lint: changed files 0 errors; `npx eslint src` = 36 (baseline). Build ✓.
- Dev state: `careers.workerHeartbeat` is the fake 45-min-old value (any worker run replaces it); `visibleToStudents` = false.
- Next step: P1-T9.

### 2026-10-01, P1-T9: student link pipeline (no LLM)
- Did: ipGuard, canonicalUrl, blockedDomains, atsLink (GH/Lever single-job API, Ashby board lookup), jsonLd, safeFetch (undici Agent with guarded lookup, manual redirects, caps), processSubmission(s), submissions controller + rate limit, worker job + CLI. 84 new unit tests (every blocked range, URL checks, mocked-DNS lookup, canonical URLs, ATS link parsing, JSON-LD fixture).
- Checks run + actual results (student, visibleToStudents temporarily on):
```
student submit 201 #1 http://127.0.0.1/admin
student submit 201 #2 http://169.254.169.254/latest/meta-data/
student submit 201 #3 http://10-0-0-1.nip.io/
student submit 201 #4 https://www.linkedin.com/jobs/view/4012345678/?trk=public_jobs
student submit 201 #5 https://boards.greenhouse.io/stripe/jobs/8031833
6th submission in 24 h -> 429 RATE_LIMITED "You can share up to 5 links a day. Please try again tomorrow."
same job link again (tracking params) -> 200 "This link was already shared. Thanks!" #5
=== npm run careers:job -- links
[careers] submission #1 failed: Address 127.0.0.1 is not allowed
[careers] submission #2 failed: Address 169.254.169.254 is not allowed
[careers] safeFetch GET 10-0-0-1.nip.io/
[careers] submission #3 failed: 10-0-0-1.nip.io resolves to a blocked address (10.0.0.1)
[careers] submission #4: www.linkedin.com is store-only; not fetched
[careers] safeFetch GET example.com/
[careers] processed 6 submission(s): {"FAILED":4,"STORED_ONLY":1,"DUPLICATE":1}
```
  - No `safeFetch GET` line for LinkedIn (proves no request). #5 → DUPLICATE of posting #59, which now has 3 observations: `STUDENT_LINK https://boards.greenhouse.io/stripe/jobs/8031833 | GREENHOUSE …gh_jid=8031833 | GREENHOUSE …gh_jid=8130807` (PRD success criterion 3).
  - #6 (admin, https://example.com/) → FAILED "The page has almost no text (167 characters)…". The API process made 0 outbound fetches (all in the worker job).
  - visibleToStudents set back to false.
- Not verified live: a real JSON-LD page (covered by the fixture test) and the EXTRACTING path (exercised in P1-T10's smoke test).
- Next step: P1-T10.

### 2026-10-01, P1-T10: LLM extraction (provider layer + local Qwen + verify.js)
- Did: schema (JSON schema + zod), prompt, providers/ollama, callModel, providerStatus (plugged into /ops), verify, outcome, pricing, budget, runExtractions, applyExtraction, branchCodes; job `linksAndExtraction` now runs processSubmissions then runExtractions. 41 new tests (incl. the 29 Sep case: FULL_TIME→INTERNSHIP, paraphrased pay dropped → NOT_DISCLOSED, confidence 100 → 0.5 → −0.15 −0.10 = 0.25; invented company / skill / deadline dropped; mocked fetch: success, ECONNREFUSED → stays QUEUED + backoff + stop + alert, 404 → MODEL_MISSING/FAILED, done_reason length → FAILED, no strong model → no escalation, cost 0).
- Smoke test (real pages, qwen2.5:7b on the RTX 4060):
  - First try with institute programme pages (IIPE SIP, IIIT-B summer internship): Qwen correctly answered `is_job_posting:false` (programme announcements, no role title) → FAILED with that reason; verify caught Qwen adding "Stipend:" to the IIPE pay text (dropped as not verbatim). indiascienceandtechnology.gov.in timed out on connect (FAILED with the reason).
  - Real single-job pages without ATS links or JSON-LD (found by probing with safeFetch + jsonLd): loop.keka.com/careers/jobdetails/48372, app.semesteria.com/jobs/software-engineer-intern-bengaluru-mygyan-…, peerlist.io/company/google/careers/software-engineering-intern-summer-2026/…
  - Timings: 16.1 s cold, then 3.6 s / 4.0 s / 5.0 s (732–1832 input tokens, 154–217 output). LlmUsage rows provider=ollama, costUsd 0.
  - Results: #101 "Software Engineer Intern" (MyGyan, candidate) conf 0.40, stipend UNCLEAR raw "INR 30K"; #102 "Software Engineering Intern, Summer 2026" conf 0.55 but company "Colecta" (sidebar noise; should be Google); #103 Keka "Software Engineer - Intern" (after C-60) conf 0.55, company "keka". All PENDING_REVIEW, tier LLM_FAST, all in the Flagged tab (checked with reviewWhere).
- Done-when checks: `llmEnabled` off → `skipped: careers.llmEnabled is off`, row stays QUEUED. Ollama unreachable (OLLAMA_URL → closed port) → `extraction paused: … ECONNREFUSED`, row QUEUED (attempts 0); /ops `llm.usable=false` + `red:LLM_UNAVAILABLE … Links wait as QUEUED.`; back to normal → no alert, row processed.
- Not verified: actually stopping the Ollama app (simulated with a closed port instead); escalation with a real strong model (none configured locally; unit-tested).
- Dev state: `careers.llmEnabled` back to false; submissions #7–#12 + postings #101–#103 exist in the dev DB.
- Next step: P1-T10b (Gemini, needs the key) and P1-T11.

### 2026-10-02, plan change: P1-T10b and P1-T11 deferred
- User decision: skip P1-T10b (no Gemini key yet) and P1-T11 for now; continue with P2.
- Dependency check: nothing in P2/P3 needs them; P4-T2 requires `LLM_PROVIDER=gemini` (P1-T10b). P1-T11 needs no key and can be done any time before P4.
- Until then: student links that need the model use local Qwen (or wait QUEUED with `careers.llmEnabled=false`); manual / link postings are not re-checked for liveness (admins can expire them by hand).

### 2026-10-02, P1-T11: liveness recheck for manual / student-link postings
- Did: `recheckUpdate` / `recheckResult` (pure) in `ingest/liveness.js`; `links/recheckLiveness.js` (safeFetch each live MANUAL/STUDENT_LINK observation; 404/410 = miss; 2 misses → observation not live; posting with no live observation → EXPIRED; network errors / other statuses logged only; blocked domains skipped); job `recheckLiveness` (`30 5 * * *`, lock 81002) in `jobs.js`; CLI `runJob.js liveness`. 5 new tests (fake DB + fake fetch: 404 twice → EXPIRED; network error not counted; 200 resets; another live observation keeps the posting live; LinkedIn skipped).
- Checks: `npm test` → 373 passed (14 files). Dev DB, real fetches: run 1 `{checked:12, ok:3, gone:8, errors:1, dropped:0, expired:0}`; run 2 `{checked:12, ok:3, gone:8, errors:1, dropped:8, expired:8}` (the example.com test postings from P1-T6/T7, which really return 404); run 3 `{checked:4, ok:3, gone:0, errors:1}`. The 3 real job pages (Keka, Semesteria, Peerlist) stayed live; the Stripe Greenhouse link → TOO_MANY_REDIRECTS, not counted. `node worker.js` logs `recheckLiveness "30 5 * * *"` among the jobs.
- Not verified: the 05:30 cron firing for real (schedule registration only).
- Dev state: postings #93–#100 (example.com test data) are now EXPIRED.
- Next step: P2-T1.

### 2026-10-02, P2-T1: User.cpi migration + eligibility API
- Did: schema `User.cpi Decimal(4,2)?`, `cpiUpdatedAt DateTime?`; migration `20261002042222_careers_user_cpi` (reviewed: `ALTER TABLE "User" ADD COLUMN "cpi" DECIMAL(4,2), ADD COLUMN "cpiUpdatedAt" TIMESTAMP(3);`, forbidden-SQL grep empty), applied with `migrate deploy`; `migrate diff` DB→schema: no difference. Global omit in `config/db.js` (C-66). `postings/eligibility.js` + `eligibilityController.js`; routes `GET /careers/me/eligibility`, `PATCH /careers/me/cpi` (checkAuth + requireCareersEnabled). 24 new tests (16-case matrix incl. no roll number / no CPI, July year boundary, cpiBody).
- Checks: `npm test` → 397 passed (15 files). Prisma omit probe: findFirst / findMany / `include: { uploadedBy: true }` → no `cpi` key; explicit select → returns it. HTTP (`http_p2t1.mjs`): 26 passed, 0 failed: flag off → student 404 CAREERS_DISABLED, admin 200; student GET → `{branchName:'CS', academicYear:3, cpi:null, hasRollNumber:true}`; PATCH 8.25 → 200; PATCH 10.5 / -1 / 8.255 / "8.5" / {} / {cpi, userId} → 400 and CPI unchanged; with CPI set, no `cpi` key in /auth/me, /getuser/me, /careers/status, /careers/submissions/mine, /posts, admin review (flagged, pending), posting #59, submissions, ops, companies, sources; PATCH null → cpi and cpiUpdatedAt null; no cookie → 401. `grep -i cpi controllers/` (minus minCpi) → only eligibilityController.js.
- Not verified: upstream `GET /users` over HTTP (needs a SUPER_ADMIN login; covered by the findMany probe).
- Dev state: `careers.visibleToStudents` back to false; the dev student's CPI is cleared.
- Next step: P2-T2.

### 2026-10-02, P2-T2: postings list/detail API + company search
- Did: `postings/query.js` (zod query parser, null-safe pay clause, eligibility clause, base where, orderBy); `postingsController.js` (list with `meta.undisclosedIncluded`, `hiddenByEligibility`, `eligibility.applied/reason`; detail: LIVE for students, any status for career admins, observations with source name/kind, `companyExperienceCount`); `companiesController.js` `searchCompanies` (ACTIVE, name or alias, max 10, no flag gate). Fixed NULL array columns (C-69) and the recheck's `lastSeenLiveAt` (C-70, commit 4b0fb60). 19 new tests (query shapes) + 1 (buildPostingData arrays).
- Checks: `npm test` → 416 passed (16 files). HTTP (`http_p2t2.mjs`, temporary test values on #63/#64/#66/#67/#90, restored afterwards and verified): first run 37/40, the 3 eligibility checks failed (eligibleOnly hid all 28: NULL arrays) → fixed → **40 passed, 0 failed**: `minStipend=10000&includeUndisclosed=false` → only #64 (₹50k), #59 NOT_DISCLOSED excluded, ₹8k #63 and USD #90 excluded, undisclosedIncluded 0, no FULL_TIME; `includeUndisclosed=true` → 16 results incl. #59 and #90, undisclosedIncluded 15; default true; #59 card has null amounts; ME-only #66 → NOT_ELIGIBLE without the filter, hidden with `eligibleOnly` (hiddenByEligibility 1, applied true); #67 (year 3, CPI 7) → NEEDS_CPI with no CPI, hidden with CPI 6.5 (hidden 2), no `cpi` key in the response; type / location=Bangalore / q=stripe / paging / sort=lastSeen work; 5 bad query values → 400; detail #59 → 200 (3 observations: 2 Greenhouse + 1 student link, companyExperienceCount 0) without review internals; PENDING_REVIEW #68 and EXPIRED #93 → 404 for the student, 200 for the admin; unknown id 404, bad id 400; company search q=pay → Juspay, Paytm, Razorpay (id/name/slug only); flag off → student list/detail 404 CAREERS_DISABLED, admin list 200, company search still 200; no cookie 401.
- Not verified: a student without a roll number over HTTP (no such dev user; unit-tested: `NO_ROLL_NUMBER`).
- Dev state: test values restored (0 LIVE postings with disclosed pay / non-INR / branch limits / CPI cutoff); student CPI null; `visibleToStudents` false; API stopped.
- Next step: P2-T3 (jobs list page).

### 2026-10-02, P2-T3: jobs list page
- Did: student API methods in `careersApi.js`; `useCareersStatus`; jobs page with filters in URL search params (q, type, workMode, location, skills, minStipend, minCtcLpa → minCtc, includeUndisclosed, eligibleOnly, sort, page), sticky sidebar on lg / drawer below lg, results summary line, explained empty states, skeletons, pagination; EligibilityCard (branch/year read-only, CPI save/clear with the privacy note); badges per Design §5; route + flag-gated sidebar item (C-71).
- Checks (browser, student login, temporary test values on #63/#64/#66/#67/#89/#90/#91, flag on; restored afterwards and verified):
  - 1280 px: layout per Design §4. minStipend=10000 → "17 openings · 15 with undisclosed pay included"; unticking undisclosed → "2 openings" (₹40,000–60,000 /mo and ₹50,000 /mo); Eligible for me → "27 openings · 1 hidden by eligibility" (filter shows "1 hidden"); Full-time hides the stipend field → 11; location Noida → 7; reload keeps `?eligibleOnly=true&type=FULL_TIME&location=Noida`, the inputs and the pressed type button.
  - Empty state: `q=video editor&eligibleOnly=true` → "No openings match. 1 is hidden by \"Eligible for me\"." + Show all → the ME-only card with "Not eligible: ME only".
  - Badges: "$3,000 /mo", "Pay mentioned: see details", "₹12 LPA", "Undisclosed" (italic), "CPI ≥ 7.0 · add your CPI", "Eligibility not stated". CPI 6.5 saved (toast "CPI saved. It is only used to filter postings for you.") → that card "Not eligible: CPI ≥ 7.0" and hidden by the filter; Clear → empty input, posting back.
  - 375 px: no horizontal scroll (scrollWidth 375); "Filters (1)" opens the drawer with the eligibility card and filters, "Show 17 openings", Escape closes, count becomes "Filters (2)" after picking Internships. The sidebar toggle overlapping the title at 375 px is the upstream layout (same on Career Vault).
  - Flag off (after the 30 s settings cache): "Jobs & Internships isn't open yet." and no sidebar item. Console: 0 errors, 0 warnings.
- Found and fixed during the checks: freshness said "First seen today" for a posting from yesterday evening (24-hour periods) → calendar days.
- Lint: changed files 0 problems; `npx eslint src` = 36 errors (baseline). `npm run build` ✓.
- Not verified: a student without a roll number in the browser (no such dev user).
- Dev state: test values restored, student CPI null, `visibleToStudents` false; servers stopped; `.playwright-mcp/` deleted.
- Next step: P2-T4.

### 2026-10-02, P2-T4: job detail page + share a link
- Did: `JobDetailPage.jsx` (header with chips, freshness, deadline only when stated, PPO only when stated, Apply link, share button; description as plain text; rail: pay, eligibility, company, sources), `SourceLinks.jsx`, `SubmitLinkModal.jsx`, `MySubmissions.jsx`; jobs page header button; card → detail with `state.fromList` so "All openings" goes back to the filtered list; API additions and Escape-to-close (C-72).
- Checks (`browser_p2t4.mjs`, real Chromium via playwright-core, student login, flag on, test values on #59 deadline 15 Oct + PPO + years 3/4 + CPI 7 and #91 UNCLEAR pay + confirmed 5 days ago; all restored, test submission deleted): **24 passed, 0 failed**. Card opens "Operations Associate, Apprenticeship"; "All openings" → `/jobs?type=INTERNSHIP`. #59: "First seen yesterday · confirmed live yesterday", "Deadline stated by source: 15 Oct 2026", "PPO mentioned by the source", 3 of 3 sources listed (stripe.com ×2, boards.greenhouse.io), all `_blank` + `noopener noreferrer`, Apply → https://stripe.com/jobs/search?gh_jid=8031833, eligibility "3rd, 4th", "Minimum CPI: 7", badge "CPI ≥ 7.0 · add your CPI". #91: "Pay mentioned: see details" + raw text verbatim, "confirmed live 5 days ago" with an amber dot, no deadline/PPO lines. PENDING_REVIEW #68 and id `abc` → "This posting is not available." Shared `https://example.org/careers/p2t4-test-…` → toast + "Being processed"; `linksJob` → FAILED (HTTP 404 from example.org); after Refresh → "Couldn't be read" + "HTTP 404 from example.org". The earlier Stripe link shows "Live on the portal · View posting". 375 px: scrollWidth 375, rail before the description. No console errors (the deliberate 404/400 resource errors excluded).
- Found and fixed during the checks: Escape didn't close the dialog (shared Modal); on phones pay/eligibility came after a very long description.
- Also: `npm test` → 416 passed; client changed files lint 0, `npx eslint src` 36 errors (baseline); `npm run build` ✓.
- Not verified: the "Already listed" (DUPLICATE) status in the browser (covered by the P1-T9 HTTP checks); the "← All openings" arrow sits under the upstream sidebar toggle at 375 px (layout issue on every dashboard page).
- Dev state: test values restored, `visibleToStudents` false, servers stopped, Docker still running.
- Next step: P3-T1.

### 2026-10-02, P3-T1: company API + pages
- Did: `listCompanies`, `getCompanyPage` (+ `directory.js` pure: query, where, counts, ranking; `cards.js` shared with postings); routes (search before :slug; flag-gated except search); client CompaniesPage (search in URL, cards with open-role / experience counts, paging), CompanyPage (counts, Open roles with JobCards, Experiences from seniors with expandable ExperienceCards), Companies tab, company links from the job detail page (C-73). 5 new tests.
- Security: Career Vault renders experience HTML unsanitised and `addpost`/`editPost` take `status` from the body (a student can self-publish) → stored XSS. Added as item 14 (High) to the local `upstream_vulnerabilities.md` (gitignored; not committed). ExperienceCard follows the rule to render the same way (decision above).
- Checks (`browser_p3t1.mjs`, playwright-core + Chromium 1223 because the Playwright MCP failed to connect; temporary: experiences #1, #2 linked to Google, posting #102 moved to Google and LIVE, flag on; all restored): **21 passed, 0 failed**. Directory: Google "1 open role | 2 experiences"; order Paytm, Groww, Rubrik, Sarvam AI, Stripe; Companies tab `aria-current=page`; search "goo" → Google only, `?q=goo`. Google page: "1 open role", "2 experiences from seniors", posting "Software Engineering Intern, Summer 2026", both experiences; expanded body innerHTML === stored description, classes `text-slate-600 leading-relaxed quill-content text-sm`. Posting card → job detail; company name there → company page; `/companies/google-cloud` (merged) → `/companies/google`; `colecta` (CANDIDATE) and an unknown slug → "This company page does not exist."; 375 px scrollWidth 375 on both pages; no console errors; company JSON has no `cpi` with CPI 8.5 set; flag off → directory 404 CAREERS_DISABLED, picker search 200.
- Also: `npm test` → 421 passed (17 files); client changed files lint 0, `npx eslint src` 36 (baseline); build ✓.
- Dev state: restored (#102 back to Colecta/PENDING_REVIEW, experiences unlinked, flag false, CPI null); servers stopped.
- Next step: P3-T2 (experience backfill).
