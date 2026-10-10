# Phases: build order

Deadline: **Sat 10 Oct 2026**. Today: Tue 29 Sep 2026.
Each task (`Px-Tn`) is sized for **one AI coding session**, with one commit or more.
"Done when" lists the checks that must actually pass (record the results in Memory.md).
Paths are relative to `academic-council-portal/`. Details live in `Architecture.md` (§ refs).

| Phase | Dates | Goal |
|---|---|---|
| P0 Foundation | 29 Sep – 1 Oct | Local env, schema foundation, feature flag, company registry with merge/split/undo |
| P1 Ingestion | 1 – 4 Oct | Worker, ATS adapters, tier-2 pipeline, dedup, student links, local-LLM extraction, review queue, ops |
| P2 Browsing | 5 – 6 Oct | Student job list, null-safe and eligibility filters, CPI, detail page, freshness, submit link |
| P3 Linking | 7 – 8 Oct | Company pages, experience ↔ company links, backfill, picker on the experience form |
| P4-lite + Buffer | 9 – 10 Oct | Saved and tracking, demo seed, QA pass, PR |
| P5 Admin control | after 10 Oct (before go-live) | All postings page, take down, admin bar, student-link retry/dismiss, review badge, explainer (F-01 – F-03, F-09, F-16, F-18, F-28) |
| P6 Student value | first month after launch | More boards, new-for-you count, quick filters, apply nudge, deadline sort, reports, safer bulk, hide, notes, source edit/archive |
| P7 Depth | after P6 | Alerts ⚖️, graduation-batch eligibility, season/duration, usage numbers, more ATS types, admin tooling |
| P8 Needs a decision | only with the user's OK | Seniors' stipend aggregates, permanent delete, test-data cleanup |

**Rule for slippage:** if a phase runs over, cut from the end of *that* phase's optional tasks
(marked ◇), never from P3. P3 is the proposal's core argument. P4-lite is dropped first.

---

## P0: Foundation

### P0-T1 Fork, branch, local environment (the user does the GitHub part)
- **Already done (29 Sep):** the user forked on GitHub; locally `origin` was renamed to `upstream` and branch
  `feat/jobs-fetcher` was created. `origin` = `https://github.com/MutantCoder123/academic-council-portal` (added 29 Sep).
  Push with `git push -u origin feat/jobs-fetcher`. The AI never pushes to `upstream`.
- AI: follow Architecture §12 "Local dev". Create `server-acc/.env` and `client-acc/.env` locally
  (gitignored). Run the existing migrations with `npx prisma migrate deploy`.
- Add `server-acc/scripts/careers/seedLocalDev.js` (**refuses to run if `NODE_ENV=production`**). It
  upserts two users with bcrypt passwords (read from `DEV_SEED_PASSWORD` in `server-acc/.env`; the user chose the value; it goes only in the gitignored `.env`, never in code, docs or `.env.example`):
  student `devstudent_2401cs98@iitp.ac.in` (rollNo 2401CS98, branchName CS, admissionYear 2024,
  program BTECH) and `devadmin_2401ee97@iitp.ac.in` (role CAREER_ADMIN), plus about 12 PUBLISHED
  demo `Experience` rows (uploadedBy = the dev student). Their titles mention real
  companies in varied spellings ("My Google India internship", "Interview at GOOGLE LLC",
  "Microsoft SWE intern", "Goldman Sachs Analyst", ...).
- **Done when:** the API is on :3000, the client on :5173, both dev users can log in, Career Vault
  shows the demo experiences, and `git status` shows only intended files.

### P0-T2 Test tooling and server deps
- Add deps (Architecture §11) and the scripts `test`, `test:watch`, `worker`, `careers:job`, `careers:seed`.
- Add `server-acc/vitest.config.js` (node env, `tests/**/*.test.js`) and one sanity test.
- Add `server-acc/.env.example` listing the env **names** (no values) for new and existing keys.
- **Done when:** `npm test` passes with 1 test, and `npm run dev` still starts.

### P0-T3 Migration `careers_foundation`
- Schema: Company, CompanyAlias, CompanyMergeLog, AppSetting, their enums, `Experience.companyId` + index (Architecture §4).
- `npx prisma migrate dev --create-only --name careers_foundation`, **read the SQL** (AI_Rules §3), apply it.
- **Done when:** the migration SQL contains only CREATE / ADD COLUMN / ADD CONSTRAINT / CREATE INDEX
  (paste the statement list into Memory.md), `npx prisma migrate status` is clean, and existing
  Career Vault pages still work.

### P0-T4 Settings service, job lock, careers middlewares, router skeleton
- `services/careers/settings.js` (§5), `jobLock.js`, `heartbeat.js`, `academicYear.js` (+ test).
- `middlewares/careers/requireCareerAdmin.js`, `requireCareersEnabled.js`.
- `routes/careers.js` with `GET /careers/status`; `routes/careersAdmin.js` with `GET/PUT /careers/admin/settings`.
- Mount both in `server.js` (+2 lines).
- **Done when:** `/careers/status` returns `{enabled:false,isCareerAdmin:...}` for both dev users; the
  settings PUT works for the admin and gives **403 JSON** for the student (not 500); tests pass.

### P0-T5 Text normalisers (pure + tests)
- `text/normalize.js` (company, title, location), `text/html.js` (§6.2).
- Tests must include: "Google India", "Google LLC", "google", "GOOGLE INDIA PVT. LTD." → the same
  normalised name; "Software Engineer Intern - Summer 2026" vs "Software Engineer" stay different;
  "Bangalore, India" → `bengaluru`.
- **Done when:** ≥ 20 assertions pass.

### P0-T6 Company matcher and resolver
- `companies/matcher.js` (pure, §7), `companyIndex.js`, `resolveCompany.js`.
- `prisma/seedCareers.js` (idempotent upserts): settings defaults; about 60 companies commonly in
  IITP experiences (Google, Microsoft, Amazon, Adobe, Goldman Sachs, JPMorgan Chase, Morgan
  Stanley, DE Shaw, Tower Research, Flipkart, Uber, Atlassian, Salesforce, Oracle, Intuit,
  Qualcomm, Texas Instruments, Samsung, Nvidia, Intel, AMD, Cisco, Walmart, American Express,
  Deutsche Bank, Barclays, Wells Fargo, Media.net, Rubrik, Nutanix, ServiceNow, Sprinklr, Razorpay,
  Zomato, Swiggy, PhonePe, Paytm, CRED, Meesho, Groww, Zepto, Juspay, Postman, BrowserStack,
  Dream11, MakeMyTrip, InMobi, Zeta, Databricks, Cloudflare, Stripe, Coinbase, Notion, OpenAI,
  Ramp, Linear, Airbnb, Visa, Mastercard, Arcesium), each with 1–3 SEED aliases.
  **Sources are added in P1-T3, not here.**
- Tests: exact / normalised / fuzzy / none; the threshold blocks "Meta" ↔ "Beta"; the length guard works.
- **Done when:** `npm run careers:seed` runs twice with no duplicates, and the tests pass.

### P0-T7 Merge / split / undo service + admin company API
- `companies/mergeService.js` (§7) + `adminCompaniesController.js` + routes (§9.2 company rows + merge-log).
- Integration check (a script or manual curl, against the local DB): merge "Google LLC" (candidate)
  into Google, split it back out, undo the split, undo the merge; experiences follow each move.
- **Done when:** every step above gives the expected DB state (write the steps and results into
  Memory.md), and undoing an older entry when a newer one exists returns 409.

### P0-T8 Admin Companies UI
- `pages/admin/careers/Companies.jsx` (list/search, status tabs Active/Candidates/Merged, create,
  edit, aliases), `MergeDialog.jsx`, `SplitDialog.jsx`, `MergeLog.jsx` (with Undo).
- `careersApi.js` (admin company calls), routes in `App.jsx`, sidebar items (§9.3).
- **Done when:** the dev admin can do the P0-T7 flow entirely in the UI; the student gets
  Unauthorized on `/admin/careers/companies`; build passes and changed files lint clean.

---

## P1: Ingestion

### P1-T1 Migration `careers_ingestion`
- The models listed in the Architecture §4 migration table for P1. Review the SQL.
- The seed adds the system sources `MANUAL` and `STUDENT_LINK` (boardToken null, companyId null).
- **Done when:** the migration is additive (statement list in Memory.md) and the seed is idempotent.

### P1-T2 Deterministic processors (pure + tests)
- `text/compensation.js`, `fingerprint.js`, `skills.js` + `skillsDictionary.js`, `workMode.js`, `relevance.js` + `relevanceRules.js`.
- Compensation tests must cover: "₹40,000–60,000 per month" (range), "50k/month", "12 LPA",
  "12-18 LPA", "competitive", "", "$5000/month", "Stipend: 1.2L" (→ UNCLEAR unless clearly monthly), "unpaid" (→ DISCLOSED 0 is the **one** case where 0 is a real value; add a test).
- The fingerprint test: the same text with different whitespace or boilerplate gives Hamming ≤ 3,
  and unrelated text gives > 10.
- **Done when:** ≥ 40 assertions pass.

### P1-T3 ATS adapters + board verification
- `scripts/careers/verifyBoard.js <kind> <token>` prints the job count plus the first job's keys, and saves a trimmed fixture.
- Implement `adapters/greenhouse.js`, `lever.js`, `ashby.js`, `index.js`. **Write the mappers against the saved fixtures** (Architecture §6.1).
- Candidate boards to **verify, not assume** (keep only those returning ≥ 1 job; record the results in Memory.md):
  Greenhouse `databricks`, `cloudflare`, `stripe`, `coinbase`, `airbnb`, `postman`, `razorpaysoftwareprivatelimited`, `phonepe`;
  Lever `cred`, `meesho`, `zeta`, `groww`, `dream11`;
  Ashby `notion`, `openai`, `ramp`, `linear`, `zepto`.
  Add the verified ones to `seedCareers.js` as `Source` rows linked to their company.
  **Target: ≥ 5 verified sources, ideally ≥ 1 per ATS.**
- **Done when:** each mapper's test passes on its fixture, and ≥ 5 sources are seeded.

### P1-T4 runSource / ingestAll / dedup / upsert / health / liveness (ATS)
- `ingest/runSource.js`, `ingestAll.js`, `dedup.js` (pure `isSamePosting` + tests), `upsertPosting.js`, `health.js` (pure + tests), and the ATS part of `liveness.js` (§6.2–6.3).
- `scripts/careers/runJob.js ingest [sourceId]`.
- **Done when:** running ingest locally creates PENDING_REVIEW postings with `SourceRun` counts. A
  second run creates **0 new** postings and only updates `lastSeenAt`. A source with a bogus token
  becomes FAILING while the others still succeed. Paste the run counts into Memory.md.

### P1-T5 Worker process
- `worker.js` (§12), cron table, `withJobLock`, heartbeat, `checkRunRequests`, SIGTERM handling.
- Add the `fetcher-acc` service to `docker-compose.yml`.
- **Done when:** `npm run worker` starts; an admin `PUT` of `careers.runRequest` (or `POST /sources/:id/run`) triggers a run within about 1 minute; the heartbeat updates; two workers started together don't run the same job twice (the lock log shows a skip).

### P1-T6 Review queue API + admin sources/ops API
- `adminReviewController.js` (review tabs, get, patch, approve, reject, expire, reopen, bulk-approve, manual create) with `PostingReview` diffs.
- `adminSourcesController.js` (CRUD with validate-on-create, run, run-all, runs), `adminOpsController.js` (§10).
- **Done when:** curl/HTTP checks pass for each endpoint (list them in Memory.md); approve sets LIVE plus `publishedAt`; bulk-approve skips flagged items; the student gets 403 on all of them.

### P1-T7 Review queue UI + manual entry
- `ReviewQueue.jsx` (tabs Pending / Flagged / Candidate companies / Student links), `PostingEditor.jsx` (shared by review and manual; uncertain fields highlighted with `UncertainField`; confidence meter; raw source text side by side), `ManualPosting.jsx`.
- **Done when:** the admin can approve, edit+approve, reject and bulk-approve in the UI; a manual posting can be created and published; candidate companies can be approved or merged from the tab; build passes and changed files lint clean.

### P1-T8 Sources + Operations UI
- (The `llm` part of the ops summary is a placeholder until P1-T10.) `Sources.jsx` (list, health badges, add source, enable/disable, Run now, recent runs drawer), `Operations.jsx` (alerts banner, stat cards, flag toggles for the §5 keys).
- **Done when:** a FAILING source shows red with its error text; "worker stale" shows when the worker is stopped for more than 20 min (or when the heartbeat is faked old); toggling `visibleToStudents` flips `/careers/status` for the student.

### P1-T9 Student link pipeline (without the LLM)
- `links/ipGuard.js` (pure + tests covering every range in §7a), `canonicalUrl.js`, `blockedDomains.js`, `atsLink.js`, `jsonLd.js` (+ tests with an HTML fixture), `safeFetch.js`, `processSubmission.js`.
- `submissionsController.js` + `submissionRateLimit.js`; the worker runs `processSubmissions` every 10 min.
- **Done when:**
  - `http://127.0.0.1`, `http://169.254.169.254/`, and a hostname resolving to 10.x are rejected (FAILED with a reason)
  - a LinkedIn URL gives STORED_ONLY with no network request (log proves it)
  - a Greenhouse job URL for an already-ingested job gives DUPLICATE, with a second `PostingSource` on the same posting (this is PRD success criterion 3)
  - the 6th submission in 24 h returns 429

### P1-T10 LLM extraction: provider layer + local Qwen (Ollama)
- **Prerequisite (already true on the dev machine):** Ollama running, `ollama list` shows `qwen2.5:7b`. If not: `ollama pull qwen2.5:7b`.
- Build (Architecture section 8): `extract/schema.js` (+ zod tests), `prompt.js`, `providers/ollama.js`, `callModel.js`, `verify.js` (**most tests here**), `pricing.js`, `budget.js`, `runExtractions.js`, `applyExtraction.js`. Add `LLM_PROVIDER`, `OLLAMA_URL`, `CAREERS_LLM_*` to `.env.example` (names only).
- `verify.js` tests must include the real failure seen on 29 Sep: input "Acme Robotics Pvt Ltd is hiring a Software Engineering Intern ... Stipend: competitive." with model output `{type:"FULL_TIME", compensation_text:"competitive stipend", overall_confidence:100}` -> type corrected to INTERNSHIP, `compensation_text` dropped (not verbatim) -> NOT_DISCLOSED, confidence invalid -> 0.5 then penalised then capped <= 0.7. Also: invented company name dropped; a skill not in the text dropped; a made-up deadline dropped.
- Other unit tests (mock `fetch`): success -> posting in **Flagged**; connection refused -> stays QUEUED with a later `nextAttemptAt` + red-alert flag; 404 model missing -> FAILED; `done_reason: "length"` -> FAILED; no strong model configured -> no escalation; usage recorded with cost 0.
- **Real smoke test (free, local, no approval needed):** submit 3 real non-ATS job pages (no JSON-LD) -> each becomes a PENDING_REVIEW/Flagged posting with `extractionTier LLM_FAST` and an `LlmUsage` row. Record timings and the observed quality problems in Memory.md.
- Add `extract/providerStatus.js` (`{provider, reachable, modelPresent, keyPresent, lastError}`; ollama: `GET /api/tags`, 3 s timeout) and plug it into `adminOpsController` (until now the `llm` block of `/ops` returned `enabled:false` placeholders) so the red/amber LLM alerts of Architecture section 10 work.
- **Done when:** tests pass; smoke result recorded; turning `careers.llmEnabled` off stops extraction; stopping Ollama shows a red alert on the operations page and items stay QUEUED.

### P1-T10b Gemini provider (REQUIRED for the final phase; Qwen is for testing only)
- Schedule: build the adapter + mocked tests right after P1-T10; switch the live config to Gemini before P4-T2 (demo readiness). Needs the user's `GEMINI_API_KEY`.
- `npm i @google/genai`, write `providers/gemini.js` per section 8.1, unit-tested with a mocked SDK (finishReason mapping, error mapping, usage mapping incl. thinking tokens).
- With a real key: set `LLM_PROVIDER=gemini` + model env vars, verify the nullable-schema form once (section 8.1), rerun the three smoke pages, note quality/latency vs Qwen in Memory.md.
- **Done when:** the switch works by changing env only; Qwen still works when switched back.

### P1-T11 ◇ Liveness recheck for manual / link postings
- `recheckLiveness` (05:30) via `safeFetch` (§6.3).
- **Done when:** a posting whose URL returns 404 twice becomes EXPIRED (simulate with a local test server, or unit-test the decision function).

---

## P2: Student browsing

### P2-T1 Migration `careers_user_cpi` + eligibility API
- `User.cpi`, `User.cpiUpdatedAt`. `postings/eligibility.js` (pure + tests: branch/year/CPI matrix, no roll number, no CPI).
- `eligibilityController.js`: `GET /careers/me/eligibility`, `PATCH /careers/me/cpi` (zod: 0–10, 2 dp, or null).
- **Done when:** the migration is additive; the dev student can set and clear CPI; CPI never appears in any other careers response (grep the controllers).

### P2-T2 Postings list/detail API
- `postings/query.js` (pure builder + tests for the §9.1 where-clauses), `postingsController.js`, `companiesController.js` (`search` only for now).
- **Done when:**
  - a LIVE posting with NOT_DISCLOSED stipend is **excluded** by `minStipend=10000&includeUndisclosed=false` and **included** (and counted in `meta.undisclosedIncluded`) with `includeUndisclosed=true` (PRD criterion 5)
  - `eligibleOnly` hides a posting restricted to `ME` for the CS student and reports `hiddenByEligibility`
  - a non-LIVE posting 404s for students
  - the flag off gives 404 `CAREERS_DISABLED` for the student and works for the admin

### P2-T3 Jobs list page
- `JobsPage.jsx`, `JobFilters.jsx` (a drawer on mobile), `JobCard.jsx`, `CompensationBadge.jsx`, `EligibilityBadge.jsx`, `EligibilityCard.jsx` (branch/year read-only, CPI input with the privacy note), `EmptyState.jsx`, `CareerVaultTabs.jsx`, `useCareersStatus.js`. Routes plus the sidebar item (flag-gated).
- Filter state lives in URL search params (shareable, survives refresh).
- **Done when:** filters work; the undisclosed and eligibility counts are shown; the empty state
  explains why ("12 postings hidden by eligibility"); 375 px and 1280 px look right; build passes and changed files lint clean.

### P2-T4 Job detail page + submit link
- `JobDetailPage.jsx`, `FreshnessLine.jsx`, `SourceLinks.jsx`, `SubmitLinkModal.jsx` (+ "My submissions" list with statuses).
- **Done when:** the freshness line reads "First seen N days ago · confirmed live today/N days ago"
  (amber if > 3 days); a deadline is shown only when stated, with the "stated by source" label; all
  source links are listed; submitting a link shows its status later.

---

## P3: Linking layer (the integration argument; do not cut)

### P3-T1 Company API + pages
- `companiesController.js` (list, `:slug` per §9.1), `CompaniesPage.jsx`, `CompanyPage.jsx`, `ExperienceCard.jsx` (expandable, renders the description **the same way** `CareerVaultuser/index.jsx` does).
- **Done when:** the Google company page shows its LIVE postings **and** the linked demo experiences, with counts.

### P3-T2 Experience backfill (admin)
- `adminBackfillController.js`: for unlinked experiences, find the longest alias occurring in the title (word boundary) and also try the patterns `at X`, `@ X`, `X intern`, `X interview` through the matcher. Return the suggestion, method and score. `apply` / `unlink`.
- `ExperienceBackfill.jsx`: table with checkboxes, suggestion and a change-company picker, bulk apply, unlink.
- **Done when:** the demo experiences get correct suggestions (≥ 10 of 12); apply links them; unlink reverts; company pages update.

### P3-T3 Cross-links
- `ExperiencePanel.jsx` on the job detail page ("N past experiences at X →").
- `ForumController.getAllPosts`: add `company: { select: { id, name, slug } }` to the include, plus a live-posting count per company (**one** grouped query). Chip "N open roles at X →" on the experience cards in `CareerVaultuser/index.jsx`.
- **Done when:** both directions navigate correctly; the Career Vault list still loads with no extra N+1 queries (check the Prisma query log once).

### P3-T4 Company picker on the experience form
- `CompanyPicker.jsx` (react-select async → `/careers/companies/search`), added as an **optional** field in `CreatePostView`; `addpost`/`editPost` accept an optional `companyId` (it must exist and be ACTIVE, otherwise 400).
- **Done when:** a new experience with a company selected appears on that company page after admin
  publish; submitting without a company still works exactly as before.

---

## P4-lite + Buffer (9–10 Oct)

### P4-T1 ◇ Saved and application tracking
- Migration `careers_tracking`, `trackingController.js`, save toggle, `ApplicationStatusButton.jsx` (one click cycles through the statuses, plus a small menu), `SavedPage.jsx`, and a "New" badge (localStorage `careers.lastVisit`; wrap every access in try/catch).
- **Done when:** saving and status changes persist across reload; deleting the posting cascades cleanly.

### P4-T2 Demo readiness
- Confirm `LLM_PROVIDER=gemini` is active (P1-T10b done). Run real ingestion locally; approve about 30 postings; make sure at least 5 companies have both postings and experiences; enable the flag.
- Run through PRD §7 success criteria 1–10 one by one. Record pass/fail per item in Memory.md.

### P4-T3 Final QA and PR
- `npm test` (server), `npm run build` + `npx eslint` on every changed client file (0 errors) + `npx eslint src` ≤ 36 (client), `git diff upstream/main --stat` review:
  confirm only the files allowed by AI_Rules §4 changed among existing files.
- Draft the PR description (for upstream): what was added, the migrations list (all additive), new
  env vars, the new compose service, how to deploy (`prisma migrate deploy`, `docker compose up -d --build fetcher-acc`),
  how to roll back (flag off, then stop `fetcher-acc`), plus a pointer that a separate security report will be sent privately (do **not** paste `planning/upstream_vulnerabilities.md` into the public PR; the user sends it to the maintainers directly).
- **The user** opens the PR. The AI doesn't push to upstream.

---

## P5 – P8: Features after the 10 Oct plan (added 10 Oct; from `bugs_and_features.md`)

The features below come from `bugs_and_features.md` §2 (F-01 – F-32), in its suggested order (§3).
Each task names its backlog ID; the backlog has the full problem statement and design. This section
adds what a coding session needs: where the work goes, decisions already taken, and "Done when".

**Rules for these phases**
- **One feature = one task = one session** (two small ones are combined where noted). Each task gets
  its own commit(s): `feat(careers): P5-T1 F-01 all-postings admin page`.
- Same workflow as P0 – P4: failing test first, full `npm test`, client build, lint 0 on every changed
  client file and `npx eslint src` ≤ 36, real dev-DB check, browser check at 1280 and 375 px,
  then Memory.md / tracker / change_specsheet / bugs_and_features (Status line) / commits.
- 🗄️ = additive migration (`--create-only`, read the SQL, forbidden-SQL grep). Adding a value to an
  existing enum (`ALTER TYPE … ADD VALUE`) is **not** in AI_Rules §3's allowed list, so tasks below use
  nullable columns instead.
- ⚖️ = needs the user's explicit OK before the task starts (emails, permanent deletes, PRD stretch
  items, upstream files beyond AI_Rules §4). Those tasks are `[!]` in the tracker until approved.
- Upstream files: only `App.jsx` and `DashboardLayout.jsx` (routes, sidebar) are touched in P5 – P7.
- Nothing is auto-published; unknown stays unknown; no countdowns (PRD §6).
- The go-live checklist (L-01 – L-07, `bugs_and_features.md` §3) is not a feature list; it runs
  alongside, and P4-T2 / P4-T3 / P1-T10b stay open in P4 / P1.

| Phase | Goal | Tasks |
|---|---|---|
| P5 Admin control (before go-live) | Admins can find, fix and take down any posting; shared links never get stuck; students know what the section is | 7 |
| P6 Student value (first month) | More openings, faster to find, easier to track | 11 |
| P7 Depth | Better eligibility, alerts, more boards, admin tooling | 12 |
| P8 Needs a decision | Items the backlog parks until the user decides | 3 |

---

## P5: Admin control (before go-live)

Order note: F-09 comes before F-18 (the backlog lists F-18 first) because F-18's "Needs a person"
view uses F-09's **Create posting from this link** button.

### P5-T1 All postings admin page (F-01)
- API `GET /careers/admin/postings`: `q` (title or company, through `likeSafe`), `status`
  (LIVE / PENDING_REVIEW / EXPIRED / REJECTED / ALL, default LIVE), `companyId`, `sourceId`,
  `tier`, `hasDeadline`, `sort` (newest | lastSeen | deadline), `page`, `limit ≤ 50`. Rows: id,
  title, company, status, tier, publishedAt, lastSeenLiveAt, deadlineStated, saves and applications
  counts (`_count`, aggregate only). Lives in `adminReviewController.js` next to `listReview`
  (query builder in `services/careers/postings/adminList.js`, pure + tested).
- Client `pages/admin/careers/AllPostings.jsx` at `/admin/careers/postings` (App.jsx route; a tab
  on the Jobs Review page and an entry in the admin sidebar). Clicking a row opens the existing
  `PostingEditor` (already handles LIVE / EXPIRED: expire, reopen, reject).
- **Done when:** a LIVE posting can be found by title and by company and opened in the editor;
  each status filter returns only that status (counts match the DB); `%` search returns nothing;
  student → 403; 375 px has no sideways scroll.

### P5-T2 Take down a posting (F-02 level 1, reversible)
- "Take down" from the All postings row menu and from the editor: a dialog with a reason list
  (*Closed*, *Not for students*, *Duplicate*, *Spam*, *Wrong details*, *Other* + text).
  **Closed → `expire`** (the posting stays in students' Saved as "No longer live", as today);
  **every other reason → `reject`** with the reason text (it disappears from all student views,
  including Saved, because wrong or spam data must not stay visible). Uses the existing
  `/expire` and `/reject` endpoints; no schema change. Reopen stays available (existing `/reopen`).
- **Done when:** taking down a LIVE posting as *Closed* shows it as "No longer live" to a student
  who saved it; as *Spam* it 404s for students and leaves their Saved list; both are listed under
  the matching status in All postings and can be reopened; the `PostingReview` row records the
  admin and reason.

### P5-T3 Admin bar on the student job page (F-03)
- On `JobDetailPage.jsx`, when `useCareersStatus().isCareerAdmin`: a thin bar above the header:
  status chip, "Approved by <displayName> on <date>" (from the latest APPROVE `PostingReview`;
  `getPosting` adds `adminInfo` only for career admins), **Edit in admin** (opens the editor) and
  **Take down** (P5-T2 dialog).
- **Done when:** the bar shows for the career admin and never for a student (also absent from the
  student's API response); Take down from the bar works; 375 px fine.

### P5-T4 Student links: retry, create posting, withdraw (F-09, non-destructive part)
- Admin Student links tab (`ReviewLinks.jsx`): **Retry** for FAILED (→ RECEIVED, picked up by the
  next links run through the same SSRF path), **Create posting from this link** (opens Manual
  posting with the URL prefilled; the new posting's observation links back to the submission and
  sets its status to PENDING_REVIEW).
- Students can **withdraw** their own link while it is RECEIVED (marked withdrawn, not deleted;
  uses the P5-T5 columns, so P5-T4 adds them).
- 🗄️ nullable `LinkSubmission.dismissedAt`, `dismissReason`, `dismissedById` (shared with P5-T5).
- **Not built:** the backlog's hard **Delete** (⚖️). Spam links are **dismissed** instead (P5-T5).
- **Done when:** a FAILED link retried by the admin is processed again on the next run; a link
  turned into a manual posting shows the posting in the student's "My submissions"; a student can
  withdraw only their own RECEIVED link (others → 403/409); a withdrawn link is never processed.

### P5-T5 Shared links never wait forever (F-18)
- While `careers.llmEnabled` is off or the provider is unusable (`llmStatus`), links that reach the
  AI step are shown to the student as **"Waiting for an ACC admin"** (not "Being processed") and
  appear under a new **Needs a person** filter in the Student links tab with **Create posting from
  this link** (P5-T4) and **Dismiss** (reason picked or typed, shown to the student: e.g. "Not a job
  page"). Dismissed links are never processed again and are not re-shareable for 30 days (B-08
  logic respects `dismissedAt`).
- Ops alert (amber) when a link has waited more than 48 h (`ops/alerts.js`).
- When the AI tier is turned on later, waiting rows are processed as today.
- **Done when:** with `llmEnabled` off a non-ATS, non-JSON-LD link shows "Waiting for an ACC admin"
  to the student and appears under Needs a person; Dismiss shows the reason in My submissions; a
  row older than 48 h raises the amber alert; with `llmEnabled` on the same row is extracted.

### P5-T6 Review count in the admin sidebar (F-16)
- `GET /careers/admin/review/counts` → `{ pending, flagged, candidates, links }` (the counts
  `listReview` already computes, moved to a shared helper; cached 60 s in the client).
- `DashboardLayout.jsx` (AI_Rules §4): a small count badge on "Jobs Review" in both admin blocks.
- **Done when:** the badge equals pending + flagged in the DB, updates after an approve (on the
  next refresh or within 60 s), is hidden at 0, and never renders for students.

### P5-T7 "About these openings" (F-28)
- A dismissible banner on the jobs page (dismissal in localStorage, try/catch) and an
  **About these openings** panel (link in the page header): off-campus roles collected from company
  job boards and student links, reviewed by ACC; apply on the company's site; ACC does not run the
  hiring and this is not the placement cell's process; how to share a link; how to report a problem
  (P6-T7, mentioned only once it exists). Text only.
- **Done when:** the banner shows once, stays dismissed after reload, the panel opens from the
  header and closes with Escape; copy reviewed by the user; 375 px fine.

---

## P6: Student value (first month after launch)

### P6-T1 More boards (F-23)
- `scripts/careers/scanBoards.js`: checks a candidate list (`scripts/careers/boardCandidates.json`,
  ~150 companies that hire IIT students, Greenhouse / Lever / Ashby tokens) and prints which boards
  exist and how many India early-career roles each would keep (dry run, no DB writes).
- "Add boards in bulk" dialog on Sources (paste `kind token company` lines; each validated like
  Add board; summary of added / skipped / failed).
- Per-source quality on Sources & Ops: kept → approved → rejected over 30 days.
- **Done when:** the scan runs against the live APIs and lists results; bulk add of 5 lines adds the
  valid ones and reports the rest; quality numbers match the DB for 2 sources.

### P6-T2 "New for you" count in the student sidebar (F-21)
- `GET /careers/postings/new-count?since=<ms>` (LIVE, published after `since`, passing "Eligible
  for me" when the student has a roll number). `DashboardLayout.jsx` shows the count on "Jobs &
  Internships"; `since` = `careers.lastVisit` (the same value as the New badge); cached per session.
- **Done when:** the count equals the number of New badges on the jobs page for the same student;
  it disappears after visiting the jobs page; it is never shown while the feature is hidden.

### P6-T3 Quick filter chips (F-27)
- Chips above the list: *For me* (eligible only), *Internships*, *Remote*, *New this week*, and
  *My last filters*; each only sets URL params (shareable). Last filters in localStorage.
- **Done when:** each chip sets exactly its params and the results match the equivalent manual
  filters; the URL survives reload.

### P6-T4 "Did you apply?" nudge (F-26)
- Clicking **Apply** stores the time per posting in localStorage. Next time the student opens that
  posting or Saved: "You opened the application on 9 Oct. Mark as Applied?" → one click sets
  APPLIED (and saves). Nothing reaches the server until the student clicks.
- **Done when:** the nudge appears after an Apply click, Mark as Applied persists, Dismiss hides it
  for that posting, and no request is made until a click.

### P6-T5 Sort by deadline, filter by company (F-14)
- `sort=deadline` in `postings/query.js` (stated deadlines first, soonest first; the rest after,
  labelled "No deadline stated"); company filter (API already accepts `companyId`) with a company
  search in `JobFilters.jsx`.
- **Done when:** order is correct with mixed null / non-null deadlines (unit test); the company
  filter returns only that company; no countdown text anywhere.

### P6-T6 Deadlines on the Saved page (F-20, in-app)
- A "Deadlines stated by source" section on Saved: only postings with `deadlineStated`, by date;
  passed ones at the bottom. Plain dates ("Deadline stated by source: 15 Oct").
- **Done when:** only stated deadlines are listed, in date order; no countdowns.

### P6-T7 Report a problem (F-05) 🗄️
- `PostingReport` (postingId, userId, reason enum-like string, note ≤ 500, createdAt; unique per
  user + posting). "Report a problem" on the job page; count badge in the review queue and All
  postings; 3 reports add `reported` to `uncertainFields` (never auto-remove).
- **Done when:** a report is stored once per student; 3 reports from 3 students flag the posting;
  admins see the reasons; students never see who reported.

### P6-T8 Safer bulk actions (F-04)
- Undo in the bulk-approve success toast for 30 s (back to PENDING_REVIEW; clears `publishedAt`
  only when this action set it); bulk **reject** (reason) and bulk **expire** in the selection bar.
- **Done when:** approve 5 → Undo → all 5 back in Pending with `publishedAt` restored; bulk reject
  and expire write one `PostingReview` row each.

### P6-T9 Hide a posting (F-12) 🗄️
- `HiddenPosting` (userId, postingId, unique; cascades like `SavedPosting`); "Not for me" on cards;
  "Show hidden (n)" toggle.
- **Done when:** a hidden posting leaves only that student's list; toggle brings it back; deleting
  the posting cascades.

### P6-T10 Notes and dates on application tracking (F-13) 🗄️
- Nullable `PostingApplication.note` (≤ 500, text only) and `appliedAt` (set when the status first
  becomes APPLIED). Saved page shows "Applied on 3 Oct" and the note.
- **Done when:** note and date persist; the note renders as plain text (`<img onerror>` stays text).

### P6-T11 Edit and archive a source (F-07) 🗄️ (⚖️ only for hard delete)
- Edit dialog (name, company; token fixed). **Archive** (nullable `Source.archivedAt`: disabled,
  hidden by default, postings keep their history; "Show archived", Restore).
- Hard **Delete** of a source with no observations is ⚖️: built only if the user approves.
- **Done when:** edit persists; an archived source is skipped by the worker and hidden; restore
  brings it back.

---

## P7: Depth

### P7-T1 Job alerts by email (F-19) ⚖️ 🗄️
- `SavedSearch` (userId, filters JSON, frequency, lastSentAt); opt-in, max 3 per student; digest
  through the existing nodemailer transporter (never `notifyOnNewPost`); one-click unsubscribe;
  never sent while the feature is hidden. PRD stretch item: **needs the user's OK**.
- **Done when:** a digest lists only new LIVE postings matching the search, at most once per period,
  and unsubscribe works without login.

### P7-T2 Eligibility by graduation batch and programme (F-22) 🗄️
- Nullable `User.programme`, `User.graduationYear` (global omit like `cpi`); nullable
  `Posting.eligibleGradYears Int[]`; the eligibility card shows and lets the student correct them;
  "Eligible for me" matches graduation year first.
- **Done when:** a dual-degree student with a corrected graduation year sees a "2027 graduates"
  posting as eligible; the new columns appear in no other response.

### P7-T3 Internship season and duration (F-25) 🗄️
- Deterministic parser (like B-03) for "Summer 2027", "Winter", "6 months", "Jan – Jun 2027" →
  nullable `season`, `startMonth`, `durationMonths` (flagged for review); filter + card chip.
- **Done when:** parser unit tests on real titles pass; the filter returns only matching postings.

### P7-T4 Usage numbers for ACC (F-30) 🗄️
- Aggregate counts on Sources & Ops (LIVE postings, unique student visitors per week, saves,
  statuses, Apply clicks); per posting in All postings. Never per student.
- **Done when:** numbers match the DB for one week of dev data; no endpoint exposes per-student data.

### P7-T5 Review reminders (F-31) ⚖️
- Amber ops alert when items wait > 48 h; optional daily email to career admins (⚖️ email).
- **Done when:** the alert appears for an old pending item; the email (if approved) goes only to
  career admins and only when something is waiting.

### P7-T6 Share a posting (F-32)
- "Copy link" (portal URL) and "Share on WhatsApp" (title + URL) on the job page.
- **Done when:** copy puts the portal URL on the clipboard; the WhatsApp link opens with the text.

### P7-T7 SmartRecruiters and Workable adapters (F-24)
- Same `fetchPostings` contract as P1-T3, verified live first (AI_Rules §12), fixtures + tests.
- **Done when:** one real board per adapter ingests and dedups like the existing three.

### P7-T8 Merge two postings by hand (F-06)
- From All postings: pick two → "Merge into…" (observations, saves, applications move; the other
  becomes REJECTED "Duplicate of #N"); "Merge" button on the company-merge duplicate report.
- **Done when:** after a merge, students who saved either see one posting; observations moved; one
  `PostingReview` row per posting.

### P7-T9 Per-source keyword rules (F-08) 🗄️
- Nullable `Source.excludeTitleKeywords String[]`, `includeTitleKeywords String[]`, applied after
  the global relevance rules; run summary "dropped by source rules".
- **Done when:** a rule on one board drops only that board's matching titles (unit + live run).

### P7-T10 Experience shortcuts on company pages (F-10)
- For career admins on the company page: "Unlink from this company" (existing backfill unlink) and
  "Delete experience…" (calls the existing upstream delete with its confirm). No new delete logic.
- **Done when:** both actions work for a career admin and are absent for students.

### P7-T11 Candidate company cleanup (F-11) (⚖️ for deleting the candidate)
- Edit name / website before approving; **Reject** a candidate nothing LIVE uses: its postings go
  to Flagged with `company` uncertain; deleting the candidate row is ⚖️ (otherwise mark it merged
  into nothing / hidden).
- **Done when:** a rejected candidate no longer appears and its postings are in Flagged.

### P7-T12 Admin activity log (F-15)
- Read-only page listing `PostingReview` and `CompanyMergeLog` rows, filterable by admin and action.
- **Done when:** every approve / reject / expire / edit / create / merge from the dev session is listed
  with admin and time.

---

## P8: Needs a decision (do not start without the user's OK)

### P8-T1 Seniors' reported stipend and process (F-29) ⚖️ 🗄️
- Optional structured fields on the experience form, aggregates on company pages only when ≥ 3
  experiences report them. Touches the upstream experience form beyond AI_Rules §4's P3 allowance,
  so it needs the user's OK (and a rules update) first.

### P8-T2 Delete a posting permanently (F-02 level 2) ⚖️
- Career admin only, for spam and test data; confirm dialog showing what goes with it; audit line.

### P8-T3 Clear test data before go-live (F-17) ⚖️
- `npm run careers:job -- cleanup [--dry-run]`; refuses with `NODE_ENV=production`.

---

## Stretch backlog (after 10 Oct; do not start without the user's go-ahead)
1. Resume match scoring: skill overlap (tier 1) → local embeddings via `@huggingface/transformers` `all-MiniLM-L6-v2` stored as `Float[]` with cosine in JS (tier 2) → on-demand explanation from the **local** model (tier 3; resumes are personal data, so never a free-tier cloud API). Consent + retention + delete.
2. Weekly digest emails via the existing nodemailer transporter. (now planned as P7-T1 / F-19, still ⚖️)
3. Company discussion (nullable `companyId` on `Comment`, reusing `CommentSection`) with experience-weighted sorting.
4. OA/interview pattern guide + structured fields on experience submission.
5. Question bank (admin-reviewed).
6. Open-duration estimates from the `PostingSource` history (labelled as estimates).
7. More sources: Workday (undocumented), Playwright adapters for specific JS-only career pages.
