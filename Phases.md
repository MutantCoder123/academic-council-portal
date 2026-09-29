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

## Stretch backlog (after 10 Oct; do not start without the user's go-ahead)
1. Resume match scoring: skill overlap (tier 1) → local embeddings via `@huggingface/transformers` `all-MiniLM-L6-v2` stored as `Float[]` with cosine in JS (tier 2) → on-demand explanation from the **local** model (tier 3; resumes are personal data, so never a free-tier cloud API). Consent + retention + delete.
2. Weekly digest emails via the existing nodemailer transporter.
3. Company discussion (nullable `companyId` on `Comment`, reusing `CommentSection`) with experience-weighted sorting.
4. OA/interview pattern guide + structured fields on experience submission.
5. Question bank (admin-reviewed).
6. Open-duration estimates from the `PostingSource` history (labelled as estimates).
7. More sources: Workday (undocumented), Playwright adapters for specific JS-only career pages.
