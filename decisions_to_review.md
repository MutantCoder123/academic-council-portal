# Decisions to review

Decisions the AI took or proposed and the user accepted, kept here so they can be reviewed again
later. Each one links to the change-log entry that records it. When a decision is revisited, add a
line under it ("Reviewed <date>: kept / changed, see C-xx"); never delete entries.

Status: **Accepted** = the user said OK; **Open** = still needs the user's answer.

---

## D-01 No permanent deletes in P5 – P7 (C-96)
- **What:** the backlog's "delete a student link" (F-09) became **Dismiss**: the link is kept,
  never processed again, and the student sees the reason. Students "withdraw" their own link the
  same way. Permanent deletes (F-02 level 2, F-17 test-data cleanup, deleting a source or a
  candidate company row) stay in P8 / ⚖️ until approved.
- **Why:** this is a live portal; a dismissed row can be looked at and undone, a deleted one can't.
  AI_Rules §3 only allows changing rows through explicit features.
- **Status:** Accepted by the user, 10 Oct 2026.

## D-02 Taking down a posting (F-02 level 1, P5-T2) (C-96)
- **What:** reason *Closed* → the posting is **expired** (students who saved it still see it as
  "No longer live"). Every other reason (*Not for students*, *Duplicate*, *Spam*, *Wrong details*,
  *Other*) → **rejected** (gone from every student view, including Saved). Both can be reopened.
- **Why:** a closed role is real history for a student tracking an application; spam or wrong data
  must not stay visible.
- **Status:** Accepted by the user, 10 Oct 2026.

## D-03 F-09 before F-18 (C-96)
- **What:** P5-T4 (retry / create posting from a link / withdraw) is built before P5-T5 ("links
  never wait forever"), the reverse of the backlog's list.
- **Why:** F-18's "Needs a person" view reuses F-09's "Create posting from this link" button.
- **Status:** Accepted by the user, 10 Oct 2026.

## D-04 No new enum values; new states are nullable columns (C-96)
- **What:** instead of adding e.g. a `DISMISSED` value to `SubmissionStatus`, new states use
  nullable columns (`LinkSubmission.dismissedAt`, `dismissReason`, `dismissedById`).
- **Why:** `ALTER TYPE … ADD VALUE` is not in AI_Rules §3's list of allowed migration statements.
- **Status:** Accepted by the user, 10 Oct 2026.

## D-05 F-29 (seniors' reported stipend) parked in P8 (C-96)
- **What:** the structured stipend / rounds fields on the experience form wait until the user
  decides.
- **Why:** they change the upstream "Share your experience" form beyond what AI_Rules §4 allows for
  P3 (company picker only).
- **Status:** Accepted by the user, 10 Oct 2026.

## D-07 "New for you" counts only openings the student is eligible for (P6-T2, C-105)
- **What:** the sidebar number on "Jobs & Internships" counts openings published since the last
  visit that pass "Eligible for me" (branch, year, CPI when given). The jobs page itself shows all
  openings by default, so the number can be lower than the "New" badges there, never higher.
- **Why:** Phases.md P6-T2 says the count passes "Eligible for me" ("New for you"); a student is
  not pulled to the page for roles they can't apply to. Alternative: count every new opening, so
  the number always equals the badges on the default page.
- **Status:** Taken by the AI under the user's "I am ok with your decisions" (10 Oct 2026); for
  the user to review.

## D-08 Nobody sees who reported a posting, not even admins (P6-T7, C-110)
- **What:** "Report a problem" stores the reporter (so each student reports a posting once), but no
  endpoint returns it: admins see the reason, the note and the date only.
- **Why:** the reason and note are enough to act on, and students report more freely. Alternative:
  show admins the reporter's name to deal with abuse.
- **Status:** Taken by the AI under the user's "I am ok with your decisions" (10 Oct 2026); for
  the user to review.

## D-09 Reports clear with "Mark as handled"; the flag never hides a posting (P6-T7, C-110)
- **What:** 3 open reports add a "reported" flag and an amber ops alert; the posting stays LIVE.
  "Mark as handled" closes the open reports (kept, with `handledAt`) and clears the flag; 3 new
  reports flag it again. Added a nullable `handledAt` and the alert, which the plan didn't list.
- **Why:** PRD §6: nothing is auto-published or auto-removed; an admin decides. Live postings are
  not in the review queue, so the alert is what makes a reported one visible.
- **Status:** Taken by the AI (10 Oct 2026); for the user to review.

## D-10 Archive / restore of sources, and notes on applications (P6-T10 / T11, C-113, C-114)
- **What:** a restored source comes back **disabled** (an admin enables it); an archived source
  cannot be enabled until restored. Clearing an application status still deletes the application
  row, and now asks first when it has a note. `appliedAt` is also set when the status jumps
  straight to In progress / Offer / Rejected, and is never moved afterwards.
- **Why:** no surprise fetches after a restore; the status column is NOT NULL, so keeping the note
  without a status would need a schema change outside AI_Rules §3.
- **Status:** Taken by the AI (10 Oct 2026); for the user to review.

## D-06 Items that still need an answer
- **What:** F-19 job-alert emails (P7-T1), the e-mail part of F-31 review reminders (P7-T5),
  permanent deletes (P8-T2, F-17 / P8-T3, F-07 source delete, F-11 candidate delete), F-29 (P8-T1).
- **Status:** Partly answered by the user on 10 Oct 2026 when starting P7: **build both emails**
  (F-19 job alerts, F-31 admin reminder email); **F-11 candidate cleanup hides the candidate,
  never deletes the row** (recorded as D-13 with P7-T11). Still open: P8-T2, P8-T3 (F-17), F-07 source delete, F-29.

## D-11 How job-alert emails work (P7-T1, C-115)
- **What:** emails go out only while `careers.visibleToStudents` **and** a new admin switch
  `careers.alertEmailsEnabled` (default **off**, in Settings) are on. The digest job runs daily at
  09:00 IST; a daily alert is sent at most once per ~day, a weekly one at most once per ~week, and
  only when there are new approved (LIVE) postings. Opening the "Stop these emails" link pauses the
  alert immediately, without login; the page offers "Turn it back on". Students can delete their own
  alerts (their own rows, like un-saving). Without SMTP settings the run records an error on each
  waiting alert and Ops shows an amber `ALERT_EMAILS_FAILING`.
- **Why:** ACC decides when the first email goes out (off until switched on); one click to stop is
  what students expect, and a link scanner opening it can be undone by the student.
- **Status:** Taken by the AI (10 Oct 2026); for the user to review.

## D-12 What the usage numbers count, and how (P7-T4, C-118)
- **What:** "Students visited" = students (not career admins) who opened the jobs list, once per IST
  week (Monday – Sunday), stored only as a keyed hash of (user id, week). "Apply clicks" = clicks on
  "Apply on the company site" per posting and day, at most one per student, posting and day
  (kept in memory, not in the database), and never for career admins. Status
  numbers are "tracking started" and "marked applied" rather than every status change. LIVE
  postings are shown as the current count plus "published" per week. The card is on Operations
  only (Sources keeps the per-board quality card).
- **Why:** nothing that names a student is stored, so no endpoint can leak it; status changes have
  no history table, and `updatedAt` also moves when a note is edited.
- **Status:** Taken by the AI (10 Oct 2026); for the user to review.

## D-14 Two enum values added to SourceKind (P7-T7, C-121)
- **What:** `ALTER TYPE "SourceKind" ADD VALUE 'SMARTRECRUITERS'` and `'WORKABLE'`, so boards on
  those ATSs can be sources. AI_Rules §3 does not list enum additions and C-96 had avoided them.
- **Why:** the user approved it on 11 Oct 2026 ("allow two values and take note in the decision
  taken"). It is additive (no rows change), works in one migration on Postgres 16, and modelling
  the ATS as anything other than the source's kind would have been a workaround. Note: Postgres
  cannot drop an enum value, so these two stay even if the adapters are removed.
- **Status:** Decided by the user (11 Oct 2026). AI_Rules §3 itself is unchanged (the AI may not
  edit it); this entry is the record of the exception.

## D-13 Rejecting a candidate company hides it; nothing is deleted (P7-T11, C-125)
- **What:** "Reject" on a candidate company sets `rejectedAt` (with who and an optional reason);
  the row, its aliases and its postings stay. It leaves the candidate list, the company pickers and
  the counts; "Show rejected" lists it with Restore. Allowed only when no live posting, no job board
  and no experience uses it. Its other postings get "company" as an uncertain field (Flagged). The
  name stays known to the matcher, so the same junk name later attaches to the hidden candidate and
  is flagged, instead of creating a new candidate every time.
- **Why:** the user chose "hide it and take note on this decision" (10 Oct 2026) over deleting the
  row; F-11 and D-01 treat permanent deletes as needing an explicit OK.
- **Status:** Decided by the user (10 Oct 2026); the details above were chosen by the AI.

## D-15 P8 approved: permanent delete, test-data cleanup, seniors' stipend (P8-T1 – T3, C-127 –)
- **What the user decided (11 Oct 2026):** build all three P8 tasks. Permanent delete keeps its audit
  line in a new table (`PostingDeletion`, shown in the Activity log). The cleanup command only lists
  by default and deletes only with `--yes`. P8-T1 (stipend fields on the experience form) may edit
  the upstream experience files beyond AI_Rules §4's "P3 only" allowance, as a one-off exception.
- **What the AI chose for P8-T2:** a LIVE posting cannot be deleted directly (take it down first);
  the admin types the posting number back; a student link that made the posting stays in "My
  submissions", marked "The posting made from this link was removed by ACC."; deleting a posting a
  job board still lists does not keep it away (the next fetch adds it back for review), and the
  dialog says so.
- **What the AI chose for P8-T1:** the numbers are private per experience (omitted from every
  query) and appear only as company aggregates once 3 published experiences report the same one:
  a rounded typical value (median), plus the middle half (25th – 75th percentile) only from 5 reports;
  min / max are never shown (changed after the background security review, C-130); the experience type decides stipend vs
  CTC (no separate role-type field). Upstream files edited: `ForumController.js` (+9 / −1),
  `CareerVaultuser/index.jsx` (+6 / −1), `config/db.js` (the omit line).
- **What the AI chose for P8-T3:** only fixed patterns count as test data; anything matching but in
  use is listed as kept. The command's deletions are logged as "Cleanup command" (user id 0).
- **Status:** Decided by the user (11 Oct 2026); the details were chosen by the AI. AI_Rules §4
  itself is unchanged (the AI may not edit it); this entry records the P8-T1 exception.

## D-16 Fixes from Shrut's 12 Oct list (B-33 – B-38, L-08)
- **What the user decided (12 Oct 2026):**
  - B-33: the upstream admin experience editor (`client-acc/src/components/Editor.jsx`) may get a
    company field, as a one-off exception to AI_Rules §4 (like D-15).
  - B-34: an approved company is removed from the pool by moving it back to the candidates (not
    hidden, not deleted).
  - B-35: the student Companies page keeps its default (companies with open roles or experiences)
    and gets a "Show all companies" toggle.
  - B-36: the Student links filter becomes 4 plain chips: Needs attention, In progress, Done, All.
  - "Check admin buttons" (B-37) means the Student links buttons only.
  - L-08: Shrut asks ACC about emails for new openings; no code until they answer.
- **What the AI chose:** the editor sends `companyId` only when the admin changed it (an unchanged
  link to a company that is no longer active never blocks a save). Moving a company back to the
  candidates is refused while live postings, job boards or linked experiences use it (merge or
  unlink those first); its pending postings get the company flagged, as with a rejected candidate.
- **Status:** Decided by the user (12 Oct 2026). AI_Rules §4 itself is unchanged; this entry
  records the Editor.jsx exception.

## D-17 Maintainer SOP ships in the code branch (13 Oct 2026)
- **What the user decided:** an operating guide for the portal's maintainers and ACC career admins,
  in two parts (technical / admin), text only, as `docs/careers/SOP.md` on `feat/jobs-fetcher` so it
  goes upstream with the PR. A one-off exception to "the code branch carries code only": it is a
  maintainer guide, not a planning doc. Planning docs stay on `planning-docs`.
- **What the AI chose:** every UI label is quoted as the portal shows it (checked against the
  client code); no env values, no security findings; the 13 Oct UI-sweep checklist is section A10.
- **Status:** Decided by the user (13 Oct 2026).

