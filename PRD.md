# PRD: Automated Job & Internship Fetcher (Career Vault extension)

**Project:** ACC Portal Open Projects, Project 2 (Career Vault), IIT Patna
**Team:** Indranil Saha (2401CS49), Shrut Gautam (2401CS62)
**Deadline:** 10 October 2026
**Source documents:** `../ACC_Job_Internship_Fetcher_Proposal (2).pdf`, `../acc_fetcher_proposal_notes.md`
**Deviations from the proposal:** see `change_specsheet.md`

---

## 1. Problem

Career Vault already holds internship and placement experiences written by IIT Patna students.
Those experiences are about companies. Job postings are also about companies. Nothing connects
the two today.

Collecting job links is easy. The hard parts are:
- recognising that "Google", "Google India" and "Google LLC" are the same company,
- recognising that one internship posted on three sites is one posting,
- never presenting unknown information (stipend, deadline, eligibility) as confirmed fact.

## 2. Goal

Make Career Vault the place where an IIT Patna student sees **current openings next to what their
seniors wrote about that company**. That connection is not available anywhere else. The job
listings alone are a commodity.

## 3. Users and roles

Roles come from the existing `Role` enum. **No new role and no new login.**

| User | Portal role(s) | What they get |
|---|---|---|
| Student | `STUDENT` (and admins in "Student View") | Browse approved postings, filter, see company pages, submit links, set CPI, save and track postings |
| Career admin | `CAREER_ADMIN`, `SUPER_ADMIN`, `FACULTY` | Review queue, manual entry, company registry (merge/split/undo), sources, operations view, feature flags, experience backfill |

The admin role set matches the existing `checkCareerAdmin` middleware exactly.

## 4. Design principles (from the proposal; apply everywhere)

1. **Cost cascade:** structured APIs → deterministic code → small LLM (local Qwen 7B now, Gemini later) → optional stronger model. Never
   skip a cheaper tier.
2. **Loud failure:** every automated part reports its health on the admin operations page. A
   source that returns zero results is an alert, not an empty page.
3. **Additive integration:** new tables and new nullable columns only. Nothing existing is
   renamed, restructured or dropped.
4. **Honest data:** unknown means unknown. No `₹0` for an undisclosed stipend, no invented
   deadlines, no countdown timers.

## 5. Scope

### 5.1 Committed for 10 Oct (Phases 0–3 + P4-lite)

**F1. Company registry** (Phase 0)
- One canonical `Company` row per organisation, with aliases.
- Automatic resolution runs cheapest first: exact alias → normalised name → fuzzy match → create a
  *candidate* company for admin review.
- Admins can merge two companies, split one into two, and **undo** either (audit log).
- Postings and experiences reference companies by ID, never by raw text.

**F2. Ingestion** (Phase 1)
- A separate worker runs on a schedule (nightly 02:00 IST) over an **allowlist** of sources.
  There is no open-web crawling.
- Source kinds: Greenhouse, Lever, Ashby (public JSON job-board APIs), admin manual entry, and
  student-submitted links.
- Relevance filter: keep India or remote roles at intern, new-grad or entry level. Drop senior roles.
- Deterministic normalisation of title, location, compensation, skills and work mode.
- Deterministic deduplication: company ID + normalised title + normalised location + description
  fingerprint. Duplicates merge into one posting that keeps every source link.
- A small LLM extracts fields only from unstructured text (student links that are neither ATS links nor pages
  with JSON-LD). **Default: local Qwen2.5 7B via Ollama** (free, private, no key). **Swappable to Google Gemini**
  by changing one env variable. The model's output is never trusted: code checks each field against the
  source text, corrects obvious errors, and every locally-extracted posting is sent to the Flagged tab for review.
- If Gemini is used later: a daily request cap (and a monthly $ cap on a paid key). When a cap is reached, the
  LLM tier pauses and the operations page says so. With local Ollama there is no cost, so no cap.

**F3. Admin review queue** (Phase 1)
- **Nothing is published automatically.** Every posting starts as `PENDING_REVIEW`.
- Tabs: Pending, Flagged (low confidence, with the uncertain fields highlighted), Candidate
  companies, Student links.
- Approve, edit + approve, reject (with reason), and bulk-approve for high-confidence structured
  postings.
- Admin edits are stored as a diff, so recurring extraction weaknesses become visible.

**F4. Operations view** (Phase 1)
- Per source: last run, last success, count returned, health (OK / FAILING / ZERO_RESULTS /
  DISABLED).
- Queue sizes, low-confidence count, LLM provider status (Ollama reachable / model present, or Gemini requests against the daily cap and spend against the budget).
- Feature-flag toggles, no redeploy needed: student visibility, ingestion on/off, LLM tier on/off.
- "Run now" per source.

**F5. Student browsing** (Phase 2)
- Job list with filters: type, work mode, location, skills, minimum stipend, minimum CTC, company,
  search.
- **Null-safe compensation filter:** undisclosed pay is shown as "Undisclosed". An "Include
  undisclosed compensation" checkbox is on by default, and its count is shown.
- **Eligibility filter ("Eligible for me"):** branch (from roll number), current academic year
  (from `admissionYear`), and **self-reported CPI** (optional). Postings that state no eligibility
  are shown with "Eligibility not stated".
- Detail page with a freshness line built only from observed facts: *"First seen 6 days ago ·
  confirmed live this morning"*. Deadline shown only if the source published one, labelled
  "Deadline stated by source".
- All source links for the posting, so the student picks where to apply.
- Submit a link: the student pastes a URL, which enters the same review queue.

**F6. Linking layer / company pages** (Phase 3)
- A company page shows current live postings and the published Career Vault experiences for that
  company, with counts.
- A posting detail page shows a compact panel: "N past experiences at <Company> →".
- An experience card shows "N open roles at <Company> →" when it is linked.
- Experience backfill tool: the admin reviews suggested company links for old experiences (matched
  from titles) and applies or unlinks them. Reversible.
- The experience submission form gets an **optional** company picker.

**F7. P4-lite** (buffer days, only if Phases 0–3 are done)
- Save a posting, plus a Saved tab.
- One-click application status: Interested → Applied → In progress → Rejected / Offer.
- A "New since your last visit" marker (stored in the browser).

### 5.2 Stretch (after 10 Oct; not in this build)

Resume match scoring (skills overlap + local embeddings + on-demand LLM explanation), digest
email notifications, company discussion with experience-weighted ranking, OA/interview pattern
guides, question bank, open-duration estimates, more ATS providers (Workday), Playwright-based
career-page adapters.

### 5.2a After 10 Oct: P5 – P8 (planned 10 Oct)

Admin control before go-live (all postings, take down, admin bar on the job page, student-link
retry / dismiss, review badge, an explainer for students), then student-value features (more
boards, new-for-you count, quick filters, apply nudge, deadline sort, reports, hide, notes) and
depth items. Full list in `bugs_and_features.md` §2, build order in `Phases.md` P5 – P8. Items that
send email (F-19, F-31) are PRD stretch work and need the user's OK; no item adds countdowns or
auto-publishing (§6 still applies).

### 5.3 Deferred (proposal §5)

Alumni referral contact (reputational risk, no consent database). Batch selection statistics (data
availability question for the placement cell).

## 6. Non-goals

- Open-web crawling, or scraping LinkedIn, Naukri, Indeed or Glassdoor (their terms of service
  forbid it). Links from those sites are **stored only**, and the admin fills in the details
  manually.
- Auto-publishing anything.
- Deadline countdowns or estimated deadlines.
- A new account system, new roles, or a second database.
- Redesigning existing Career Vault features.

## 7. Success criteria (what "done" means on 10 Oct)

1. With the feature flag off, students see nothing new. With it on, they see the Jobs tab. The
   toggle works without a redeploy.
2. A nightly run against at least 5 verified ATS sources produces postings in the review queue.
   `SourceRun` rows exist, and a deliberately broken source shows as FAILING on the operations page.
3. The same role, submitted twice (ATS + student link), appears as **one** posting with two source
   links.
4. "Google India" and "Google LLC" resolve to one company. An admin can merge two companies, split
   them again, and undo, with the merge log showing each step.
5. A posting without a stipend never matches a minimum-stipend filter unless "include undisclosed"
   is on, and it always renders as "Undisclosed".
6. A company page shows both live postings and linked experiences for at least 5 real companies.
7. A student link to a private IP or `localhost` is rejected. A LinkedIn link is stored without
   being fetched.
8. LLM status and usage are visible on the operations page; stopping Ollama raises a red alert and queued items wait; with Gemini, extraction also stops at the daily cap / monthly budget.
9. Server unit tests pass (`npm test` in `server-acc`). `npm run build` passes in `client-acc`, every client file
   we created or changed has 0 lint errors, and the upstream `src/` lint count does not rise above its baseline (36).
10. No existing column, table, route or page is broken. Every migration is purely additive.

## 8. Constraints

- Stack is fixed by the problem statement and the repo: React 19 + Vite + Tailwind 4 (client),
  Express 5 + Prisma 6 + PostgreSQL 16 (server), plain JavaScript (ESM). No TypeScript.
- Deploys to the institute VM via docker-compose (behind nginx, `acc.iitp.ac.in`).
- LLM: local Ollama (`qwen2.5:7b`) by default; a Gemini API key (if used later) is server-side only. Only public job-page text is ever sent to a model.
- Budget: a student-council project. Default LLM cost is **zero** (local Qwen). If Gemini is used later: free tier with a **200 requests/day** cap, or a **USD 5/month** cap on a paid key (configurable).

## 9. Open questions (to confirm with the ACC maintainers; not blocking)

1. Who deploys the new `fetcher-acc` docker service on the VM? (`deploy.yml` only builds the
   client.)
2. Where does the LLM run in production? Local Qwen needs Ollama on the institute VM (about 5 GB disk, about 6 GB RAM, slow without a GPU); otherwise use Gemini with a **new server-side key** (not the old `VITE_GEMINI_API_KEY`). Until decided, keep `llmEnabled=false` on the VM.
3. Is self-reported CPI acceptable to the council from a privacy standpoint? (It is stored only on
   the user row, shown only to that user, and used only for filtering.)
4. Security observations about the existing portal were reported privately to the maintainers. They are not
   tracked in this repository and are out of scope for this project.