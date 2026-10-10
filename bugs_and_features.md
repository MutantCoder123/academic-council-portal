# Bugs and QoL features: Job & Internship Fetcher

> Written 8 Oct 2026 after a full review of the job-fetcher code (server + client) and a browser
> run as admin and student on the local dev stack. **Bugs B-01 – B-21: all fixed on 9 Oct** (status
> under each bug). **Features F-01 – F-32: none built yet; planned as P5 – P8 in `Phases.md` (10 Oct).** F-18 – F-32 and the go-live checklist
> were added on 9 Oct after a completeness review: what the feature still needs to be truly useful to
> students once it is live on the college website.
> IDs are stable: refer to them in commits and in `change_specsheet.md` (e.g. "fixes B-01").
>
> Upstream portal issues found during the review are **not** in this file (this branch is public);
> they are reported privately to the maintainers.

**Legend**
- Severity: **High** = wrong or unsafe data can reach students, or a feature stops working; **Medium** = wrong behaviour in a realistic case; **Low** = polish, defence in depth, scale.
- Effort: **S** < 2 h, **M** half a day, **L** a day or more.
- 🗄️ = needs a database change (must be additive, AI_Rules §3); ⚖️ = touches an AI_Rules decision and needs the user's OK first.

## Contents
1. [Bugs](#1-bugs)
2. [QoL features](#2-qol-features)
3. [Go-live checklist and suggested order](#3-go-live-checklist-and-suggested-order)
4. [Already works (checked on 8 Oct)](#4-already-works-checked-on-8-oct)

---

## 1. Bugs

### High

#### B-01 One bad extraction blocks the AI queue for good
- **Where:** `server-acc/services/careers/extract/runExtractions.js`
- **What goes wrong:** only `LlmError` is handled per row. Any other error in the loop (the model's reply isn't JSON so `res.json()` throws, `applyExtraction` → `companyFor` throws "Could not tell which company", a DB error while saving) escapes the whole run. The row stays `QUEUED`; being the oldest, it is first again on the next run (every 10 min) and fails again, so every row behind it waits forever.
- **Cost:** with Gemini each retry is a real call that is recorded in `LlmUsage` *before* the failure, so it eats the daily request cap and, on a paid key, money.
- **Fix:** wrap the per-row body in `try/catch`; on an unexpected error mark the row `FAILED` with the message (and the submission `FAILED`), count it, and continue. Add a unit test with a mocked provider that throws a plain `Error`.
- **Verified:** by reading the code (extraction is off locally, so not triggered live). **Effort:** S
- **Status:** ✅ Fixed 9 Oct (`ee4bde2`): rows run in `processRow` inside `try/catch`; 2 unit tests.

#### B-02 A shared link can put a phishing "Apply" link under a real company
- **Where:** `links/jsonLd.js` (`jobPostingToRaw`: `url` and `hiringOrganization` taken from the page), `extract/verify.js` (`apply_url` and `company_name` only need to appear in the page text), `PostingEditor.jsx` (no warning).
- **What goes wrong:** a student shares a page they control. Its JSON-LD (or its text, for the AI path) says "hiringOrganization: Google" and an apply URL on any domain. Grounding passes because both strings are on the attacker's own page. The posting resolves to the real ACTIVE company "Google" and, once an admin approves it, appears on Google's company page with that apply link.
- **Fix:**
  1. For link postings, keep the apply URL on the shared page's host (or a known ATS host); otherwise use the page URL and flag `applyUrl` as uncertain.
  2. In the review editor, show the apply-link domain next to the company and warn in red when it is not the company's website domain or a known ATS (greenhouse.io, lever.co, ashbyhq.com).
  3. A link whose company resolves to an existing ACTIVE company but whose host is unrelated gets `company` added to `uncertainFields` (goes to Flagged).
- **Effort:** M
- **Status:** ✅ Fixed 9 Oct (`a0603c7`, C-83): `links/linkTrust.js` + editor warning; 22 unit tests.

#### B-03 Eligibility shown to students is wrong for job-board postings
- **Where:** `ingest/buildPosting.js` (`eligibleBranches: []`, `eligibleYears: []`, no `minCpi`); student card "Eligibility not stated".
- **Seen:** posting #17 (Rubrik, "Software Engineer (CPD) - Winter Intern") says *"CGPA 8 and above · 2027 graduates of Circuital branches only"* in its description; the card says "Eligibility not stated" and the "Eligible for me" filter shows it to every student.
- **Fix (pick one):**
  - **Deterministic parser** (preferred, free): look for `CGPA|CPI|GPA <number> (and above|or above|+)` → `minCpi`; branch words (CSE, ECE, "circuital", EE, ME…) → codes via `postings/branchCodes.js`; graduation year "2027 graduates" → year of study for the current academic year. Every value found is added to `uncertainFields: ['eligibility']` so a reviewer confirms it.
  - Or at least: when the description contains eligibility keywords, add `eligibility` to `uncertainFields` so the posting lands in Flagged instead of Pending.
- **Effort:** M
- **Status:** ✅ Fixed 9 Oct (`eff87d3`, C-84): deterministic parser `text/eligibility.js`, values flagged for review; 20 new tests.

#### B-04 Irrelevant roles reach the Pending tab with confidence 1.00, and bulk approve publishes them in one click
- **Where:** `text/relevance.js` + `relevanceRules.js` (what counts as "early career"), `buildPosting.js` (confidence only measures *field* certainty), `ReviewQueue.jsx` (bulk approve).
- **Seen (8 Oct):** "Tele caller - Associate", "Sales/Services Associate - Health Insurance", "Executive Assistant", "Risk Analyst | Exp - 1 to 3 Yrs", "Software Engineer - Cloud: Azure" (no junior marker) all had confidence 1.00 and sat in Pending. "Select page" → "Approve 25 selected postings" published 25 postings with **no confirmation dialog** and no way to undo them together.
- **Fix:**
  1. Relevance: drop titles with an experience requirement (`Exp\s*[-:]?\s*[1-9]`, `\b[1-9]\+?\s*(yrs|years)\b`); add a non-campus title list (tele caller, telecaller, sales associate, executive assistant, customer support, collections, field sales…) as a "flag" rule (keep but add `relevance` to `uncertainFields`), not a silent drop.
  2. A posting whose relevance came only from the description, not the title, gets `relevance` uncertain (goes to Flagged).
  3. Bulk approve: confirmation dialog listing the count and the first titles; see F-04 for undo.
- **Effort:** M
- **Status:** ✅ Fixed 9 Oct (`49bae6f`, C-85): experience titles dropped, non-campus / description-only flagged `relevance`, bulk-approve confirmation; 16 new tests. Undo is still F-04.

### Medium

#### B-05 SSRF guard misses IPv6 forms that embed an IPv4 address
- **Where:** `links/ipGuard.js` (`v6Blocked`).
- **What goes wrong:** NAT64 `64:ff9b::/96` (and the local-use `64:ff9b:1::/48`) and 6to4 `2002::/16` are not blocked. **Confirmed live:** a link to `http://[64:ff9b::7f00:1]/` (= 127.0.0.1) was fetched; the connection only failed because the dev laptop has no IPv6 route. On a network with NAT64 it would reach internal IPv4 addresses. Plain IPv4 tricks were all blocked (port 3000, 169.254.169.254, decimal `2130706433`).
- **Fix:** for `64:ff9b::/96` judge the last 32 bits as IPv4; for `2002::/16` judge bits 16–48 as IPv4; block `64:ff9b:1::/48` and `fec0::/10` (old site-local) outright. Unit tests for each.
- **Effort:** S
- **Status:** ✅ Fixed 9 Oct (`da6b430`): as proposed, plus IPv4-translated `::ffff:0:a.b.c.d` (also missed) and Teredo `2001::/32` blocked; 14 new cases.

#### B-06 Postings never expire on their stated deadline
- **Where:** nothing reads `deadlineStated` after it is stored.
- **What goes wrong:** a role whose application deadline has passed stays LIVE (and in "Newest first") until it leaves its job board, which some companies never do.
- **Fix:** in the daily `recheckLiveness` job (or a new tiny daily job), expire LIVE postings with `deadlineStated < start of today (IST)`; write a `PostingReview` row with action `EXPIRE` and note "Deadline passed". Students' Saved page already handles EXPIRED.
- **Effort:** S
- **Status:** ✅ Fixed 9 Oct (`198a711`, C-86): expiry in the daily job (LIVE + pending), no revival past the deadline; logged instead of a `PostingReview` row (no system user).

#### B-07 Dedup revives old postings, including ones an admin expired
- **Where:** `ingest/upsertPosting.js` (duplicate branch) + `liveness.js` (`statusWhenSeen(posting, false)`).
- **What goes wrong:** when a company re-posts a role under a new job id within 120 days, the new observation matches the old posting and `statusWhenSeen` (with `observationWasLive = false`) turns an EXPIRED-but-once-approved posting back to LIVE, with its old description and old `deadlineStated`. That includes postings an admin expired by hand.
- **Fix:** keep an `expiredBy` marker (🗄️ nullable column, e.g. `expiredReason: 'BOARD' | 'ADMIN' | 'DEADLINE'`) and only auto-revive `BOARD`; for a match against an EXPIRED posting, refresh its description/deadline from the new observation and send it back to PENDING_REVIEW instead of straight to LIVE.
- **Effort:** M 🗄️
- **Status:** ✅ Fixed 9 Oct (`43130ba`): expiry reason column; only BOARD revives; re-post of an expired posting goes to review (C-87).

#### B-08 A link that failed once can never be shared again, and re-sharers can't see it
- **Where:** `controllers/careers/submissionsController.js` (`submitLink` returns the first submission for the canonical URL, whatever its status); no retry anywhere (admin UI or API).
- **What goes wrong:** a page that was down for five minutes becomes FAILED forever: every later share gets "already shared". A student who re-shares an existing link also never sees it under "My submissions" (the row belongs to the first sharer).
- **Fix:** if the existing submission is FAILED (or STORED_ONLY older than N days), create a new one; record re-shares (🗄️ small `LinkShare` table or a `shareCount`) so the second student sees it in their list; add an admin **Retry** button (F-09).
- **Effort:** M 🗄️
- **Status:** ✅ Fixed 9 Oct (`f436164`): FAILED / old store-only links are processed again; re-shares recorded in `LinkShare` and shown in My submissions (C-88). Admin Retry button = F-09, not built.

#### B-09 AI check doesn't verify study years, and CPI matching is too loose
- **Where:** `extract/verify.js`.
- **What goes wrong:** `eligibility.years` are only range-checked (1–5), never grounded in the page, so the model can invent "3rd and 4th year" and hide a posting from 2nd-years under "Eligible for me". `min_cpi` counts as grounded if the digit appears anywhere ("7 days" grounds a CPI of 7).
- **Fix:** ground years against patterns ("3rd year", "pre-final", "2027 graduates", "batch of 2027"); ground CPI only next to `CGPA|CPI|GPA` within ~30 characters.
- **Effort:** S
- **Status:** ✅ Fixed 9 Oct (`c755a57`): years and CPI grounded against the page (C-89).

#### B-10 A LIVE posting can end up under a hidden company
- **Where:** `postings/reviewService.js` (`editPosting` has no `companyMustBeActive`), `companies/mergeService.js` (merging *into* a CANDIDATE is allowed).
- **What goes wrong:** editing a LIVE posting's company to a CANDIDATE/MERGED one, or merging an ACTIVE company into a CANDIDATE, leaves LIVE postings whose company page returns 404 and that link from the job page to nowhere.
- **Fix:** `editPosting` runs `companyMustBeActive` when the posting is LIVE and `companyId` changes; `mergeCompanies` refuses a CANDIDATE target (or approves it in the same transaction, with a confirm in the UI).
- **Effort:** S
- **Status:** ✅ Fixed 9 Oct (`3cb9d43`): company change on LIVE needs ACTIVE; ACTIVE → CANDIDATE merge refused (C-90).

### Low

| ID | Bug | Where | Fix | Effort |
|---|---|---|---|---|
| B-11 | Daily link limit can be beaten with parallel requests (count, then insert) | `middlewares/careers/submissionRateLimit.js` | Count and insert in one transaction with `pg_advisory_xact_lock(userId)`, or re-check after insert and delete the extra | S |
| B-12 | Career Vault list returns each experience's company and open-roles count even while the feature is hidden | `ForumController.getAllPosts` → `withOpenRoles` | Skip `withOpenRoles` (return `openRoles: 0`) unless `careers.visibleToStudents` or the caller is a career admin | S |
| B-13 | Settings PUT is "all or nothing" but writes keys one by one | `adminSettingsController.updateSettings` | Write all keys in one `prisma.$transaction` | S |
| B-14 | Search for `%` or `_` matches every posting (wildcards not escaped) | `postings/query.js`, admin review search | Escape `%`, `_`, `\` before `contains` | S |
| B-15 | "Newest first" sort has no matching index | `Posting` | 🗄️ `@@index([status, publishedAt])` (additive) | S |
| B-16 | Text quality: words glued across HTML blocks ("TransformationRubrik", "LAWNOTIFICATION"); a social-links line rendered as a heading; Razorpay locations "Bengaluru; Payments" (department in the location); repeated places ("Bangalore; Bangalore East, Bengaluru, Karnataka, India") | `text/html.js`, `Careers/lib/description.js`, `adapters/greenhouse.js` (`offices[].name`) | Add a space/newline between block elements; don't treat lines with `\|` separators as headings; use `offices[].location` only, never `offices[].name`; de-duplicate cities after normalising | M |
| B-17 | "Fetch finished. New postings are in Jobs Review." even when nothing new was found | `Sources.jsx` | Read the new run counts after the request clears: "Fetch finished: 2 new postings" / "no new postings" | S |
| B-18 | Two admin links use raw URLs without `safeHref` (defence in depth; the server already only accepts http(s)) | `ReviewLinks.jsx`, `PostingEditor.jsx` | Wrap in `safeHref` | S |
| B-19 | `fetcher-acc` has no health check, so a hung worker isn't restarted (only the stale alert shows) | `docker-compose.yml` | Healthcheck command that fails when `careers.workerHeartbeat` is older than 5 min | S |
| B-20 | No size cap on job-board responses (a broken board could return hundreds of MB) | `ingest/http.js` | Read the body with a cap (e.g. 30 MB) like `safeFetch` | S |
| B-21 | Pay filter is close to useless on real data: none of the 25 live postings states pay, so "minimum stipend" only shows undisclosed results | data, `JobFilters.jsx` | UI hint ("Most company boards don't publish pay"); B-03-style parser for "stipend ₹…" in descriptions | S |


**Status of the Low bugs (9 Oct):** all fixed.

| ID | Commit | Result |
|---|---|---|
| B-11 | `8ed22e4` | Count + insert under a per-student advisory lock; 8 parallel shares with limit 5: 6 created before, 5 after (C-91) |
| B-12 | `9ee3339` | Company and counts hidden unless career admin or feature visible (C-92) |
| B-13 | `294d46e` | `setSettings` in one transaction |
| B-14 | `e747314` | `likeSafe` on all 12 searches; q=% 53 → 0 results (C-93) |
| B-15 | `a8aabc2` | Index `(status, publishedAt)` (C-93) |
| B-16 | `59d5d0f` | Greenhouse locations cleaned without changing any India/foreign class; `|` lines not headings; glued words are in the source HTML (C-94) |
| B-17 | `45635f9` | "Fetch finished: N new postings / no new postings / N boards failed" (C-95) |
| B-18 | `544735b` | 3 admin links (incl. company website) through `safeHref` |
| B-19 | `7e3acfb` | Compose health check; unhealthy is shown, not auto-restarted (C-95) |
| B-20 | `bb1b1d6` | 30 MB cap on board responses |
| B-21 | `3dace0b` | Pay read from the description when stated with an amount (flagged); filter hint (C-95) |

---

## 2. QoL features

> What admins and students asked for or obviously need while using the feature. Each has a
> recommended design; the ones that delete data are deliberately conservative because this is a
> live portal (see the rules note at the end of the section).

### Postings (admin)

#### F-01 "All postings" admin page
- **Problem:** once approved, a posting disappears from the admin side. The review queue only lists `PENDING_REVIEW`, and the editor (with Expire / Reject) only opens from there, so an admin can't find a LIVE posting to fix or take down.
- **Design:** new tab or page `/admin/careers/postings`: search (title, company), filters (status LIVE / EXPIRED / REJECTED / PENDING, company, source, tier, has deadline), sort (newest, last seen), paging; each row opens the existing `PostingEditor`. API: extend `GET /careers/admin/review` or add `GET /careers/admin/postings` with a `status` filter.
- **Effort:** M
- **Status:** ✅ Built 10 Oct (`168870f`, P5-T1, C-97): `GET /careers/admin/postings` + `/admin/careers/postings` (button on Jobs review).

#### F-02 Remove a job
- **Design, two levels:**
  1. **Take down** (default, reversible): from F-01, the editor, or F-03. A LIVE posting → `REJECTED` with a reason picked from a list ("Closed", "Not for students", "Duplicate", "Spam", "Wrong details"), or `EXPIRED`. Students' saved/tracked copies show "No longer live". Already supported by the API; needs the UI entry points.
  2. **Delete permanently** (career admin, for spam and test data): confirm dialog showing what goes with it ("3 students saved this, 1 is tracking an application"); deletes the posting, its observations, reviews, saves and applications (FKs already cascade for saves/applications). Logged in a small audit row (🗄️ or the ops log) with title + who + when, since the `PostingReview` rows go with it.
- **Also:** the student link that created it is set to `postingId = null` with status `REJECTED`-like so "My submissions" stays truthful.
- **Effort:** M ⚖️ (hard delete of rows is a new destructive feature; AI_Rules §3 says rows are changed only by explicit features, so this needs the user's OK)
- **Status:** ✅ Level 1 built 10 Oct (`b4e68fe`, P5-T2, C-98, decision D-02): `POST /careers/admin/postings/:id/take-down`; Closed → expired, other reasons → rejected; dialog from All postings and the editor. Level 2 (permanent delete) is P8-T2.

#### F-03 Admin shortcuts on the student job page
- **Design:** when the viewer is a career admin, the job detail page shows a small bar: "Edit in admin", "Take down", "Status: LIVE · approved by X on …". Uses `useCareersStatus().isCareerAdmin`.
- **Effort:** S
- **Status:** ✅ Built 10 Oct (`d066afa`, P5-T3, C-99): `adminInfo` on the student detail API for career admins only; `AdminBar` with Edit in admin and Take down.

#### F-04 Safer bulk actions
- **Design:** confirmation dialog for bulk approve (count + first 5 titles); **Undo** in the success toast for 30 s (moves the just-approved postings back to `PENDING_REVIEW`, clears `publishedAt` only if it was set by this action); bulk **reject** and bulk **expire** in the same selection bar.
- **Effort:** M

#### F-05 Report a problem with a posting (students)
- **Design:** "Report a problem" on the job page: closed / wrong pay / wrong eligibility / not a real job / other + optional note (text only). Reports show as a count badge in the review queue and in F-01; three reports auto-flag the posting (adds `reported` to `uncertainFields`, never auto-removes). 🗄️ `PostingReport` table (new, additive).
- **Effort:** M
- **Status:** ✅ Built 10 Oct (`f62f9ed`, P6-T7, C-110): "Report a problem" on the job page (`PostingReport`, once per student), 3 open reports add `reported` (never hides), report counts in the review queue and All postings (+ "Reported by students" filter), Student reports panel with "Mark as handled" in the editor, amber ops alert.

#### F-06 Merge two postings by hand
- **Design:** dedup misses some pairs; from F-01 pick two postings → "Merge into…": observations, saves and applications move to the kept posting; the other becomes REJECTED "Duplicate of #N". The duplicate report after a company merge (`possibleDuplicatePostings`) gets a "Merge" button.
- **Effort:** M

### Sources (admin)

#### F-07 Delete a source, and edit it
- **Today:** enable/disable works; the API can already change `name` and `companyId`, but the UI can't.
- **Design:**
  - **Edit** dialog: name, company (picker). Board token stays fixed (a different token is a different source).
  - **Delete:** allowed only for sources with no observations (e.g. a board added by mistake that never kept a job) → hard delete with its `SourceRun` rows. A source with observations offers **Archive** instead: disabled and hidden from the list (🗄️ nullable `archivedAt`), its postings keep their history; archived sources are listed under "Show archived" and can be restored.
- **Effort:** M 🗄️

#### F-08 Per-source include / exclude keywords
- **Problem:** some boards are mostly noise (Paytm: tele-callers, sales).
- **Design:** on a source, optional "exclude title keywords" and "only keep titles with" lists, applied after the global relevance rules; the run summary shows "dropped by source rules". 🗄️ two nullable `String[]` columns on `Source`.
- **Effort:** M

### Student links (admin and students)

#### F-09 Retry, delete, or convert a student link
- **Design:** on the Student links tab: **Retry** (FAILED → RECEIVED, picked up by the next links run; uses the same SSRF path), **Delete** (spam), **Create posting from this link** (opens Manual posting with the URL prefilled). Students can withdraw their own link while it is RECEIVED.
- **Effort:** S–M
- **Status:** ✅ Built 10 Oct (`5ab4f95`, P5-T4, C-100, decisions D-01/D-04): admin **Retry** and **Create posting from this link**, students **Withdraw**; no hard delete (spam links are dismissed in P5-T5).

### Companies and experiences (admin)

#### F-10 Remove an experience from the career pages
- **Today:** deleting an experience already exists in upstream's **Manage Posts** (`DELETE /posts/:id`, admins and the author), and unlinking it from a company exists on the **Link experiences** page.
- **Design:** on the company page, career admins get a menu on each experience: "Unlink from this company" (uses the backfill unlink API) and "Delete experience…" (calls the existing upstream delete, with the upstream confirm). No new delete logic; this is only a shortcut to what exists.
- **Effort:** S

#### F-11 Clean up candidate companies
- **Design:** on the Candidate companies tab: **Reject** a candidate (e.g. "keka", "colecta" taken from page noise) when nothing LIVE uses it: its postings go to Flagged with `company` uncertain and the candidate is deleted; **Edit name/website** before approving.
- **Effort:** M

### Students

#### F-12 "Not interested" / hide a posting
- **Design:** students can hide a posting from their own list ("Not for me"); a "Show hidden (3)" toggle brings them back. Per user, never shown to anyone. 🗄️ `HiddenPosting` table (like `SavedPosting`).
- **Effort:** S–M

#### F-13 Notes and dates on application tracking
- **Design:** the Saved page shows "Applied on 3 Oct" (from the status change time) and an optional private note per application (text, max 500). 🗄️ nullable `note`, `appliedAt` on `PostingApplication`.
- **Effort:** S

#### F-14 Sort by deadline, filter by company
- **Design:** "Deadline soonest" sort (postings without a deadline last, labelled "No deadline stated"); company filter on the jobs page (the API already accepts `companyId`).
- **Effort:** S
- **Status:** ✅ Built 10 Oct (`d98046d`, P6-T5, C-108): `sort=deadline` (stated first, soonest first; then "No deadline stated") and a Company search filter on the jobs page; cards show "Deadline stated by source: …".

### Operations

#### F-15 Admin activity log
- **Design:** a page listing `PostingReview` rows (approve / reject / expire / edit / create) and `CompanyMergeLog`, filterable by admin and action, so a team of admins can see who published what. Read-only.
- **Effort:** S

#### F-16 Pending-review count in the admin sidebar
- **Design:** the "Jobs Review" sidebar item shows a badge with pending + flagged counts (one cached call to the existing counts).
- **Effort:** S
- **Status:** ✅ Built 10 Oct (`c33337a`, P5-T6, C-102): `GET /careers/admin/review/counts` + `ReviewCountBadge` on "Jobs Review" in both admin sidebar blocks.

#### F-17 Clear test data before go-live
- **Design:** `npm run careers:job -- cleanup --dry-run` lists test companies (e.g. "Acme Robotics Test …"), example.com postings, failing test sources and test submissions; without `--dry-run` it removes them. Local and staging only (refuses when `NODE_ENV=production`).
- **Effort:** S

### Making it useful to students (added 9 Oct)

> Why these: today a student sees ~25 roles, mostly Bengaluru tech companies, has to remember to
> come back to the portal, and cannot tell which openings fit their batch or programme beyond the
> roll-number guess. These items close that gap. ⚖️ marks anything that sends email or touches a
> PRD non-goal / stretch item and needs the user's OK first.

#### F-18 Shared links never sit at "Being processed" forever
- **Problem:** a shared link that is neither an ATS link nor a page with JSON-LD waits for the AI step. With `careers.llmEnabled` off (the production default, Gemini not built, Ollama on the VM undecided) it stays `EXTRACTING` for good; the student sees "Being processed" and the admin has no action on it.
- **Design:** while the AI tier is off (or the provider is unusable), such links get a student status "Waiting for an ACC admin" (not "Being processed") and appear in the Student links tab under "Needs a person", with **Create posting from this link** (F-09) and **Dismiss** (reason shown to the student, e.g. "Not a job page"). Ops alert (amber) when a link has waited > 48 h. When the AI tier is turned on later, the waiting rows are processed as today.
- **Effort:** S–M
- **Status:** ✅ Built 10 Oct (`9ba8fd1`, P5-T5, C-101): "Waiting for an ACC admin", **Needs a person** filter, **Dismiss** with a reason (row kept, queued extraction cancelled), amber ops alert after 48 h.

#### F-19 Job alerts (saved searches + email digest) ⚖️
- **Problem:** students only see new openings if they remember to visit; most won't.
- **Design:** "Get alerts for this search" on the jobs page saves the current filters (incl. "Eligible for me"); a weekly (or daily, student's choice) digest lists new LIVE postings matching each saved search, sent through the existing nodemailer transporter, with a one-click unsubscribe link. Opt-in only, max 3 saved searches per student, never sent while the feature is hidden. Must **not** reuse upstream `notifyOnNewPost` (emails every user). 🗄️ `SavedSearch` (userId, filters JSON, frequency, lastSentAt).
- **Effort:** M–L (PRD lists digest email as stretch: needs the user's go-ahead)

#### F-20 Deadlines for saved postings
- **Design:** the Saved page gets a "Deadlines stated by source" section, sorted by date, only for postings whose source published a deadline ("Deadline stated by source: 15 Oct"); expired ones move to the bottom. Optional later: a reminder in the F-19 digest for saved postings whose stated deadline is within 3 days. Plain dates only: no countdown timers (PRD non-goal).
- **Effort:** S (in-app), +S with F-19 ⚖️
- **Status:** ✅ Built 10 Oct (`adf16f6`, P6-T6, C-109): "Deadlines stated by source" section on Saved (stated deadlines only, by date, passed ones last, plain dates). Email reminders stay with F-19 (⚖️).

#### F-21 "New for you" badge in the student sidebar
- **Design:** the "Jobs & Internships" sidebar item shows the number of LIVE postings published since the student's last visit (`careers.lastVisit`, already stored for the New badge) that pass "Eligible for me". One small count call, cached for the session.
- **Effort:** S
- **Status:** ✅ Built 10 Oct (`5b9d981`, P6-T2, C-105): `GET /careers/postings/new-count?since=` + `NewJobsBadge` on "Jobs & Internships" (eligible-only, see D-07).

#### F-22 Eligibility by graduation batch and programme
- **Problem:** postings say "2027 graduates" or "final year", but a student's year is guessed from `admissionYear` assuming a 4-year B.Tech; dual-degree, M.Tech, M.Sc and PhD students are matched wrongly or not at all.
- **Design:** the eligibility card shows the derived programme and **expected graduation year** and lets the student correct them (self-reported, like CPI, only visible to them). Postings store eligibility as graduation years when the source states a batch (B-03 parser already finds it), and "Eligible for me" matches on graduation year first, academic year second. 🗄️ nullable `User.programme`, `User.graduationYear` (additive, global omit like `cpi`); nullable `Posting.eligibleGradYears Int[]`.
- **Effort:** M

#### F-23 Many more sources (coverage)
- **Problem:** 13 boards, of which most kept postings come from 4 companies. Value for students scales with coverage.
- **Design:** (1) a script that checks a candidate list of ~150 companies known to hire IIT students (Greenhouse / Lever / Ashby tokens) and reports which boards exist and how many India early-career roles each keeps; (2) an "Add boards in bulk" dialog (paste `kind token company` lines, each validated like Add board); (3) per-source quality stats on Sources & Ops: kept → approved → rejected ratio over 30 days, so noisy boards can be disabled (see F-08).
- **Effort:** M
- **Status:** ✅ Built 10 Oct (`e713b8a`, P6-T1, C-104): `scripts/careers/scanBoards.js` + `boardCandidates.json` (176 companies), "Add boards in bulk" on Sources (`POST /careers/admin/sources/bulk`, ≤ 30 lines), 30-day kept / approved / rejected / waiting per board on Sources and Ops.

#### F-24 More job-board types
- **Design:** adapters for ATSs with documented public JSON APIs that Indian companies use: SmartRecruiters (`/v1/companies/{id}/postings`) and Workable (`/api/v3/accounts/{subdomain}/jobs`), same `fetchPostings` contract, fixtures + tests like P1-T3. Workday stays in the stretch backlog (undocumented API).
- **Effort:** M per adapter (verify each API live first, AI_Rules §12)

#### F-25 Internship season and duration
- **Design:** read "Summer 2027", "Winter", "6 months", "Jan – Jun 2027" from the title/description (deterministic, flagged for review like B-03) into season / start month / duration; filter "Summer internships", "Winter", "6-month"; shown as a chip on cards. 🗄️ nullable `season`, `startMonth`, `durationMonths` on `Posting`.
- **Effort:** M

#### F-26 "Did you apply?" nudge
- **Design:** clicking **Apply** remembers the time (localStorage, per posting). The next time the student opens that posting or the Saved page: "You opened the application on 9 Oct. Mark as Applied?" one click → status APPLIED (and saved). Nothing is stored on the server until the student clicks.
- **Effort:** S
- **Status:** ✅ Built 10 Oct (`820d3b2`, P6-T4, C-107): Apply click remembered in localStorage; "You opened the application on … Did you apply?" on the job page and Saved; Mark as Applied (status + save) / Dismiss.

#### F-27 Quick filter presets
- **Design:** one-tap chips above the list: "For me" (eligible + my year), "Internships", "Remote", "New this week", plus the student's last-used filters. Each chip just sets URL params, so links stay shareable.
- **Effort:** S
- **Status:** ✅ Built 10 Oct (`0b27f13`, P6-T3, C-106): chips *For me* / *Internships* / *Remote* / *New this week* (new `postedWithin` API param) + *My last filters* above the jobs list; URL params only.

#### F-28 Explain what these openings are
- **Problem:** students may confuse this with the placement cell (TPC/CDC) process.
- **Design:** a short dismissible banner and an "About these openings" panel: off-campus roles collected from company job boards and student links, reviewed by ACC before they appear; apply on the company's site; ACC does not run the hiring; how to share a link; how to report a problem (F-05). Text only, stored with the page.
- **Effort:** S
- **Status:** ✅ Built 10 Oct (`97d19f8`, P5-T7, C-103): dismissible banner + "About these openings" panel on the jobs page; copy to be reviewed by the user. "Something wrong with an opening?" (Report a problem) added to the panel on 10 Oct with P6-T7 (C-110).

#### F-29 Seniors' reported stipend and process on company pages ⚖️
- **Problem:** pay is almost never published (0 of 53 dev postings), and students care most about it.
- **Design:** optional structured fields on the experience form (role type, stipend reported, number of rounds, year), shown on the company page only as aggregates ("3 seniors reported ₹40k – 60k / month, 2024 – 2026") and only when ≥ 3 experiences report it. Clearly labelled "reported by seniors", never shown as the posting's pay. 🗄️ nullable columns on `Experience`; touches the upstream form (P3-allowed file). Overlaps stretch item "OA / interview pattern guide".
- **Effort:** M–L

#### F-30 Usage numbers for ACC (aggregate only)
- **Design:** on Sources & Ops: per week, LIVE postings, unique students who opened the jobs page, saves, application statuses set, Apply clicks; per posting (in F-01): saves / applied counts. Aggregate counts only, never which student did what. Lets ACC judge whether the feature helps and which sources are worth keeping. 🗄️ `PostingStat` daily counters (or computed from existing `SavedPosting` / `PostingApplication` + a click counter).
- **Effort:** M

#### F-31 Review reminders for admins ⚖️
- **Problem:** postings only help while fresh; a queue left for a week means students see stale roles.
- **Design:** the F-16 sidebar badge, plus an optional daily email to career admins when items have waited > 24 h ("12 postings waiting, oldest 2 days"). Ops alert (amber) at > 48 h.
- **Effort:** S–M

#### F-32 Share a posting
- **Design:** "Copy link" on the job page (a portal URL; the reader still needs to log in) and a "Share on WhatsApp" link with the title + URL, since that is how openings travel between batchmates.
- **Effort:** S

**Rules note.** Hard deletes (F-02, F-07, F-09, F-11, F-17) are new destructive features. AI_Rules §3 says rows are only changed through explicit features, so each needs the user's go-ahead before it is built, and each must: confirm in the UI, show what else is removed, and leave an audit line. Every 🗄️ item is an additive migration (new table or nullable column), reviewed with `--create-only` first.

---

## 3. Go-live checklist and suggested order

All bugs (B-01 – B-21) were fixed on 9 Oct, so this section now covers launch and features.

### Go-live checklist (not features; needed before students see it)

| # | Task | Why |
|---|---|---|
| L-01 | Deploy the `fetcher-acc` worker on the VM, run `npx prisma migrate deploy`, set the new env vars, watch its health check | Without the worker nothing is fetched and "Fetch now" waits forever (PRD open question 1: who deploys it) |
| L-02 | Decide the AI tier: Gemini (P1-T10b, needs the key), Ollama on the VM, or keep it off and ship F-18 | Otherwise shared non-ATS links never resolve |
| L-03 | Ship F-01 + F-02 level 1 + F-03 — **done 10 Oct (P5-T1 – T3)** | An approved bad posting couldn't be taken down from the UI |
| L-04 | Add the boards in production, do a first review round, run P4-T2 (PRD §7 criteria 1 – 10, recorded in Memory.md) | Production starts with an empty database |
| L-05 | One week admin-only (`visibleToStudents` off), then switch on; name the reviewer(s) and a daily review habit (F-16 / F-31 help) | Freshness depends on reviews |
| L-06 | Council answer on self-reported CPI (PRD open question 3) | Privacy sign-off |
| L-07 | P4-T3: final QA + PR description; the user opens the PR | Plan |

### Suggested feature order

1. **Before go-live:** F-01, F-02 (level 1), F-03, F-18, F-09, F-16, F-28.
2. **First month after launch (most value for students):** F-23, F-21, F-27, F-26, F-14, F-20 (in-app), F-05, F-04, F-12, F-13, F-07.
3. **Next:** F-19 ⚖️, F-22, F-25, F-30, F-31 ⚖️, F-32, F-24, F-06, F-08, F-10, F-11, F-15.
4. **Later / needs a decision:** F-29 ⚖️, F-02 level 2 (permanent delete), F-17.

### Mapped to `Phases.md` (10 Oct, C-96)

The order above is now planned as tasks P5 – P8 in `Phases.md` (design detail, "Done when") and
tracked in `implementation_tracker.md`. When a feature is built, add its Status line here as for the bugs.

| Phase | Tasks (feature) |
|---|---|
| P5 Admin control (before go-live) | P5-T1 F-01 · P5-T2 F-02 level 1 · P5-T3 F-03 · P5-T4 F-09 (retry, create posting, withdraw; **dismiss instead of delete**) · P5-T5 F-18 · P5-T6 F-16 · P5-T7 F-28 |
| P6 Student value | P6-T1 F-23 · P6-T2 F-21 · P6-T3 F-27 · P6-T4 F-26 · P6-T5 F-14 · P6-T6 F-20 (in-app) · P6-T7 F-05 · P6-T8 F-04 · P6-T9 F-12 · P6-T10 F-13 · P6-T11 F-07 (hard delete ⚖️) |
| P7 Depth | P7-T1 F-19 ⚖️ · P7-T2 F-22 · P7-T3 F-25 · P7-T4 F-30 · P7-T5 F-31 (email ⚖️) · P7-T6 F-32 · P7-T7 F-24 · P7-T8 F-06 · P7-T9 F-08 · P7-T10 F-10 · P7-T11 F-11 (row delete ⚖️) · P7-T12 F-15 |
| P8 Needs a decision | P8-T1 F-29 ⚖️ · P8-T2 F-02 level 2 ⚖️ · P8-T3 F-17 ⚖️ |

Changes from the order above: F-09 moved before F-18 (F-18 reuses F-09's "Create posting from this
link"). Go-live checklist L-01 – L-07 is not a task list in `Phases.md`; it stays here.

## 4. Already works (checked on 8 Oct)

- Every admin endpoint returns 403 to a student; unpublished postings are 404 to students (view and save).
- The student's CPI is in none of: postings list, posting detail, company page, Saved, company list, status.
- Validation: CPI 11, unknown application status, bad ids, `javascript:` and `file:` links → 400; the 6th link in a day → 429.
- SSRF guard (IPv4): port 3000, 169.254.169.254 and `2130706433` blocked before any connection; blocked job sites are never fetched.
- A student note with `<img onerror>` shows as plain text in the admin panel.
- Fetch all now: queued → spinner → "Fetch finished" after 21 s; 13/13 sources OK.
- Save, application status, filters, search, Saved, Companies work; admin pages have no sideways scroll at 375 px.
