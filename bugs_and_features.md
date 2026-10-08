# Bugs and QoL features: Job & Internship Fetcher

> Written 8 Oct 2026 after a full review of the job-fetcher code (server + client) and a browser
> run as admin and student on the local dev stack. Nothing here is implemented yet.
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
3. [Suggested order](#3-suggested-order)
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

#### B-02 A shared link can put a phishing "Apply" link under a real company
- **Where:** `links/jsonLd.js` (`jobPostingToRaw`: `url` and `hiringOrganization` taken from the page), `extract/verify.js` (`apply_url` and `company_name` only need to appear in the page text), `PostingEditor.jsx` (no warning).
- **What goes wrong:** a student shares a page they control. Its JSON-LD (or its text, for the AI path) says "hiringOrganization: Google" and an apply URL on any domain. Grounding passes because both strings are on the attacker's own page. The posting resolves to the real ACTIVE company "Google" and, once an admin approves it, appears on Google's company page with that apply link.
- **Fix:**
  1. For link postings, keep the apply URL on the shared page's host (or a known ATS host); otherwise use the page URL and flag `applyUrl` as uncertain.
  2. In the review editor, show the apply-link domain next to the company and warn in red when it is not the company's website domain or a known ATS (greenhouse.io, lever.co, ashbyhq.com).
  3. A link whose company resolves to an existing ACTIVE company but whose host is unrelated gets `company` added to `uncertainFields` (goes to Flagged).
- **Effort:** M

#### B-03 Eligibility shown to students is wrong for job-board postings
- **Where:** `ingest/buildPosting.js` (`eligibleBranches: []`, `eligibleYears: []`, no `minCpi`); student card "Eligibility not stated".
- **Seen:** posting #17 (Rubrik, "Software Engineer (CPD) - Winter Intern") says *"CGPA 8 and above · 2027 graduates of Circuital branches only"* in its description; the card says "Eligibility not stated" and the "Eligible for me" filter shows it to every student.
- **Fix (pick one):**
  - **Deterministic parser** (preferred, free): look for `CGPA|CPI|GPA <number> (and above|or above|+)` → `minCpi`; branch words (CSE, ECE, "circuital", EE, ME…) → codes via `postings/branchCodes.js`; graduation year "2027 graduates" → year of study for the current academic year. Every value found is added to `uncertainFields: ['eligibility']` so a reviewer confirms it.
  - Or at least: when the description contains eligibility keywords, add `eligibility` to `uncertainFields` so the posting lands in Flagged instead of Pending.
- **Effort:** M

#### B-04 Irrelevant roles reach the Pending tab with confidence 1.00, and bulk approve publishes them in one click
- **Where:** `text/relevance.js` + `relevanceRules.js` (what counts as "early career"), `buildPosting.js` (confidence only measures *field* certainty), `ReviewQueue.jsx` (bulk approve).
- **Seen (8 Oct):** "Tele caller - Associate", "Sales/Services Associate - Health Insurance", "Executive Assistant", "Risk Analyst | Exp - 1 to 3 Yrs", "Software Engineer - Cloud: Azure" (no junior marker) all had confidence 1.00 and sat in Pending. "Select page" → "Approve 25 selected postings" published 25 postings with **no confirmation dialog** and no way to undo them together.
- **Fix:**
  1. Relevance: drop titles with an experience requirement (`Exp\s*[-:]?\s*[1-9]`, `\b[1-9]\+?\s*(yrs|years)\b`); add a non-campus title list (tele caller, telecaller, sales associate, executive assistant, customer support, collections, field sales…) as a "flag" rule (keep but add `relevance` to `uncertainFields`), not a silent drop.
  2. A posting whose relevance came only from the description, not the title, gets `relevance` uncertain (goes to Flagged).
  3. Bulk approve: confirmation dialog listing the count and the first titles; see F-04 for undo.
- **Effort:** M

### Medium

#### B-05 SSRF guard misses IPv6 forms that embed an IPv4 address
- **Where:** `links/ipGuard.js` (`v6Blocked`).
- **What goes wrong:** NAT64 `64:ff9b::/96` (and the local-use `64:ff9b:1::/48`) and 6to4 `2002::/16` are not blocked. **Confirmed live:** a link to `http://[64:ff9b::7f00:1]/` (= 127.0.0.1) was fetched; the connection only failed because the dev laptop has no IPv6 route. On a network with NAT64 it would reach internal IPv4 addresses. Plain IPv4 tricks were all blocked (port 3000, 169.254.169.254, decimal `2130706433`).
- **Fix:** for `64:ff9b::/96` judge the last 32 bits as IPv4; for `2002::/16` judge bits 16–48 as IPv4; block `64:ff9b:1::/48` and `fec0::/10` (old site-local) outright. Unit tests for each.
- **Effort:** S

#### B-06 Postings never expire on their stated deadline
- **Where:** nothing reads `deadlineStated` after it is stored.
- **What goes wrong:** a role whose application deadline has passed stays LIVE (and in "Newest first") until it leaves its job board, which some companies never do.
- **Fix:** in the daily `recheckLiveness` job (or a new tiny daily job), expire LIVE postings with `deadlineStated < start of today (IST)`; write a `PostingReview` row with action `EXPIRE` and note "Deadline passed". Students' Saved page already handles EXPIRED.
- **Effort:** S

#### B-07 Dedup revives old postings, including ones an admin expired
- **Where:** `ingest/upsertPosting.js` (duplicate branch) + `liveness.js` (`statusWhenSeen(posting, false)`).
- **What goes wrong:** when a company re-posts a role under a new job id within 120 days, the new observation matches the old posting and `statusWhenSeen` (with `observationWasLive = false`) turns an EXPIRED-but-once-approved posting back to LIVE, with its old description and old `deadlineStated`. That includes postings an admin expired by hand.
- **Fix:** keep an `expiredBy` marker (🗄️ nullable column, e.g. `expiredReason: 'BOARD' | 'ADMIN' | 'DEADLINE'`) and only auto-revive `BOARD`; for a match against an EXPIRED posting, refresh its description/deadline from the new observation and send it back to PENDING_REVIEW instead of straight to LIVE.
- **Effort:** M 🗄️

#### B-08 A link that failed once can never be shared again, and re-sharers can't see it
- **Where:** `controllers/careers/submissionsController.js` (`submitLink` returns the first submission for the canonical URL, whatever its status); no retry anywhere (admin UI or API).
- **What goes wrong:** a page that was down for five minutes becomes FAILED forever: every later share gets "already shared". A student who re-shares an existing link also never sees it under "My submissions" (the row belongs to the first sharer).
- **Fix:** if the existing submission is FAILED (or STORED_ONLY older than N days), create a new one; record re-shares (🗄️ small `LinkShare` table or a `shareCount`) so the second student sees it in their list; add an admin **Retry** button (F-09).
- **Effort:** M 🗄️

#### B-09 AI check doesn't verify study years, and CPI matching is too loose
- **Where:** `extract/verify.js`.
- **What goes wrong:** `eligibility.years` are only range-checked (1–5), never grounded in the page, so the model can invent "3rd and 4th year" and hide a posting from 2nd-years under "Eligible for me". `min_cpi` counts as grounded if the digit appears anywhere ("7 days" grounds a CPI of 7).
- **Fix:** ground years against patterns ("3rd year", "pre-final", "2027 graduates", "batch of 2027"); ground CPI only next to `CGPA|CPI|GPA` within ~30 characters.
- **Effort:** S

#### B-10 A LIVE posting can end up under a hidden company
- **Where:** `postings/reviewService.js` (`editPosting` has no `companyMustBeActive`), `companies/mergeService.js` (merging *into* a CANDIDATE is allowed).
- **What goes wrong:** editing a LIVE posting's company to a CANDIDATE/MERGED one, or merging an ACTIVE company into a CANDIDATE, leaves LIVE postings whose company page returns 404 and that link from the job page to nowhere.
- **Fix:** `editPosting` runs `companyMustBeActive` when the posting is LIVE and `companyId` changes; `mergeCompanies` refuses a CANDIDATE target (or approves it in the same transaction, with a confirm in the UI).
- **Effort:** S

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

#### F-02 Remove a job
- **Design, two levels:**
  1. **Take down** (default, reversible): from F-01, the editor, or F-03. A LIVE posting → `REJECTED` with a reason picked from a list ("Closed", "Not for students", "Duplicate", "Spam", "Wrong details"), or `EXPIRED`. Students' saved/tracked copies show "No longer live". Already supported by the API; needs the UI entry points.
  2. **Delete permanently** (career admin, for spam and test data): confirm dialog showing what goes with it ("3 students saved this, 1 is tracking an application"); deletes the posting, its observations, reviews, saves and applications (FKs already cascade for saves/applications). Logged in a small audit row (🗄️ or the ops log) with title + who + when, since the `PostingReview` rows go with it.
- **Also:** the student link that created it is set to `postingId = null` with status `REJECTED`-like so "My submissions" stays truthful.
- **Effort:** M ⚖️ (hard delete of rows is a new destructive feature; AI_Rules §3 says rows are changed only by explicit features, so this needs the user's OK)

#### F-03 Admin shortcuts on the student job page
- **Design:** when the viewer is a career admin, the job detail page shows a small bar: "Edit in admin", "Take down", "Status: LIVE · approved by X on …". Uses `useCareersStatus().isCareerAdmin`.
- **Effort:** S

#### F-04 Safer bulk actions
- **Design:** confirmation dialog for bulk approve (count + first 5 titles); **Undo** in the success toast for 30 s (moves the just-approved postings back to `PENDING_REVIEW`, clears `publishedAt` only if it was set by this action); bulk **reject** and bulk **expire** in the same selection bar.
- **Effort:** M

#### F-05 Report a problem with a posting (students)
- **Design:** "Report a problem" on the job page: closed / wrong pay / wrong eligibility / not a real job / other + optional note (text only). Reports show as a count badge in the review queue and in F-01; three reports auto-flag the posting (adds `reported` to `uncertainFields`, never auto-removes). 🗄️ `PostingReport` table (new, additive).
- **Effort:** M

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

### Operations

#### F-15 Admin activity log
- **Design:** a page listing `PostingReview` rows (approve / reject / expire / edit / create) and `CompanyMergeLog`, filterable by admin and action, so a team of admins can see who published what. Read-only.
- **Effort:** S

#### F-16 Pending-review count in the admin sidebar
- **Design:** the "Jobs Review" sidebar item shows a badge with pending + flagged counts (one cached call to the existing counts).
- **Effort:** S

#### F-17 Clear test data before go-live
- **Design:** `npm run careers:job -- cleanup --dry-run` lists test companies (e.g. "Acme Robotics Test …"), example.com postings, failing test sources and test submissions; without `--dry-run` it removes them. Local and staging only (refuses when `NODE_ENV=production`).
- **Effort:** S

**Rules note.** Hard deletes (F-02, F-07, F-09, F-11, F-17) are new destructive features. AI_Rules §3 says rows are only changed through explicit features, so each needs the user's go-ahead before it is built, and each must: confirm in the UI, show what else is removed, and leave an audit line. Every 🗄️ item is an additive migration (new table or nullable column), reviewed with `--create-only` first.

---

## 3. Suggested order

Deadline is 10 Oct, so in two groups:

**Before the upstream PR (P4-T2 / P4-T3)**
1. B-01, B-05, B-02, B-04 (confirmation + relevance rules), B-06, B-10: the safety and correctness fixes.
2. F-01 + F-02 level 1 (find and take down a live posting) + F-03: without them an admin can't remove a bad job after approving it.
3. F-04 (confirm + undo on bulk approve), F-07 edit + archive, F-09 retry, F-10 shortcuts.
4. B-03 (at least: flag postings whose description mentions eligibility).

**After the PR**
- B-07, B-08, B-09, B-11–B-21.
- F-02 level 2 (permanent delete), F-05, F-06, F-08, F-11–F-17.

## 4. Already works (checked on 8 Oct)

- Every admin endpoint returns 403 to a student; unpublished postings are 404 to students (view and save).
- The student's CPI is in none of: postings list, posting detail, company page, Saved, company list, status.
- Validation: CPI 11, unknown application status, bad ids, `javascript:` and `file:` links → 400; the 6th link in a day → 429.
- SSRF guard (IPv4): port 3000, 169.254.169.254 and `2130706433` blocked before any connection; blocked job sites are never fetched.
- A student note with `<img onerror>` shows as plain text in the admin panel.
- Fetch all now: queued → spinner → "Fetch finished" after 21 s; 13/13 sources OK.
- Save, application status, filters, search, Saved, Companies work; admin pages have no sideways scroll at 375 px.
