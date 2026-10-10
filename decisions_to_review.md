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
- **Status:** Open (the user can decide when P6 / P7 start).
