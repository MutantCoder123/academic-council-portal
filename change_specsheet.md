# Change Spec Sheet

Every deviation from the original proposal (`../ACC_Job_Internship_Fetcher_Proposal (2).pdf`), or
from these planning docs once coding starts, with a short reason.
**Append new entries at the bottom.** Never delete entries. If a change is reverted, add a new entry saying so.

Format: `ID | Date | Area | Change | Why | Decided by`

---

## A. Changes made during planning (29 Sep 2026)

| ID | Area | Change | Why | Decided by |
|---|---|---|---|---|
| C-01 | Eligibility | The CPI filter uses a new **self-reported, nullable `User.cpi`** (+ `cpiUpdatedAt`) | The portal's `User` table has no CPI. Branch and year already exist (from the roll number / `admissionYear`). Self-reported CPI is private to the student and used only for filtering | User |
| C-02 | Integration | `Experience.companyId` is backfilled by **matching titles** (admin-confirmed), and the experience form gets an **optional company picker** | `Experience` has no company field, only a free-text `title`. Improving data at the point of entry (proposal §4.6) applies here too | Planner |
| C-03 | Design | New pages follow the **light dashboard theme in `global.css`**, not the repo's `design.md` (dark/orange) | The upstream `design.md` doesn't match what Career Vault actually renders. Consistency with the real page wins | Planner |
| C-04 | Sources | **Workday dropped** from v1; Greenhouse, Lever, Ashby only | Workday has no documented public job-board API. The undocumented endpoint is fragile, which is exactly the silent-breakage risk the proposal warns about | Planner |
| C-05 | Matching (stretch) | Tier 2 embeddings will use a **local model (transformers.js)**, not an API | Resumes are personal data and must not go to a free-tier API whose content may be used by the provider. A local model is free and private | Planner |
| C-06 | Scraping | No Playwright/Crawlee in v1. Student links use plain `fetch` + `cheerio`, **JSON-LD first** | Chromium in the alpine Docker image is heavy and fragile. Many career pages embed schema.org `JobPosting` JSON-LD, a **free** structured tier that avoids LLM calls (the cost cascade) | Planner |
| C-07 | Rollout | Added an **`AppSetting`** table for the feature flag and tunables | The proposal requires a no-redeploy on/off switch; that needs persistent storage | Planner |
| C-08 | Registry | Added **`CompanyMergeLog`** with undo | The proposal promises a "visible, reversible correction path"; reversal needs a record of what moved | Planner |
| C-09 | Cost | Added **`LlmUsage`** + a **daily request cap** (default 200) and a **monthly $ cap** on paid keys (default USD 5) that pause the LLM tier | Makes the proposal's "extraction spend visible" enforceable, not just visible (see C-25 for the Gemini switch) | Planner |
| C-10 | Schema | `source_links[]` replaced by a **`PostingSource`** table (which is also the proposal's `posting_observations`) | One row per (source, job) gives first/last seen per source, liveness, and unique-constraint dedup for free. Arrays can't do that | Planner |
| C-11 | Security | **SSRF guard** on student link fetching (connect-time IP check, redirect re-validation, size/time caps); LinkedIn/Naukri/etc. are **store-only** | The server sits on the institute network (172.16.x). Fetching arbitrary user URLs without a guard could expose internal services. Those sites' ToS forbid scraping | Planner |
| C-12 | Upstream issues | Noted, **not fixed**. The full list (13 items) is in `planning/upstream_vulnerabilities.md`, sent privately to the maintainers, not in the public PR | Out of scope and risky to touch in someone else's live system. Public disclosure before a fix would expose the live portal | User |
| C-13 | Testing | Added **vitest** to `server-acc` (pure-logic unit tests) | The repo has no tests. Normalisation, dedup, compensation and SSRF logic must be provably right | Planner |
| C-14 | Runtime | Ingestion runs in a **separate `fetcher-acc` container** (same image, `node worker.js`) with Postgres advisory locks | Worker crashes can't affect the live API. No queue server needed | User |
| C-15 | Docs | Planning docs live in `planning/`, a git worktree on the orphan branch **`planning-docs`** of the public fork (pushed); the code stays on `feat/jobs-fetcher`. `upstream_vulnerabilities.md` is gitignored and stays local. (Originally private and outside git; changed 29 Sep at the user's request) | The user wants the plan backed up and pushed with the work. A separate orphan branch keeps the code branch clean for the upstream PR, and the security report stays confidential | User |
| C-16 | Scope/timeline | Committed: P0–P3 + P4-lite (saved + application tracking). Resume matching, notifications, discussion, OA guides and the question bank moved to stretch | Deadline 10 Oct (11 days). Matches the proposal's own "Phase 0–3 committed" stance | Planner |
| C-17 | Schema | `type` enum is `INTERNSHIP / FULL_TIME / UNKNOWN`, plus a separate `ppoMentioned Boolean?` (the proposal had `PPO` as a type) | A PPO is an outcome of an internship, not a posting type. Mixing them breaks filtering. `UNKNOWN` keeps the honest-data rule | Planner |
| C-18 | Schema | Added a `Disclosure.UNCLEAR` value + `compensationRaw` + `compCurrency` | Pay that is mentioned but not parseable ("1.2L", unclear period) is neither "disclosed" nor "not disclosed". Showing the raw text is the honest option | Planner |
| C-19 | Extraction | The LLM copies the compensation **text span**; numbers are parsed by deterministic code | Cheaper, testable and consistent. Keeps the model out of arithmetic | Planner |
| C-20 | Ingestion | For ATS sources, company = `Source.companyId` (no name resolution) | An ATS board belongs to one company, so resolution is only needed for links, manual entry and backfill. Removes a whole error class | Planner |
| C-21 | Ops | Added a **worker heartbeat** + a "worker stale" red alert | "Loud failure" must also cover the worker itself dying. Otherwise every source just looks quiet | Planner |
| C-22 | Naming | Tables follow the repo's Prisma convention (`Company`, `Posting`, ...) instead of snake_case (`companies`, `postings`) | Consistency with the existing schema (PascalCase models, no `@@map`) | Planner |
| C-23 | Relevance | Added a deterministic **relevance filter** (India/remote + intern/new-grad) with fetched vs. kept counts per run | ATS boards are global and mostly senior roles. Without it, the review queue floods and admins stop reviewing | Planner |
| C-24 | Fuzzy match | A fuzzy company match auto-links but **flags** the posting (`uncertainFields: company`) | Fuzzy matching is sometimes wrong (proposal §2.2). Auto-linking without flagging would bake errors in silently | Planner |
| C-25 | LLM provider | **Pluggable LLM provider.** Default is **local Qwen2.5 7B via Ollama** (`LLM_PROVIDER=ollama`); **Google Gemini** is a drop-in later (`LLM_PROVIDER=gemini`, `gemini-3.1-flash-lite` / `gemini-3.8-flash`). Enum values are provider-neutral (`LLM_FAST`, `LLM_STRONG`). (Originally Claude, then Gemini; changed twice at the user's request) | **Qwen is for development/testing only; Gemini is the provider for the final phase/demo** (user, 29 Sep). The user wants no API key or cost during development, and Qwen 7B is already installed locally. Free, private (no data leaves the machine), and switchable later | User |
| C-26 | LLM mechanics | **Synchronous, sequential** model calls with a JSON schema and backoff on failures, instead of a batch API | Gemini's Batch API appears to be paid-tier only. LLM volume is tiny (only non-ATS, non-JSON-LD student links), so batching buys nothing | Planner |
| C-27 | LLM key | If Gemini is used later: a **new, dedicated server-side `GEMINI_API_KEY`** in `server-acc/.env`, not any existing key. Obtain one from the ACC maintainers or Google AI Studio | LLM keys must stay server-side and scoped to this feature | Planner |
| C-28 | Privacy | Only public job-page text is sent to any model: never the student's note, name, email, CPI or resume | Gemini's free tier may let Google use content to improve its products; with local Qwen nothing leaves the machine, but the rule stays so switching providers is safe | Planner |
| C-29 | LLM safety | Added **`verify.js`**: model output is checked against the source text (grounding), `type`/`work_mode` are overridden by deterministic rules, confidence is computed by us, and **local-model results are capped at 0.7 so all land in Flagged** | A live test of `qwen2.5:7b` on 29 Sep labelled an internship `FULL_TIME`, returned confidence `100`, and paraphrased the pay text. A 7B model can't be trusted unchecked; the admin review queue stays the safety net | Planner |
| C-30 | LLM scope | **No escalation model with Ollama** (strong model env empty). Escalation only exists when a strong model is configured (Gemini) | Escalating a 7B model to itself is pointless | Planner |
| C-31 | Deployment | Extraction tier stays **off on the VM** until someone provides Ollama there (or a Gemini key). Student links still work as stored links, ATS links and JSON-LD | The VM's RAM/GPU is unknown; local Qwen needs about 6 GB RAM and is slow on CPU | Planner |
| C-32 | Schema | `LlmUsage` gets a `provider` column; `Extraction` has no batch fields | Track which provider produced each call; sync calls need no batch ids | Planner |

---

## B. Changes during implementation

| ID | Date | Area | Change | Why | Decided by |
|---|---|---|---|---|---|
| C-33 | 29 Sep | Verification | Client lint gate changed from "`npm run lint` passes" to "0 errors in files we create/change, and `src/` stays at or below the upstream baseline of 36" | Upstream already has 1,115 lint errors (mostly vendored jQuery in `public/`). Fixing them would mean editing files we're not allowed to touch | AI (P0-T1) |
