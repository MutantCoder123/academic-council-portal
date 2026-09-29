# Architecture: Job & Internship Fetcher

Repo root = `academic-council-portal/`. All paths below are relative to it.
Read only the sections your current task touches.

---

## 1. Existing system (facts verified on commit `28a65dd`)

| Area | Fact | Consequence for us |
|---|---|---|
| Server | Express 5, ESM (`"type": "module"`), plain JS, `server-acc/server.js` mounts routers at `/api/v1` | New routers mount the same way |
| DB | PostgreSQL 16 via Prisma 6. Schema `server-acc/prisma/schema.prisma`, env var **`POSTGRES_DATABASE_URL`**. Models are PascalCase with camelCase fields and no `@@map` | Follow the same naming: tables are `"Company"`, `"Posting"`, etc. |
| Prisma client | `server-acc/config/db.js` exports a singleton `prisma` from `@prisma/client` | Import it; never create a new client |
| Stale folder | `server-acc/generated/prisma/` is a committed, unused artifact | **Never touch it** |
| Auth | JWT in `token` cookie. `middlewares/checkAuth.js` sets `req.user` (full User row) | Use `checkAuth` on every careers route |
| Roles | `Role` enum: STUDENT, RESOURCE_ADMIN, ANNOUNCEMENT_ADMIN, SUPER_ADMIN, FACULTY, CAREER_ADMIN, FINANCE_ADMIN | Career admins = CAREER_ADMIN, SUPER_ADMIN, FACULTY |
| Error handling | **No global error handler.** `checkCareerAdmin` calls `next(new Error("FORBIDDEN"))`, which becomes an Express default 500 | Write our own `requireCareerAdmin` that returns 403 JSON directly |
| Response shape | Success `{ success: true, message, data, pagination? }`. Error `{ success: false, error: "CODE", message }` | Use the same shapes |
| User data | `User.branchName` = 2-letter code from the roll number (`2401CS49` → `CS`), `User.admissionYear`, `User.program` (BTECH, ...) | Eligibility uses these. `rollNo` can be null |
| Academic year | `middlewares/Forum/addPost.js`: the academic year starts in July (`month >= 6`) | Reuse the same formula (§8.3) |
| Experience | `Experience { title, description (HTML), experienceType, status DRAFT/PUBLISHED, domain, resumeUrl, uploadedById }`. **No company field** | Add nullable `companyId` |
| Uploads | MinIO via signed URLs (`/api/v1/upload/get-upload-url`) | Not needed until stretch (resumes) |
| Mail | `utils/mail/transporter.js` (nodemailer/SMTP) | Stretch only (digests) |
| Client | React 19, Vite 7, Tailwind 4, react-router 7, axios, lucide-react, framer-motion, react-hot-toast, react-select | Use these; add no UI library |
| Client API base | `import.meta.env.VITE_API_URL` + `/v1` (so `VITE_API_URL=http://localhost:3000/api`) | Copy the `forumApi.js` pattern |
| Layout | Dashboard pages render inside `layout/DashboardLayout.jsx` (light theme, sidebar). Career Vault = `/dashboard/career-vault` → `pages/CareerVaultuser/index.jsx` (921 lines) | New pages are sibling routes. Keep edits to that big file minimal |
| Deploy | `docker-compose.yml`: nginx, frontend, backend (`server-acc`), postgres, minio, smp-*. `deploy.yml` only rebuilds the client on push to main | The new worker is a compose service. Backend/worker deploy is manual (open question in PRD §9) |
| Tests | None exist | We add `vitest` to `server-acc` only |

---

## 2. High-level flow

```
                ┌──────────────────── fetcher-acc (worker.js, node-cron, TZ Asia/Kolkata) ───────────────────┐
                │                                                                                              │
 Allowlisted    │  02:00 ingestAll ──► adapter.fetch ──► relevance filter ──► normalise ──► dedup ──► upsert   │
 ATS boards ────┼──►  (Greenhouse / Lever / Ashby JSON)      (tier 2, free)     (tier 2)     (tier 2)  Posting   │
                │                                                                                PENDING_REVIEW│
 Student links ─┼──► */10 processSubmissions ──► safeFetch ──► ATS-link? JSON-LD? ──► else Extraction QUEUED    │
 (API writes    │                                                    (free)                                     │
  LinkSubmission)│  */10 runExtractions ──► local Qwen 7B via Ollama (Gemini later) ──► verify.js ──► apply     │
                │        (JSON schema output; code checks every field against the source text) ──► PENDING_REVIEW│
                │  05:30 recheckLiveness   * * * * * checkRunRequests   every job ──► heartbeat                  │
                └──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                               │ same PostgreSQL (acc-postgres)
                ┌──────────────── backend-acc (server.js, Express) ────────────────┐
 Students ──────┼─► /api/v1/careers/*        (list, detail, companies, submit link, CPI, save/track)
 Career admins ─┼─► /api/v1/careers/admin/*  (review, manual entry, companies, sources, ops, settings)
                └───────────────────────────────────────────────────────────────────┘
```

**Why a separate worker:** a fetcher crash, memory spike or slow model call can never take down the
live portal API. The worker is the same Docker image with a different command.

**Worker ↔ API communication happens only through the DB:**
- `AppSetting` holds `careers.runRequest` (admin "Run now") and `careers.workerHeartbeat`.
- `LinkSubmission` holds student links.

There is no queue server or Redis.

---

## 3. Folder structure (new files only, `★` = edits to an existing file)

```
server-acc/
├── worker.js                              # worker entry: registers cron jobs
├── server.js                            ★ # +2 lines: mount careers routers
├── package.json                         ★ # deps + scripts (see §11)
├── prisma/
│   ├── schema.prisma                    ★ # additive models/columns (§4)
│   ├── migrations/<ts>_careers_*/         # generated, reviewed, additive only
│   └── seedCareers.js                     # idempotent: system sources, companies+aliases, settings
├── routes/
│   ├── careers.js                         # student routes
│   └── careersAdmin.js                    # admin routes
├── controllers/careers/
│   ├── postingsController.js              # list/detail for students
│   ├── companiesController.js             # company list/page/search
│   ├── submissionsController.js           # student link submit + my submissions
│   ├── eligibilityController.js           # GET eligibility, PATCH cpi
│   ├── trackingController.js              # P4-lite: save + application status
│   ├── adminReviewController.js           # queue, edit, approve/reject/bulk, manual create, expire
│   ├── adminCompaniesController.js        # CRUD, aliases, candidates, merge/split/undo, log
│   ├── adminBackfillController.js         # experience ↔ company suggestions/apply/unlink
│   ├── adminSourcesController.js          # sources CRUD, run-now, runs
│   └── adminOpsController.js              # ops summary + settings get/put
├── middlewares/careers/
│   ├── requireCareerAdmin.js              # 403 JSON (does NOT use next(err))
│   ├── requireCareersEnabled.js           # flag gate for students (admins bypass)
│   └── submissionRateLimit.js             # N links / user / 24h
├── services/careers/
│   ├── settings.js                        # get/set AppSetting with defaults + 30s cache
│   ├── jobLock.js                         # pg_try_advisory_lock wrapper
│   ├── heartbeat.js                       # writes careers.workerHeartbeat
│   ├── academicYear.js                    # shared formula (§8.3)
│   ├── text/
│   │   ├── html.js                        # htmlToText (cheerio), entity decode
│   │   ├── normalize.js                   # company / title / location normalisers
│   │   ├── compensation.js                # parseCompensation(text) → {min,max,disclosure,currency,raw}
│   │   ├── fingerprint.js                 # simhash64 + hamming
│   │   ├── skills.js + skillsDictionary.js# dictionary match → skills[]
│   │   ├── workMode.js                    # keyword → ONSITE/HYBRID/REMOTE/UNKNOWN
│   │   └── relevance.js + relevanceRules.js # keep/drop + PostingType guess
│   ├── companies/
│   │   ├── matcher.js                     # PURE: resolveName(name, index) → {companyId|null, method, score}
│   │   ├── companyIndex.js                # loads aliases from DB into matcher index
│   │   ├── resolveCompany.js              # matcher + create CANDIDATE when unresolved
│   │   └── mergeService.js                # merge / split / undo in $transaction
│   ├── ingest/
│   │   ├── adapters/{greenhouse,lever,ashby,index}.js
│   │   ├── runSource.js                   # one source: fetch→filter→normalise→upsert; writes SourceRun
│   │   ├── ingestAll.js                   # all enabled ATS sources, sequential, per-source try/catch
│   │   ├── dedup.js                       # PURE isSamePosting(a,b) + DB candidate finder
│   │   ├── upsertPosting.js               # observation update OR merge OR create
│   │   ├── health.js                      # PURE nextHealth(source, runResult)
│   │   └── liveness.js                    # missed-runs + manual/link URL recheck
│   ├── links/
│   │   ├── ipGuard.js                     # PURE isBlockedAddress(ip)
│   │   ├── safeFetch.js                   # undici Agent w/ guarded lookup, size/time/redirect caps
│   │   ├── blockedDomains.js              # store-only domains (LinkedIn, Naukri, …)
│   │   ├── canonicalUrl.js                # strip utm_*, fragments, lowercase host
│   │   ├── atsLink.js                     # detect Greenhouse/Lever/Ashby job URLs → single-job API
│   │   ├── jsonLd.js                      # schema.org JobPosting extraction (free tier)
│   │   └── processSubmission.js           # orchestrates one LinkSubmission
│   ├── extract/
│   │   ├── schema.js                      # JSON Schema (sent to the model) + zod mirror (validation)
│   │   ├── prompt.js                      # stable system prompt + user content builder
│   │   ├── providers/ollama.js            # local Qwen via Ollama /api/chat (default)
│   │   ├── providers/gemini.js            # Google Gemini via @google/genai (later; mocked in tests)
│   │   ├── callModel.js                   # picks provider from LLM_PROVIDER, truncates, maps errors → CallResult / LlmError
│   │   ├── providerStatus.js              # {provider, reachable, modelPresent, keyPresent, lastError} for /ops
│   │   ├── verify.js                      # PURE: grounding checks, deterministic overrides, computed confidence (§8.2)
│   │   ├── pricing.js                     # Gemini $/MTok table; ollama = 0
│   │   ├── budget.js                      # canCall(): ollama always; gemini daily cap + monthly $ cap
│   │   ├── runExtractions.js              # QUEUED (due) → callModel → verify → applyExtraction / escalate / retry
│   │   └── applyExtraction.js             # verified output → Posting
│   └── postings/
│       ├── query.js                       # filters → Prisma where (null-safe comp, eligibility)
│       └── eligibility.js                 # PURE: user → {branch, year, cpi, applicable}
├── scripts/careers/
│   ├── runJob.js                          # `node scripts/careers/runJob.js ingest|links|submit|poll|liveness`
│   ├── verifyBoard.js                     # `node scripts/careers/verifyBoard.js greenhouse <token>`
│   └── seedLocalDev.js                    # LOCAL ONLY (refuses when NODE_ENV=production): dev users + demo experiences
└── tests/careers/                         # vitest; fixtures in tests/careers/fixtures/

client-acc/src/
├── App.jsx                              ★ # new routes (§9)
├── layout/DashboardLayout.jsx           ★ # sidebar items (§9.3)
├── api/careersApi.js                      # axios client, same pattern as forumApi.js
├── hooks/useCareersStatus.js              # { enabled, isCareerAdmin } cached
├── pages/CareerVaultuser/index.jsx      ★ # P3: <CareerVaultTabs/>, company picker, "N open roles" chip
├── pages/Careers/
│   ├── JobsPage.jsx  JobDetailPage.jsx  CompaniesPage.jsx  CompanyPage.jsx  SavedPage.jsx
│   ├── components/
│   │   ├── CareerVaultTabs.jsx  JobCard.jsx  JobFilters.jsx  FreshnessLine.jsx
│   │   ├── CompensationBadge.jsx  EligibilityBadge.jsx  EligibilityCard.jsx
│   │   ├── SubmitLinkModal.jsx  SourceLinks.jsx  ExperiencePanel.jsx  ExperienceCard.jsx
│   │   ├── CompanyPicker.jsx  StatusChip.jsx  EmptyState.jsx  ApplicationStatusButton.jsx
│   └── lib/format.js                      # relativeTime, formatInr, freshness text
└── pages/admin/careers/
    ├── ReviewQueue.jsx  PostingEditor.jsx  ManualPosting.jsx
    ├── Companies.jsx  MergeDialog.jsx  SplitDialog.jsx  MergeLog.jsx  ExperienceBackfill.jsx
    ├── Sources.jsx  Operations.jsx
    └── components/  HealthBadge.jsx  UncertainField.jsx  ConfidenceMeter.jsx  StatCard.jsx

docker-compose.yml                       ★ # + fetcher-acc service (§12)
```

Keep every file under about 300 lines. If a controller grows past that, split it by resource.

---

## 4. Data model (Prisma, additive only)

Add this to `schema.prisma`. Also add the two edits to existing models at the end of this section.
**Audit columns (`*ById`) are plain `Int?` with no FK on purpose.** The portal has a "delete user"
feature, and FKs would block it.

```prisma
// ─────────────────────────── Careers: enums ───────────────────────────
enum CompanyStatus     { ACTIVE CANDIDATE MERGED }
enum AliasOrigin       { SEED MANUAL AUTO MERGE }
enum SourceKind        { GREENHOUSE LEVER ASHBY MANUAL STUDENT_LINK }
enum SourceHealth      { UNKNOWN OK FAILING ZERO_RESULTS DISABLED }
enum RunStatus         { RUNNING SUCCESS FAILED }
enum PostingType       { INTERNSHIP FULL_TIME UNKNOWN }
enum WorkMode          { ONSITE HYBRID REMOTE UNKNOWN }
enum Disclosure        { DISCLOSED RANGE NOT_DISCLOSED UNCLEAR }
enum PostingStatus     { PENDING_REVIEW LIVE EXPIRED REJECTED }
enum ExtractionTier    { STRUCTURED JSON_LD LLM_FAST LLM_STRONG MANUAL }   // provider-neutral names
enum ExtractionState   { QUEUED DONE FAILED SKIPPED_BUDGET }
enum SubmissionStatus  { RECEIVED PROCESSING EXTRACTING PENDING_REVIEW STORED_ONLY DUPLICATE FAILED }
enum MergeAction       { MERGE SPLIT }
enum ReviewAction      { APPROVE REJECT EDIT EXPIRE REOPEN CREATE_MANUAL }
enum ApplicationStatus { INTERESTED APPLIED IN_PROGRESS REJECTED OFFER }

// ─────────────────────────── Careers: registry (Phase 0) ───────────────────────────
model Company {
  id             Int           @id @default(autoincrement())
  name           String
  slug           String        @unique
  normalizedName String
  website        String?
  status         CompanyStatus @default(ACTIVE)
  mergedIntoId   Int?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  aliases        CompanyAlias[]
  postings       Posting[]
  sources        Source[]
  experiences    Experience[]

  @@index([normalizedName])
  @@index([status])
}

model CompanyAlias {
  id              Int         @id @default(autoincrement())
  companyId       Int
  company         Company     @relation(fields: [companyId], references: [id])
  alias           String
  normalizedAlias String      @unique
  origin          AliasOrigin @default(AUTO)
  createdAt       DateTime    @default(now())

  @@index([companyId])
}

model CompanyMergeLog {
  id            Int         @id @default(autoincrement())
  action        MergeAction
  fromCompanyId Int         // MERGE: absorbed company.  SPLIT: original company
  toCompanyId   Int         // MERGE: surviving company. SPLIT: newly created company
  moved         Json        // { aliasIds:[], postingIds:[], experienceIds:[], sourceIds:[] }
  performedById Int
  undoneAt      DateTime?
  undoneById    Int?
  createdAt     DateTime    @default(now())

  @@index([fromCompanyId])
  @@index([toCompanyId])
}

model AppSetting {
  key         String   @id
  value       Json
  updatedById Int?
  updatedAt   DateTime @updatedAt
}

// ─────────────────────────── Careers: ingestion (Phase 1) ───────────────────────────
model Source {
  id                  Int          @id @default(autoincrement())
  name                String
  kind                SourceKind
  boardToken          String?      // greenhouse board token | lever site | ashby org. null for MANUAL/STUDENT_LINK
  companyId           Int?         // ATS boards belong to one company
  company             Company?     @relation(fields: [companyId], references: [id])
  isEnabled           Boolean      @default(true)
  health              SourceHealth @default(UNKNOWN)
  lastRunAt           DateTime?
  lastSuccessAt       DateTime?
  lastFetchedCount    Int?
  lastKeptCount       Int?
  consecutiveFailures Int          @default(0)
  lastError           String?      @db.Text
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt
  runs                SourceRun[]
  observations        PostingSource[]

  @@unique([kind, boardToken])
}

model SourceRun {
  id             Int       @id @default(autoincrement())
  sourceId       Int
  source         Source    @relation(fields: [sourceId], references: [id])
  status         RunStatus @default(RUNNING)
  startedAt      DateTime  @default(now())
  finishedAt     DateTime?
  fetchedCount   Int       @default(0)
  keptCount      Int       @default(0)   // after relevance filter
  newCount       Int       @default(0)   // new Posting rows
  duplicateCount Int       @default(0)   // merged into existing postings
  error          String?   @db.Text

  @@index([sourceId, startedAt])
}

model Posting {
  id                   Int            @id @default(autoincrement())
  companyId            Int
  company              Company        @relation(fields: [companyId], references: [id])
  roleTitle            String
  roleTitleNormalized  String
  type                 PostingType    @default(UNKNOWN)
  ppoMentioned         Boolean?       // null = not stated
  location             String?        // raw
  locationNormalized   String?        // "bengaluru|hyderabad", "remote"
  workMode             WorkMode       @default(UNKNOWN)
  skills               String[]
  compCurrency         String         @default("INR")
  stipendMin           Int?           // per month
  stipendMax           Int?
  stipendDisclosure    Disclosure     @default(NOT_DISCLOSED)
  ctcMin               Int?           // per year
  ctcMax               Int?
  ctcDisclosure        Disclosure     @default(NOT_DISCLOSED)
  compensationRaw      String?        // exact source wording; REQUIRED when a disclosure is UNCLEAR
  descriptionText      String         @db.Text
  contentFingerprint   String         // 16 hex chars (simhash64)
  applyUrl             String
  eligibleBranches     String[]       // roll-number branch codes; [] = not stated
  eligibleYears        Int[]          // academic years; [] = not stated
  minCpi               Decimal?       @db.Decimal(4, 2)
  deadlineStated       DateTime?      // ONLY if the source published one
  firstSeenAt          DateTime       @default(now())
  lastSeenLiveAt       DateTime       @default(now())
  status               PostingStatus  @default(PENDING_REVIEW)
  extractionTier       ExtractionTier
  extractionConfidence Float?         // 0..1; null for MANUAL
  uncertainFields      String[]
  rejectReason         String?
  reviewedById         Int?
  reviewedAt           DateTime?
  publishedAt          DateTime?      // first time it went LIVE
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt
  observations         PostingSource[]
  reviews              PostingReview[]
  saves                SavedPosting[]
  applications         PostingApplication[]

  @@index([status, lastSeenLiveAt])
  @@index([companyId, status])
  @@index([companyId, roleTitleNormalized])
  @@index([contentFingerprint])
}

// One row per (source, external job). This is the proposal's "posting_observations" log.
model PostingSource {
  id          Int      @id @default(autoincrement())
  postingId   Int
  posting     Posting  @relation(fields: [postingId], references: [id], onDelete: Cascade)
  sourceId    Int
  source      Source   @relation(fields: [sourceId], references: [id])
  externalId  String   // ATS job id; for MANUAL/STUDENT_LINK: sha1(canonicalUrl)
  url         String
  firstSeenAt DateTime @default(now())
  lastSeenAt  DateTime @default(now())
  isLive      Boolean  @default(true)
  missedRuns  Int      @default(0)

  @@unique([sourceId, externalId])
  @@index([postingId])
}

model PostingReview {           // the proposal's "extraction_reviews" audit trail
  id        Int          @id @default(autoincrement())
  postingId Int
  posting   Posting      @relation(fields: [postingId], references: [id], onDelete: Cascade)
  action    ReviewAction
  byUserId  Int
  changes   Json?        // { field: { from, to } } for EDIT / edit-then-approve
  note      String?
  createdAt DateTime     @default(now())

  @@index([postingId])
}

model LinkSubmission {
  id            Int              @id @default(autoincrement())
  url           String
  canonicalUrl  String
  note          String?
  submittedById Int
  status        SubmissionStatus @default(RECEIVED)
  postingId     Int?
  error         String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([submittedById, createdAt])
  @@index([status])
  @@index([canonicalUrl])
}

model Extraction {
  id              Int             @id @default(autoincrement())
  submissionId    Int?
  postingId       Int?            // set once a posting exists
  tier            ExtractionTier  // LLM_FAST | LLM_STRONG
  state           ExtractionState @default(QUEUED)
  model           String?         // actual model id used
  inputText       String          @db.Text
  inputTruncated  Boolean         @default(false)
  sourceUrl       String
  attempts        Int             @default(0)
  nextAttemptAt   DateTime        @default(now())   // backoff after 429 / 5xx
  output          Json?
  confidence      Float?
  error           String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([state, nextAttemptAt])
}

model LlmUsage {
  id           Int      @id @default(autoincrement())
  model        String
  purpose      String   // "extract" | "escalate"
  provider     String   // "ollama" | "gemini"
  batched      Boolean  @default(false)
  inputTokens  Int      // ollama: prompt_eval_count / gemini: promptTokenCount
  outputTokens Int      // ollama: eval_count / gemini: candidatesTokenCount + thoughtsTokenCount (thinking is billed as output)
  costUsd      Decimal  @db.Decimal(10, 6)   // 0 for ollama and the Gemini free tier
  extractionId Int?
  createdAt    DateTime @default(now())

  @@index([createdAt])
}

// ─────────────────────────── Careers: P4-lite ───────────────────────────
model SavedPosting {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  postingId Int
  posting   Posting  @relation(fields: [postingId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, postingId])
}

model PostingApplication {
  id        Int               @id @default(autoincrement())
  userId    Int
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  postingId Int
  posting   Posting           @relation(fields: [postingId], references: [id], onDelete: Cascade)
  status    ApplicationStatus
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@unique([userId, postingId])
}
```

**Edits to existing models (additive):**

```prisma
model Experience {
  // ...all existing fields unchanged...
  companyId Int?                                                  // Phase 0
  company   Company? @relation(fields: [companyId], references: [id])

  @@index([companyId])
}

model User {
  // ...all existing fields unchanged...
  cpi                 Decimal?  @db.Decimal(4, 2)                 // Phase 2, self-reported, 0.00–10.00
  cpiUpdatedAt        DateTime?                                   // Phase 2
  savedPostings       SavedPosting[]                              // P4-lite (Prisma-only back-relation)
  postingApplications PostingApplication[]                        // P4-lite (Prisma-only back-relation)
}
```

**Migrations (one per phase, each generated with `--create-only` and then reviewed):**

| Migration name | Phase | Contents |
|---|---|---|
| `careers_foundation` | P0 | Company, CompanyAlias, CompanyMergeLog, AppSetting, enums CompanyStatus/AliasOrigin/MergeAction, `Experience.companyId` + index |
| `careers_ingestion` | P1 | Source, SourceRun, Posting, PostingSource, PostingReview, LinkSubmission, Extraction, LlmUsage + their enums |
| `careers_user_cpi` | P2 | `User.cpi`, `User.cpiUpdatedAt` |
| `careers_tracking` | P4-lite | SavedPosting, PostingApplication, ApplicationStatus |

The only statements allowed in these migrations: `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`,
`ALTER TABLE ... ADD COLUMN <nullable or defaulted>`, `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`.
Anything else, **stop and ask the user.**

---

## 5. Settings (`AppSetting`, via `services/careers/settings.js`)

| Key | Default | Meaning |
|---|---|---|
| `careers.visibleToStudents` | `false` | Feature flag. `false` means students get `404 CAREERS_DISABLED`; admins still see everything |
| `careers.ingestionEnabled` | `true` | Worker skips `ingestAll` when false |
| `careers.llmEnabled` | `false` | No model calls when false (extractions wait as QUEUED). Turn on once Ollama (or a Gemini key) is ready |
| `careers.llmPaidTier` | `false` | Gemini only. `false` = free tier: cost recorded as 0, tokens and requests still tracked. Set `true` if the key is billed |
| `careers.llmMonthlyBudgetUsd` | `5` | Hard cap per calendar month (IST). Enforced only for Gemini with `llmPaidTier=true` |
| `careers.llmDailyRequestLimit` | `200` | Gemini only: hard cap on model calls per IST day (protects the free-tier quota; loud when hit). Ignored for ollama |
| `careers.confidenceThreshold` | `0.8` | Below this a posting is **flagged**; fast-model output below it escalates to the strong model |
| `careers.fuzzyThreshold` | `0.92` | Company name similarity for an auto-match (the posting is still flagged `company`) |
| `careers.submissionDailyLimit` | `5` | Student links per user per 24h |
| `careers.runRequest` | `null` | `{ sourceId: number \| "ALL", requestedAt, byUserId }`, consumed by the worker |
| `careers.workerHeartbeat` | `null` | `{ at, job }`, written by every worker job |

`getSetting(key)` returns the stored value or the default. It never throws for a missing key.
Cache for 30 s in-process; `setSetting` invalidates the cache.

---

## 6. Ingestion pipeline (cost cascade in practice)

### 6.1 Adapters (tier 1: free, structured)

Each adapter exports `async fetchPostings(source) → RawPosting[]`:

```js
// RawPosting
{ externalId, title, companyName, locationText, url, descriptionHtml, descriptionText,
  employmentTypeText, workplaceText, compensationText, postedAt, deadline }   // unknown → null
```

| Kind | Endpoint (GET) | Notes |
|---|---|---|
| GREENHOUSE | `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | `jobs[]`: `id`, `title`, `absolute_url`, `location.name`, `content` (HTML, entity-escaped), `updated_at` |
| LEVER | `https://api.lever.co/v0/postings/{site}?mode=json` | Array: `id`, `text`, `hostedUrl`, `categories.{location,commitment,team}`, `workplaceType`, `descriptionPlain`, `lists`, `additionalPlain`, `salaryRange?` |
| ASHBY | `https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true` | `jobs[]`: `id`, `title`, `location`, `isRemote`, `workplaceType?`, `employmentType`, `jobUrl`, `descriptionPlain`, `publishedAt`, `compensation?` |

**These field lists come from memory. Verify them:** before writing each mapper, call the endpoint once
with `scripts/careers/verifyBoard.js`, save a trimmed response (3 jobs) to
`tests/careers/fixtures/<kind>.json`, and write the mapper and test against that real shape.

Fetch policy:
- User-Agent `ACC-IITP-CareerVault/1.0 (+https://acc.iitp.ac.in)`
- 15 s timeout, 1 retry on 5xx or network error
- Sources run **sequentially**, one source failing never stops the others
- Workday is out of scope (no public API)

### 6.2 Deterministic processing (tier 2: free)

Run in this order inside `runSource.js`:

1. **Relevance** (`relevance.js`, rules in `relevanceRules.js`, easy to tune):
   - Location must match India (city list: Bengaluru/Bangalore, Hyderabad, Pune, Mumbai, Delhi/New
     Delhi/NCR, Gurugram/Gurgaon, Noida, Chennai, Kolkata, Ahmedabad, Jaipur, Chandigarh, Kochi,
     Indore, Patna, "India") **or** be remote-eligible (`remote` together with
     India/APAC/Asia/anywhere/worldwide, or remote with no country).
   - Drop if the title has a seniority marker: `senior|sr\.?|staff|principal|lead|manager|director|head|vp|architect|\bII\b|\bIII\b|\b[2-9]\b level`.
   - Keep if the title has `intern|internship|trainee|apprentice|graduate|new grad|campus|fresher|entry|junior|associate|SDE[- ]?I\b|engineer I\b|analyst`
     **or** the description mentions `0[-–to ]+[12] years|fresh graduates?|recent graduates?|20(2[5-9]) (batch|graduates?)|new grad`.
   - Type guess: intern/trainee/apprentice → `INTERNSHIP`; otherwise kept by the new-grad rules → `FULL_TIME`; otherwise `UNKNOWN` (uncertain).
   - Record `fetchedCount` and `keptCount` on the `SourceRun`. A big drop-off is visible, not silent.
2. **Normalise** (`normalize.js`):
   - `normalizeCompanyName`: NFKD, lowercase, `&`→`and`, strip punctuation, repeatedly strip
     trailing legal/region tokens (`private limited, pvt, ltd, limited, llc, inc, incorporated, corp, corporation, co, company, gmbh, plc, india, (india)`), collapse spaces.
   - `normalizeTitle`: lowercase, strip bracketed text, years `20\d\d`, `summer|winter|batch|cohort`, punctuation. Map `sde|swe|software development engineer` → `software engineer`. **Keep `intern`**, so an intern role never dedupes with a full-time role.
   - `normalizeLocation`: city aliases (bangalore→bengaluru, gurgaon→gurugram, bombay→mumbai, new delhi/ncr→delhi), multiple locations sorted and joined with `|`, any remote → include `remote`.
3. **Compensation** (`compensation.js`, `parseCompensation(text, {kind: 'stipend'|'ctc'})`):
   - `"₹40,000–60,000 per month"` → `{min:40000, max:60000, disclosure:'RANGE', currency:'INR'}`
   - `"₹50k/month"` → `{min:50000, max:50000, disclosure:'DISCLOSED'}`
   - `"12 LPA"` / `"12 lakh per annum"` → ctc `{min:1200000, max:1200000, disclosure:'DISCLOSED'}`
   - `"competitive"`, `"as per industry standards"`, empty → `NOT_DISCLOSED`, numbers null
   - Numbers present but the period or kind is ambiguous → `UNCLEAR`, numbers null, `compensationRaw` = text
   - Non-INR (`$`, `USD`, `€`) → keep the numbers, `compCurrency` = that code
   - **Never output 0 for "unknown".**
4. **Skills** (`skillsDictionary.js`, about 150 canonical tokens with synonyms, e.g. `react|reactjs|react.js → React`): word-boundary match on the description. Deterministic.
5. **Work mode** (`workMode.js`): ATS workplace field first, then keywords (`remote`, `hybrid`, `on-site|onsite|in office`), otherwise `UNKNOWN`.
6. **Fingerprint** (`fingerprint.js`): simhash64 over 3-word shingles of the normalised description (FNV-1a 64 using BigInt), stored as 16 hex chars. Near-duplicate = Hamming distance ≤ 3.
7. **Dedup + upsert** (`upsertPosting.js`), in this order:
   1. A `PostingSource` exists for `(sourceId, externalId)` → update `lastSeenAt`, `isLive=true`, `missedRuns=0`, and `posting.lastSeenLiveAt=now` if the posting is LIVE or PENDING. **Nothing else.** Admin-approved fields are never overwritten; a REJECTED posting stays rejected and is never re-queued.
   2. Otherwise find candidates: same `companyId`, status ≠ REJECTED, `updatedAt` within 120 days. `isSamePosting(a,b)` (pure) =
      `(titleNorm equal AND (locationNorm equal OR either null)) OR (hamming(fp) ≤ 3 AND title similarity ≥ 0.8)`.
      On a match, add a new `PostingSource` to that posting (`duplicateCount++`).
   3. Otherwise create `Posting` (`PENDING_REVIEW`, `extractionTier: STRUCTURED`) plus a `PostingSource` (`newCount++`).
8. **Structured confidence:** start at 1.0 and subtract 0.15 for each uncertain field. Uncertain
   fields are `type` (UNKNOWN), `location` (null), and `company` (CANDIDATE or fuzzy-matched).
   Below the threshold, the posting shows up in the **Flagged** tab.

Company for ATS postings = `source.companyId` (the board belongs to one company), so no name
resolution is needed. Name resolution (§7) is for student links, manual entry and backfill.

### 6.3 Health and liveness

`health.js` → `nextHealth(prevSource, run)` (pure):
- The run threw → `FAILING`, `consecutiveFailures+1`, `lastError` set
- Success with `fetchedCount === 0` → `ZERO_RESULTS` (a board that goes empty is suspicious; the admin decides)
- Success with `fetchedCount > 0` → `OK`, `consecutiveFailures = 0`
- `isEnabled = false` → `DISABLED` (not run)

Liveness:
- **ATS:** at the end of a successful source run, every `PostingSource` of that source **not** seen
  in the run gets `missedRuns+1`. At `missedRuns ≥ 2` it gets `isLive=false`.
- A LIVE posting whose observations are **all** not live becomes `EXPIRED`.
- If an expired posting is seen again: `isLive=true`, and the posting goes back to LIVE **only if**
  `publishedAt` is set (it was approved before).
- **MANUAL / STUDENT_LINK** (`recheckLiveness`, daily 05:30): `safeFetch` the `applyUrl`. A 404 or
  410 counts as a miss; 2 misses → expired. Network errors don't count (they are logged). Admins can
  expire a posting manually at any time.

---

## 7. Company resolution

`matcher.js` is **pure** and fully unit-tested. `resolveName(rawName, index, { fuzzyThreshold })`:

1. **Exact alias:** `index.byExact.get(rawName.trim().toLowerCase())` → `{companyId, method:'exact', score:1}`
2. **Normalised:** `index.byNormalized.get(normalizeCompanyName(rawName))` → `method:'normalized'`
3. **Fuzzy:** best `1 - levenshtein(a,b)/max(len)` over normalised aliases (`fastest-levenshtein`).
   Accepted only if the score is ≥ threshold **and** both strings are ≥ 5 chars → `method:'fuzzy'`.
4. Otherwise `{ companyId: null, method: 'none' }`.

`resolveCompany.js`: on `none`, create `Company { status: CANDIDATE }` with an `AUTO` alias, so the
posting still has a `companyId`. The candidate appears in the **Candidate companies** tab. When the
method is `fuzzy` or the company is a candidate, add `company` to the posting's `uncertainFields`.

**Merge / split / undo** (`mergeService.js`; every operation is one `prisma.$transaction`):
- **Merge A→B:** move all of A's aliases, postings, experiences and sources to B. Set A to
  `MERGED` with `mergedIntoId=B`. Log `moved` ids. Afterwards, run `isSamePosting` across B's
  postings and **report** possible duplicates in the response (never auto-merge postings).
- **Split A→new C:** the admin picks aliases, postings, experiences and sources. Create C (ACTIVE)
  and move exactly those ids. Log them.
- **Undo** (only if `undoneAt` is null **and** no later un-undone log entry involves either company):
  - MERGE: move the logged ids back to A, set A to ACTIVE, `mergedIntoId=null`.
  - SPLIT: move the logged ids back to A, set C to MERGED with `mergedIntoId=A`.
  - Set `undoneAt` and `undoneById`.
- Companies are **never deleted**.

---

## 7a. Student links (`LinkSubmission`) → cheapest path first

`processSubmission.js` (worker, every 10 min, up to 20 RECEIVED rows per run):

1. `blockedDomains.js` match (linkedin.com, naukri.com, indeed.*, glassdoor.*, internshala.com,
   wellfound.com, angel.co, instahyre.com, foundit.in, unstop.com, cutshort.io) → `STORED_ONLY`.
   It is never fetched; the admin enters the details manually from the review tab.
2. `atsLink.js` recognises `boards.greenhouse.io/{t}/jobs/{id}`, `job-boards.greenhouse.io/...`,
   `jobs.lever.co/{site}/{uuid}`, `jobs.ashbyhq.com/{org}/{uuid}` → fetch that **single job** from the
   ATS API → tier-2 pipeline (`extractionTier: STRUCTURED`).
3. Otherwise `safeFetch(url)` → HTML → `jsonLd.js`. A schema.org `JobPosting` gives `title`,
   `hiringOrganization.name`, `jobLocation`, `employmentType`, `baseSalary`, and `validThrough`
   (→ `deadlineStated`) → tier-2 pipeline (`extractionTier: JSON_LD`).
4. Otherwise `htmlToText` (drop script/style/nav/header/footer; prefer `main`/`article`) → cap at
   the provider's input cap (12,000 chars for ollama, 40,000 for gemini; set `inputTruncated`, add `description` to uncertain fields) → `Extraction {tier: LLM_FAST, QUEUED}` → status `EXTRACTING`.
   **Only the fetched public page text is sent to the model.** Never send the student's note, name,
   email or any other user data. (Local Ollama keeps everything on the machine; if Gemini is used later, its free tier
   may let Google use the content to improve its products.)
5. The company name is resolved via §7. Dedup via §6.2 step 7 (a match gives `DUPLICATE`, plus a new
   `PostingSource` on the existing posting, which is the proof that dedup works across sources).
6. Any error → `FAILED` with `error`. It stays visible in the admin **Student links** tab.

**SSRF guard** (`safeFetch.js`), all mandatory:
- `http:`/`https:` only; ports 80/443 only; URL ≤ 2048 chars.
- DNS is validated **at connect time** through an `undici` `Agent({ connect: { lookup: guardedLookup } })`, so DNS rebinding can't bypass it.
- `ipGuard.isBlockedAddress(ip)` rejects: `0.0.0.0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4, 240/4, ::, ::1, fc00::/7, fe80::/10`, and IPv4-mapped IPv6 versions of these. (The VM sits on `172.16.x`.)
- Redirects followed manually, max 3, each hop re-validated.
- 10 s timeout, 2 MB body cap (abort the stream past it), `content-type` must be `text/html` or `application/json`.

---

## 8. LLM extraction: pluggable provider (local Qwen now, Gemini later)

One interface, two providers. **Switching is an env change (`LLM_PROVIDER`), not a code change.**
Only student links that are neither ATS job links nor pages with JSON-LD ever reach the model, so volume is tiny.

### 8.1 Provider interface (`extract/providers/*`, dispatched by `extract/callModel.js`)

```js
// every provider exports: async call({ model, system, user, schema, signal }) → CallResult
// CallResult = { text: string|null, finishReason: 'STOP'|'LENGTH'|'BLOCKED'|'OTHER',
//                usage: { inputTokens, outputTokens }, model }
// and throws LlmError { kind: 'UNREACHABLE'|'MODEL_MISSING'|'RATE_LIMIT'|'AUTH'|'BAD_REQUEST'|'SERVER', message }
```
`callModel(tier, input)` picks the provider from `LLM_PROVIDER` (`ollama` default, `gemini`), the model
from env, truncates the input to the provider's cap, calls it, maps errors, and returns a `CallResult`.
Nothing outside `providers/` and `callModel.js` may mention a vendor.

| | `ollama` (default, now) | `gemini` (later) |
|---|---|---|
| Where it runs | Local machine / VM, no key, no internet, **no data leaves the box** | Google API, `GEMINI_API_KEY` |
| Fast model (`LLM_FAST`) | `qwen2.5:7b` (`CAREERS_LLM_FAST_MODEL`) | `gemini-3.1-flash-lite` |
| Strong model (`LLM_STRONG`) | **none by default** (`CAREERS_LLM_STRONG_MODEL` empty → no escalation) | `gemini-3.8-flash` |
| Input cap (chars) | 12,000 (fits `num_ctx` 8192) | 40,000 |
| Cost | 0 | free tier $0, or paid: 0.25/1.50 (fast), 0.75/3.75 (strong, until 31 Dec 2026) per MTok |
| Limits | one request at a time; roughly 15–40 s per call on the dev laptop (RTX 4060 8 GB) | free-tier rate limits |

**Ollama provider** (`providers/ollama.js`, plain global `fetch`, no dependency):
- `POST ${OLLAMA_URL}/api/chat` (default `http://localhost:11434`), body:
  ```json
  { "model": "qwen2.5:7b", "stream": false,
    "options": { "temperature": 0, "num_ctx": 8192, "num_predict": 1024 },
    "format": "<EXTRACTION_SCHEMA object>",
    "messages": [ {"role":"system","content":"<SYSTEM>"}, {"role":"user","content":"<PAGE_TEXT>"} ] }
  ```
  Also append the schema as text to the system prompt (Ollama's docs recommend it).
- Response: `message.content` (JSON string), `done_reason`, `prompt_eval_count`, `eval_count`.
  `done_reason: "stop"` → STOP; `"length"` → LENGTH.
- Timeout 180 s (`AbortController`). Calls are sequential (the GPU serves one at a time).
- Errors: connection refused / fetch failed → `UNREACHABLE`; HTTP 404 "model not found" → `MODEL_MISSING`; 5xx → `SERVER`; 400 → `BAD_REQUEST`.
- **Verified on the dev machine (29 Sep 2026):** Ollama 0.34.4, `qwen2.5:7b` (4.7 GB, Q4_K_M) already pulled;
  `format` with a JSON schema is honoured, and **nullable types `{"type":["string","null"]}` are accepted**.

**Gemini provider** (`providers/gemini.js`, written and unit-tested with a mocked SDK now; real key later):
- Package `@google/genai` (install it in P1-T10 when this adapter is written, not before).
  ```js
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({ model, contents: user, config: {
    systemInstruction: system, responseMimeType: 'application/json',
    responseJsonSchema: schema, temperature: 0, maxOutputTokens: 2048 } });
  // res.text; res.candidates[0].finishReason (STOP | MAX_TOKENS | SAFETY | RECITATION | OTHER); res.promptFeedback?.blockReason
  // res.usageMetadata.{promptTokenCount, candidatesTokenCount, thoughtsTokenCount}  (thinking is billed as output)
  ```
- Map `STOP`→STOP, `MAX_TOKENS`→LENGTH, `SAFETY`/`RECITATION`/blockReason→BLOCKED. HTTP 429→`RATE_LIMIT`, 401/403→`AUTH`, 400→`BAD_REQUEST`, 5xx→`SERVER`.
- Never use `gemini-2.0-*` (shut down), `gemini-2.5-*` (restricted), or the moving `gemini-flash-latest` alias.
- **Key:** server-only, in `server-acc/.env`. **Never** a `VITE_*` variable, never logged.
- Before writing it, check the SDK docs via context7 (`/googleapis/js-genai`). When the key arrives, verify
  once that the nullable schema form works (`type:["string","null"]`, else `anyOf`; last resort: `""` sentinel
  mapped to `null` in `applyExtraction`) and record it in Memory.md.

**Shared error handling** (`runExtractions`), regardless of provider:
- `UNREACHABLE`, `RATE_LIMIT`, `SERVER` → `attempts+1`, `nextAttemptAt = now + min(2^attempts × 5 min, 6 h)`, stay QUEUED; after 5 attempts → `FAILED`. `UNREACHABLE`/`MODEL_MISSING`/`AUTH` also raise a red ops alert and stop the run for this cycle.
- `MODEL_MISSING`, `AUTH`, `BAD_REQUEST`, `LENGTH`, `BLOCKED` → `FAILED` with the reason (visible in the admin Student links tab).
- `JSON.parse` + zod validation failure → `FAILED` with a validation summary.
- Record `LlmUsage` for every call that reached the model (tokens always; `costUsd` = 0 for ollama and the Gemini free tier).

### 8.2 Extraction schema (`extract/schema.js`) and how the output is verified

```js
{
  is_job_posting: boolean,
  company_name: string|null,
  role_title: string|null,
  type: "INTERNSHIP"|"FULL_TIME"|"UNKNOWN",
  ppo_mentioned: boolean|null,
  location: string|null,
  work_mode: "ONSITE"|"HYBRID"|"REMOTE"|"UNKNOWN",
  skills: string[],
  compensation_text: string|null,        // verbatim span; our parseCompensation() does the numbers
  eligibility: { branches: string[], years: integer[], min_cpi: number|null },   // [] / null = not stated
  deadline_stated: string|null,          // ISO date, ONLY if explicitly written
  apply_url: string|null,
  overall_confidence: number             // the model's own estimate (advisory only, see below)
}
```
Schema rules: `additionalProperties:false` on every object, every field in `required`, no `minimum/maximum`
(range-check with zod instead).

**A 7B model is not trusted; its output is verified by code (`extract/verify.js`, pure, unit-tested).**
A test on `qwen2.5:7b` labelled an "Internship" as `FULL_TIME`, returned `overall_confidence: 100`, and
paraphrased pay text instead of copying it. So, for **every** provider:
1. **Grounding:** `company_name`, `role_title`, `compensation_text`, `location`, and every `skills[]` entry must
   appear in the input text (case-insensitive, whitespace-normalised). Anything not found is **dropped to
   null/[]** and its field added to `uncertainFields`. A `deadline_stated` must parse as a date **and** its
   day and month must appear in the input, otherwise it is dropped.
2. **Deterministic overrides:** `type` = `relevance.guessType(role_title)` when that returns a value
   (title contains intern/trainee/apprentice → `INTERNSHIP`), even if the model disagrees. `work_mode` from
   `workMode.js` when it finds a keyword. `skills` are also unioned with the dictionary matcher's result.
3. **Compensation numbers** always come from our `parseCompensation(compensation_text)`, never from the model.
4. **Confidence is computed by us:** start from the model's `overall_confidence` (a value outside 0..1 is
   invalid and becomes 0.5), then `−0.15` per field dropped by grounding and `−0.10` if `type` was
   overridden. **Local-model cap:** with `LLM_PROVIDER=ollama`, `conf = min(conf, 0.7)`, which is below
   the 0.8 threshold, so **every locally-extracted posting lands in the Flagged tab** for a careful human
   look. (Gemini results aren't capped.)
5. `is_job_posting:false` → submission `FAILED` with "not a job posting", no Posting created.

System prompt rules (keep it byte-stable): extract only what is explicitly stated; use null / `[]` / `UNKNOWN`
otherwise; never infer a stipend, deadline or eligibility; copy `compensation_text` verbatim; confidence is a
number between 0 and 1. Branch names are mapped to IIT Patna codes by our code (lookup table in
`eligibility.js`, e.g. "Computer Science" → `CS`).

### 8.3 Flow and limits

`runExtractions.js` (worker, every 10 min, after `processSubmissions`):
1. If `llmEnabled` is false → stop. If `LLM_PROVIDER=gemini` and `GEMINI_API_KEY` is missing → stop + red alert.
   If `ollama`: `GET ${OLLAMA_URL}/api/tags` must answer and list the configured model, else stop + red alert (§10).
2. Take QUEUED extractions with `nextAttemptAt <= now`, oldest first, **max 20** (ollama: max 5 per run, since calls are slow).
3. `budget.canCall()`:
   - provider `ollama` → always true.
   - provider `gemini` → `todayRequestCount < llmDailyRequestLimit`, and, if `llmPaidTier`,
     `monthSpend + estimate <= llmMonthlyBudgetUsd` (estimate: input ≈ chars/4 + 1500, output ≈ 1000 tokens).
     Paid cap hit → remaining rows `SKIPPED_BUDGET` (red alert). Daily cap hit → rows stay QUEUED (amber alert).
     Either way, stop the run.
4. `callModel` → `verify.js` → then:
   - If confidence < threshold **and** tier is `LLM_FAST` **and** a strong model is configured → create an
     `LLM_STRONG` Extraction for the same input (QUEUED). With no strong model (the ollama default), skip this.
   - `applyExtraction`: resolve company → parse compensation → dedup → Posting `PENDING_REVIEW` with
     `extractionTier`, `extractionConfidence`, `uncertainFields` → update the submission.
5. Gemini only: wait 4 s between calls. Ollama: none (calls are already slow).

**Month** = calendar month in `Asia/Kolkata`; `monthSpend` = `SUM(LlmUsage.costUsd)` for that month.
**Day** = IST calendar day; `todayRequestCount` = `LlmUsage` rows created that day.

**Deployment note:** the worker must be able to reach Ollama. Locally that's `localhost:11434`. On the
institute VM, someone must install Ollama (about 5 GB disk, about 6 GB RAM, slow on CPU-only), or set
`LLM_PROVIDER=gemini` with a key. Until that's decided, the extraction tier can stay off on the VM
(`llmEnabled=false`); student links still work as **stored links** for admin manual entry, plus ATS and JSON-LD links.

Academic year (`services/careers/academicYear.js`), identical to `middlewares/Forum/addPost.js`:
`start = month >= 6 ? year : year - 1; currentYear = start - admissionYear + 1` (months are 0-indexed; 6 = July).

---

## 9. API (all under `/api/v1`, all behind `checkAuth`)

### 9.1 Student: `routes/careers.js` (+ `requireCareersEnabled`, except where noted)

| Method & path | Purpose |
|---|---|
| `GET /careers/status` *(no flag gate)* | `{ enabled, isCareerAdmin }` |
| `GET /careers/postings` | LIVE only. Query: `q, type, workMode, location, skills (csv), companyId, minStipend, minCtc, includeUndisclosed (default true), eligibleOnly (default false), sort (newest\|lastSeen), page, limit≤50`. Response `meta`: `{ undisclosedIncluded, hiddenByEligibility, eligibility: {applied, reason?} }` |
| `GET /careers/postings/:id` | LIVE (or any status for career admins) + `observations` (url, source name, first/last seen) + `companyExperienceCount` + `saved`, `applicationStatus` for the current user |
| `GET /careers/companies` | ACTIVE companies with ≥1 LIVE posting or ≥1 PUBLISHED linked experience; `q`, paging; counts |
| `GET /careers/companies/:slug` | Company + LIVE postings + PUBLISHED linked experiences (id, title, type, domain, author displayName, createdAt, description HTML) + counts |
| `GET /careers/companies/search?q=` *(no flag gate)* | ACTIVE companies for the picker (id, name, slug), max 10 |
| `POST /careers/submissions` (+ `submissionRateLimit`) | `{ url, note? }` → 201 `{ id, status }`. The same `canonicalUrl` already submitted returns the existing row (200) |
| `GET /careers/submissions/mine` | The student's own submissions with status |
| `GET /careers/me/eligibility` | `{ branchName, academicYear, cpi, cpiUpdatedAt, hasRollNumber }` |
| `PATCH /careers/me/cpi` | `{ cpi: number(0–10, 2dp) \| null }` |
| `PUT /careers/postings/:id/save` / `DELETE` | P4-lite |
| `GET /careers/saved` | P4-lite |
| `PUT /careers/postings/:id/application` | P4-lite: `{ status \| null }` (null deletes) |

**Null-safe compensation where-clause** (`postings/query.js`), for `minStipend = N`:
```
OR [
  { compCurrency: 'INR', stipendDisclosure: { in: [DISCLOSED, RANGE] },
    OR: [ { stipendMax: { gte: N } }, { stipendMax: null, stipendMin: { gte: N } } ] },
  ...(includeUndisclosed ? [ { stipendDisclosure: { in: [NOT_DISCLOSED, UNCLEAR] } }, { compCurrency: { not: 'INR' } } ] : [])
]
```
`minCtc` works the same way. `meta.undisclosedIncluded` = the count of results that matched only through the undisclosed branch.

**Eligibility where-clause** (only when `eligibleOnly=true` and the user has a `branchName` and `admissionYear`):
```
AND [
  { OR: [ { eligibleBranches: { isEmpty: true } }, { eligibleBranches: { has: user.branchName } } ] },
  { OR: [ { eligibleYears:   { isEmpty: true } }, { eligibleYears:   { has: academicYear } } ] },
  user.cpi != null ? { OR: [ { minCpi: null }, { minCpi: { lte: user.cpi } } ] } : {}
]
```
If the user has no roll number: ignore the filter and return `meta.eligibility = { applied:false, reason:'NO_ROLL_NUMBER' }`.
If the user has no CPI, a posting with `minCpi` still passes, and the UI shows "CPI cutoff 7.0 · add your CPI to check".

### 9.2 Admin: `routes/careersAdmin.js` (+ `requireCareerAdmin`), prefix `/careers/admin`

| Method & path | Purpose |
|---|---|
| `GET /review?tab=pending\|flagged&page` | Both tabs list `PENDING_REVIEW` only. **Flagged** = `extractionConfidence < threshold` OR `uncertainFields` non-empty. **Pending** = everything else (MANUAL counts as pending). The two tabs never overlap |
| `GET /postings/:id` | Full posting + observations + reviews + source extraction output |
| `PATCH /postings/:id` | Edit fields → `PostingReview{EDIT, changes}` |
| `POST /postings/:id/approve` | Optional edits in body → LIVE, `publishedAt ??= now`, review log |
| `POST /postings/:id/reject` | `{ reason }` → REJECTED |
| `POST /postings/:id/expire` / `reopen` | Manual state changes |
| `POST /postings/bulk-approve` | `{ ids[] }`: only STRUCTURED or JSON_LD with confidence ≥ threshold and no uncertain fields; the others are returned as skipped |
| `POST /postings` | Manual create (`extractionTier: MANUAL`, MANUAL source, company by id **or** name → resolver). Created as PENDING_REVIEW; with `publish: true` it goes straight to LIVE (the admin is the reviewer) |
| `GET /submissions?status=` | Student links (with the submitter's displayName) |
| `GET /companies?status=&q=&page` · `POST /companies` · `PATCH /companies/:id` | Registry CRUD |
| `POST /companies/:id/aliases` · `DELETE /aliases/:aliasId` | Aliases (a duplicate `normalizedAlias` → 409 with the owning company) |
| `POST /companies/:id/approve` | CANDIDATE → ACTIVE |
| `POST /companies/merge` | `{ fromId, toId }` → `{ log, possibleDuplicatePostings[] }` |
| `POST /companies/:id/split` | `{ name, aliasIds[], postingIds[], experienceIds[], sourceIds[] }` |
| `GET /merge-log?page` · `POST /merge-log/:id/undo` | Audit + undo (409 if not undoable) |
| `GET /backfill/suggestions?page` | Unlinked experiences + suggested company + method + score |
| `POST /backfill/apply` · `POST /backfill/unlink` | `{ items:[{experienceId, companyId}] }` / `{ experienceId }` |
| `GET /sources` · `POST /sources` · `PATCH /sources/:id` | `POST` validates the board by calling the adapter once (400 if it fails) |
| `POST /sources/:id/run` · `POST /sources/run-all` | Sets `careers.runRequest` (202) |
| `GET /sources/:id/runs?limit=20` | Recent runs |
| `GET /ops` | Summary for the operations page (§10) |
| `GET /settings` · `PUT /settings` | Only the keys in §5; values validated with zod |

Validate every request body and query with **zod**. Return 400 `{ error: "VALIDATION_ERROR", message, details }`.

**Route order matters (Express):** declare `/careers/companies/search` **before** `/careers/companies/:slug`, and `/careers/postings/bulk-approve`-style static paths before `/:id` paths.
Apply `requireCareersEnabled` **per route**, not router-wide, because `/careers/status` and `/careers/companies/search` must work with the flag off.

### 9.3 Frontend routes (`App.jsx`)

Under `/dashboard` (existing `ProtectedRoute` + `DashboardLayout`):
`career-vault/jobs`, `career-vault/jobs/:id`, `career-vault/companies`, `career-vault/companies/:slug`, `career-vault/saved`.

Under `/admin` (wrap each in `ProtectedRoute roles={["SUPER_ADMIN","FACULTY","CAREER_ADMIN"]}`):
`careers/review`, `careers/new`, `careers/companies`, `careers/backfill`, `careers/sources`, `careers/ops`.

Sidebar (`DashboardLayout.jsx`):
- In **both** existing admin blocks (general admin and career admin), add "Jobs Review", "Companies"
  and "Sources & Ops", but only for SUPER_ADMIN, FACULTY and CAREER_ADMIN.
- In Student Navigation, add "Jobs & Internships" only when `useCareersStatus().enabled`.
- `CareerVaultTabs` (Experiences | Jobs & Internships | Companies | Saved) sits at the top of the
  Career Vault page and the new pages.

---

## 10. Operations view (`GET /careers/admin/ops`)

```js
{
  worker:   { lastHeartbeatAt, lastJob, stale: minutesSince > 20 },
  sources:  { total, ok, failing, zeroResults, disabled, list: [{id,name,kind,health,lastRunAt,lastSuccessAt,lastFetchedCount,lastKeptCount,lastError}] },
  queue:    { pending, flagged, candidates, submissions: { received, extracting, failed, storedOnly } },
  llm:      { enabled, provider, reachable, modelPresent, keyPresent /*gemini*/, paidTier, monthSpendUsd, budgetUsd, pctUsed, todayRequests, dailyLimit, skippedBudget, queued, failedLast24h, lastError },
  postings: { live, expiredLast7d, newLast24h },
  alerts:   [{ level: 'red'|'amber', code, message }]   // computed, never stored
}
```

Alert rules:
- **Red:** worker stale; any source FAILING; `llmEnabled=true` and the provider is not usable (ollama unreachable or model not pulled; gemini key missing or 401/403 in the last 24 h); paid budget reached.
- **Amber:** any ZERO_RESULTS source; budget ≥ 80%; flagged > 50; FAILED submissions > 0.

---

## 11. Dependencies and scripts

`server-acc` runtime deps to add: `node-cron`, `cheerio`, `fastest-levenshtein`,
`zod`, `undici`. Dev dep: `vitest`. **`@google/genai` is added later, only when the Gemini adapter is written (P1-T10b).** Ollama needs no package (global `fetch`).
`client-acc`: **no new deps** (use `react-select` for the multi-select and company picker, `lucide-react` for icons).

Scripts (`server-acc/package.json`):
```json
"worker": "node worker.js",
"test": "vitest run",
"test:watch": "vitest",
"careers:job": "node scripts/careers/runJob.js",
"careers:seed": "node prisma/seedCareers.js"
```

Env (`server-acc/.env`, **gitignored**; also document the keys in a new `server-acc/.env.example`, names only):
`CAREERS_TZ=Asia/Kolkata`, `LLM_PROVIDER=ollama` (or `gemini`), `OLLAMA_URL=http://localhost:11434`,
`CAREERS_LLM_FAST_MODEL=qwen2.5:7b`, `CAREERS_LLM_STRONG_MODEL=` (empty for ollama), and, only when using Gemini,
`GEMINI_API_KEY` plus `CAREERS_LLM_FAST_MODEL=gemini-3.1-flash-lite` / `CAREERS_LLM_STRONG_MODEL=gemini-3.8-flash`.
`DEV_SEED_PASSWORD` (local only, used by `seedLocalDev.js`). Existing: `POSTGRES_DATABASE_URL`, `SECRET_KEY`, `CLIENT_URL`, `PORT`, `MINIO_*`, `SMTP_*`.

---

## 12. Worker and deployment

`worker.js`:
- `dotenv.config()`, import `prisma`, register with `cron.schedule(expr, fn, { timezone: process.env.CAREERS_TZ || 'Asia/Kolkata' })`
- Log `worker started`; handle `SIGTERM` by stopping crons and calling `prisma.$disconnect()`.

| Cron | Job | Lock key |
|---|---|---|
| `0 2 * * *` | `ingestAll` (skipped if `ingestionEnabled=false`) | 81001 |
| `30 5 * * *` | `recheckLiveness` | 81002 |
| `*/10 * * * *` | `processSubmissions` → `runExtractions` (in sequence) | 81003 |
| `* * * * *` | `checkRunRequests` (consume `careers.runRequest`) | 81004 |

Every job goes through `withJobLock(key, name, fn)`:
- `SELECT pg_try_advisory_lock(key)`; if not acquired, log and skip
- `try { await fn() } catch (e) { console.error }`
- always `pg_advisory_unlock` and `heartbeat(name)`

**Never let an exception escape a cron callback.**

`docker-compose.yml` addition:
```yaml
  fetcher-acc:
    build:
      context: ./server-acc
      dockerfile: Dockerfile
    container_name: acc-fetcher
    restart: unless-stopped
    command: ["node", "worker.js"]
    env_file:
      - ./server-acc/.env
    depends_on:
      - postgres-acc
    networks:
      - acc-net
```
The Dockerfile is unchanged (`worker.js` is in the same image). Production migrations use
`npx prisma migrate deploy`, run by whoever deploys the backend. **Do not add auto-migrate to
container start.**

Local dev (Windows or WSL):
1. `docker compose up -d postgres-acc` (repo root `.env` provides POSTGRES_*).
2. `server-acc/.env`: set `POSTGRES_DATABASE_URL=postgresql://USER:PASS@localhost:5432/DB`.
3. `npx prisma migrate deploy && npm run careers:seed`, then `npm run dev` (API) and `npm run worker` (worker) in two terminals.
4. `client-acc/.env`: `VITE_API_URL=http://localhost:3000/api`, then `npm run dev`.

---

## 13. Testing strategy

- **Unit (vitest, `server-acc/tests/careers/`).** Required for every pure module: `normalize`,
  `compensation`, `fingerprint`, `relevance`, `skills`, `workMode`, `matcher`, `dedup.isSamePosting`,
  `health.nextHealth`, `ipGuard`, `canonicalUrl`, `atsLink`, `jsonLd`, `academicYear`,
  `eligibility`, `postings/query` (builds the where-object; assert its shape), each adapter mapper
  (against saved fixtures), and the extraction zod schema (valid and invalid samples).
- **No real network or model calls in tests.** ATS adapters are tested on fixtures; `fetch` (Ollama) and the `@google/genai` client (Gemini) are mocked. `verify.js` gets the most tests: feed it hallucinated model outputs (wrong type, invented company, paraphrased pay, confidence 100) and assert they are corrected or dropped.
- **Smoke (manual, per phase):** the "Done when" checklist in `Phases.md`, run against a local DB with seed data.
- **Client:** `cd client-acc && npm run build` must pass, and **lint the files you created or changed** (`npx eslint <those paths>`) with **0 errors**. Do not use `npm run lint` as the gate: upstream already has 1,115 errors (1,078 in vendored `public/` files, 36 in `src/`, 1 in `vite.config.js`). Also check `npx eslint src` never exceeds the baseline of **36** errors. Plus a manual browser check at 375 px and 1280 px widths.
