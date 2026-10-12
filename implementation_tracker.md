# Implementation Tracker

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done (checks passed) · `[!]` blocked (see Memory.md) · `[-]` cut / deferred
Update this file at the end of **every** task. The commit column = short SHA.

## Progress summary

| Phase | Planned dates | Tasks | Done | Status |
|---|---|---|---|---|
| P0 Foundation | 29 Sep – 1 Oct | 8 | 8 | **Done** |
| P1 Ingestion | 1 – 4 Oct | 12 | 12 | **Done** |
| P2 Browsing | 5 – 6 Oct | 4 | 4 | **Done** |
| P3 Linking | 7 – 8 Oct | 4 | 4 | **Done** |
| P4-lite + Buffer | 9 – 10 Oct | 3 | 2 | In progress |
| **Plan to 10 Oct** | | **31** | **30** | **97 %** |
| P5 Admin control | after 10 Oct, before go-live | 7 | 7 | **Done** |
| P6 Student value | first month after launch | 11 | 11 | **Done** |
| P7 Depth | after P6 | 12 | 12 | **Done** |
| P8 Needs a decision | only with the user's OK | 3 | 3 | **Done** |
| **Total incl. P5 – P8** | | **64** | **63** | **98 %** |

**Next task:** `P4-T3`: the user decides how to bring in upstream/main (5 commits, 4 conflicting files), then opens the PR with `PR_DESCRIPTION.md`. Go-live checklist L-01 – L-08. Verify-later items: `verify_later.md` (V-01 – V-06). 12 – 13 Oct (Shrut): bugs B-33 – B-48 fixed (C-148 – C-162); B-33 – B-38 re-checked in the browser and a UI sweep (dropdowns, Escape, 375 px) found and fixed B-39 – B-48. Not pushed.
Legend for P5 – P8: 🗄️ additive migration · ⚖️ needs the user's OK before starting (`[!]` until approved). Feature IDs (F-xx) refer to `bugs_and_features.md`; the bugs B-01 – B-21 were fixed on 9 Oct outside this table (see that file and C-80 – C-95).

---

## P0: Foundation
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P0-T1 | Fork, branch, local env, dev seed users + demo experiences | [x] | becda3b | Postgres via docker compose; logins verified |
| P0-T2 | Test tooling (vitest), server deps, .env.example | [x] | 543cb36 | 1 test passes; server boots |
| P0-T3 | Migration `careers_foundation` | [x] | b0021cc | Additive only; existing Career Vault endpoints re-tested |
| P0-T4 | Settings, job lock, careers middlewares, router skeleton | [x] | 09a25f1 | 13 HTTP checks + lock concurrency check pass |
| P0-T5 | Text normalisers + tests | [x] | bed0a0c | 52 normaliser/HTML tests |
| P0-T6 | Company matcher/resolver + seedCareers | [x] | 1414870 | 87 tests total; seed idempotent (60 companies, 86 aliases) |
| P0-T7 | Merge/split/undo service + admin company API | [x] | ac083d0 | 24/24 end-to-end HTTP checks |
| P0-T8 | Admin Companies UI | [x] | 6f2a3c6 | Browser-tested 1280 + 375 px; student gets Access Denied |

## P1: Ingestion
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P1-T1 | Migration `careers_ingestion` + system sources | [x] | 8fbec00 | Additive; merge/split move postings + sources |
| P1-T2 | Deterministic processors + tests | [x] | dff2d82 | 61 new tests |
| P1-T3 | ATS adapters + verify boards (≥5 sources) | [x] | 14d1d01 | 11 sources seeded (GH 6, Lever 4, Ashby 1); 177 tests |
| P1-T4 | runSource/ingestAll/dedup/upsert/health/liveness | [x] | 1bccb4c | Run 1: 45 new / 2 dup; run 2: 0 new, 47 seen; bogus board FAILING; liveness expire verified |
| P1-T5 | Worker process + compose service | [x] | 1635baf | Run request consumed at next minute tick; 2nd worker logged lock skip; heartbeat updates |
| P1-T6 | Review/sources/ops admin API | [x] | 1034953 | 41/41 HTTP checks (student 403 on all 17); approve→LIVE+publishedAt; bulk skips flagged |
| P1-T7 | Review queue UI + manual entry | [x] | 7f72e2b | Browser: edit+approve, reject, bulk approve (16), manual publish, candidate approve; 1280 + 375 px |
| P1-T8 | Sources + Operations UI | [x] | bf52ad8 | FAILING board red with error; worker stale alert (faked heartbeat); visibleToStudents toggle flips student status |
| P1-T9 | Student link pipeline (SSRF guard, JSON-LD, ATS links) | [x] | 4ef6cbd | 127.0.0.1 / 169.254.169.254 / 10.x hostname FAILED; LinkedIn STORED_ONLY unfetched; GH link DUPLICATE (+obs); 6th → 429 |
| P1-T10 | LLM extraction: provider layer + local Qwen 7B (Ollama) + verify.js | [x] | 754aa3e | 368 tests; smoke: 3 real non-ATS job pages → LLM_FAST postings in Flagged (0.40/0.55/0.55); llmEnabled off stops; Ollama down → red alert, rows QUEUED |
| P1-T10b | Gemini provider (required for final phase; needs API key) | [x] | 07234d2 | User 11 Oct: build Gemini now, demo on Groq. `providers/gemini.js` (plain fetch to generateContent, no SDK / no new dependency), 7 mocked tests (body, finish / usage incl. thinking, errors incl. 400 API_KEY_INVALID → AUTH, header key, status, env-only switch, 40K cap); live: gemini → "GEMINI_API_KEY is not set", groq and ollama usable by env change only; 797 tests. **Live Gemini call waits for a key (V-06)** |
| P1-T11 ◇ | Liveness recheck for manual/link postings | [x] | 64ea7bf | 373 tests; dev DB: 8 example.com test postings 404 twice → EXPIRED; real pages stay live; worker lists recheckLiveness 30 5 * * * |

## P2: Browsing
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P2-T1 | Migration `careers_user_cpi` + eligibility API | [x] | 179f0f4 | 397 tests; migration = 2 nullable ADD COLUMNs; 26/26 HTTP checks (set/clear CPI, 6 invalid bodies → 400, flag off → 404 for student / 200 for admin, no `cpi` in 13 other responses) |
| P2-T2 | Postings list/detail API (null-safe + eligibility) | [x] | 4fd7f3e | 416 tests; 40/40 HTTP checks: PRD criterion 5 (NOT_DISCLOSED excluded with includeUndisclosed=false, included + counted with true), eligibleOnly hides ME-only for CS (hiddenByEligibility 1), non-LIVE → 404 for students, flag off → CAREERS_DISABLED for student / works for admin |
| P2-T3 | Jobs list page + filters + eligibility card | [x] | b81b60e | Browser 1280 + 375 px: filters in URL (survive reload), undisclosed + eligibility counts, empty state "1 is hidden by 'Eligible for me'" + Show all, CPI save/clear, mobile drawer, flag off → "isn't open yet" + no sidebar item; build ✓, changed files lint 0, src baseline 36 |
| P2-T4 | Job detail page + submit link | [x] | 47ccf38 | 24/24 browser checks (1280 + 375 px): freshness line (amber at 5 days), deadline only when stated with "stated by source", 3/3 source links, shared link "Being processed" → after the links job "Couldn't be read" + reason; Escape closes dialogs; build ✓, lint 0 / baseline 36, 416 tests |

## P3: Linking
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P3-T1 | Company API + pages | [x] | 42a8087 | 21/21 browser+HTTP checks: Google page shows its LIVE posting + both linked demo experiences with counts ("1 open role", "2 experiences from seniors"); experience HTML rendered exactly as Career Vault; merged slug redirects; 375 px OK; 421 tests |
| P3-T2 | Experience backfill (admin) | [x] | d5d72f3 | 21/21 browser+API checks: suggestions right for 12/12 demo titles (11 companies + none for the startup post); bulk apply + manual pick link them; company pages update (Google 3 → unlink → 2); candidate refused; student 403; 441 tests |
| P3-T3 | Cross-links (posting ↔ experiences) | [x] | 835741a | Both directions navigate (chip → /companies/google; job panel "2 past experiences at Google →" → company page); Career Vault list: 7 queries with 1 or 11 linked posts (no N+1, Prisma query log); flag off → no tabs/chips; 375 px OK; 443 tests |
| P3-T4 | Company picker on experience form | [x] | 18bdd86 | Form submit with Google → admin publish (admin editor) → on the Google company page + chip; without a company the request is the original 6 fields (201); non-ACTIVE/malformed companyId → 400; API checks 15/15; 455 tests |

## P4-lite + Buffer
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P4-T1 ◇ | Saved + application tracking | [x] | 30ed0ca | Migration careers_tracking (additive). Save + status persist across reload/new session; deleting a posting cascades its saves and applications (checked in a rolled-back transaction); API checks 25/25; browser: New badge on exactly the 3 postings published after lastVisit, status cycle + menu, Saved filters, expired saved posting, 375 px; 464 tests |
| P4-T2 | Demo readiness + PRD §7 criteria run | [x] | (data + checks, no code) | 11 Oct, on Groq (user). Real ingest 12 sources (1,728 fetched, 54 kept, 6 new); 31 pending reviewed one by one: 13 approved, 17 rejected with reasons, 1 left for a human → 40 LIVE; 5 labelled demo experiences → Paytm, Razorpay, Rubrik, Groww, Meesho have postings + experiences; worker running. PRD §7: 1 – 8 and 10 pass (details in Memory.md), 9 in P4-T3 |
| P4-T3 | Final QA + PR draft | [~] | (QA + `PR_DESCRIPTION.md`) | 11 Oct: QA passes (797 tests; build ✓; 96 changed client files 0 lint errors; `eslint src` 36; changed existing files all allowed). PR description drafted. **Blocked on the user:** upstream/main is 5 commits ahead and conflicts in App.jsx, DashboardLayout.jsx, schema.prisma, server.js; merging upstream into the branch was refused by the permission check, so the user decides (merge it, or let the AI do it). The user opens the PR |

## P5: Admin control (before go-live)
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P5-T1 | All postings admin page (F-01) | [x] | 168870f | API 16/16: per-status counts = DB (28/19/8/1), each status filter only that status, title + company search, company/source/deadline filters, % → 0, student 403; browser: tabs with counts, search + filters kept in the URL across reload, row opens the editor, 375 px no sideways scroll; 610 tests |
| P5-T2 | Take down a posting, reversible (F-02 level 1) | [x] | b4e68fe | API 15/15: Closed → EXPIRED, saver still opens it + Saved, review note 'Taken down: closed (role filled)', reopen → LIVE; Spam → REJECTED, 404 + gone from Saved, reopen → review; Other w/o reason 400, pending 409, student 403; browser: dialog from All postings + editor, label follows reason, Escape, 375 px; 614 tests |
| P5-T3 | Admin bar on the student job page (F-03) | [x] | d066afa | API 5/5: admin gets adminInfo (approvedBy = approving admin), student never (no adminInfo / approvedBy in the response), pending → 'not approved yet' for admin, 404 for student; browser: bar (status, 'Approved by … on …'), Edit in admin opens the editor in place, Take down from the bar → EXPIRED + 'last expired by …', student sees no bar, 375 px; 616 tests |
| P5-T4 | Student links: retry, create posting, withdraw (F-09) 🗄️ | [x] | 5ab4f95 | Migration careers_link_dismiss (3 nullable ADD COLUMNs). API 18/18: owner-only withdraw (403 other, 409 twice / once processing), kept + never picked by the worker, re-share of a withdrawn link → new row; admin retry FAILED → RECEIVED (403 student, 409 not failed); posting from a link → link points at it, student sees it live after approval, 2nd posting from same link → 409 with nothing created; browser: Withdraw, Retry, Create posting prefill; 631 tests |
| P5-T5 | Shared links never wait forever (F-18) | [x] | 9ba8fd1 | API + pipeline 15/15: AI off → student 'Waiting for an ACC admin', Needs a person lists waiting + store-only (aiUsable false), ops needsPerson/waitingOver48h + amber LINKS_WAITING; dismiss (403 student, 400 empty, 409 twice) cancels the queued extraction, reason shown to the student, re-share not processed; AI on → same kind of link extracted by local Qwen (116 s) into a PENDING_REVIEW posting; browser both sides; 637 tests |
| P5-T6 | Review count in the admin sidebar (F-16) | [x] | c33337a | API 3/3: counts = DB (pending 0, flagged 19, waiting 19), same numbers as the review tabs, student 403; browser: badge 19 → approve one → 18 after reload, no badge for students; upstream DashboardLayout +3/−2 lines; 638 tests |
| P5-T7 | "About these openings" banner + panel (F-28) | [x] | 97d19f8 | Browser: banner on first visit, stays dismissed after reload (header link remains), panel from the header and the banner, 4 sections, Escape closes, 375 px (scrollWidth 375, panel full width); copy listed in Memory.md for the user to review; 638 tests |

## P6: Student value (first month)
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P6-T1 | More boards: scan script, bulk add, source quality (F-23) | [x] | e713b8a | Scan (live, 55 s): 176 companies / 633 URLs → 83 boards, 36 with relevant roles, 28 new paste lines; API 12/12 (bulk 5 lines → 2 added / 1 already there / 2 failed; quality = SQL for Stripe and Paytm; student 403; >30 lines 400); browser 1280 + 375; 647 tests |
| P6-T2 | "New for you" count in the student sidebar (F-21) | [x] | 5b9d981 | API 6/6 (count 7 = 7 New badges with Eligible for me, ≤ all-openings badges, since=now → 0, bad/future/missing 400, hidden → 404); browser: badge 7 → jobs page 7 New badges → badge gone at once and after reload, none before a first visit, 375 px; upstream DashboardLayout +2/−1; 651 tests |
| P6-T3 | Quick filter chips (F-27) | [x] | 0b27f13 | Checks 12/12 + 3 (chip params exact, combine, toggle off; Internships 17 = DB, For me = Eligible checkbox, postedWithin 10/14/30 = DB, 0 → 400); browser: chip → URL type=INTERNSHIP, survives reload, My last filters restores; 375 px; 653 tests |
| P6-T4 | "Did you apply?" nudge (F-26) | [x] | 820d3b2 | Lib 9/9 (Node, fake storage); browser: no nudge before Apply, Apply → reload → nudge, 0 tracking requests until a click, Dismiss persists, new Apply asks again, Mark as Applied = PUT application + PUT save, Saved page nudge → Applied 2; 375 px; test rows removed; 653 tests |
| P6-T5 | Sort by deadline, filter by company (F-14) | [x] | d98046d | API 6/6 with 3 temporary deadlines (+5/+12/+20 days → soonest first, then none newest first, total unchanged; company 37 → only Paytm, 15 = DB; search 'payt'); browser: sort select, deadline lines, 'No deadline stated' divider, no countdown words, company picker → URL companyId + companyName, reload keeps it; 375 px; deadlines cleared; 655 tests |
| P6-T6 | Deadlines on the Saved page (F-20, in-app) | [x] | adf16f6 | Helper 4/4 (Node: only stated, upcoming by date with today upcoming, passed last, India date); browser: 3 rows 15 Oct, 30 Oct, 5 Oct (passed), saved posting without deadline not listed, no countdown words, 375 px; saves + deadlines removed; 655 tests |
| P6-T7 | Report a problem (F-05) 🗄️ | [x] | f62f9ed | Migration careers_posting_reports (CREATE TABLE + 2 indexes + 2 FKs only); API 16/16 (once per student → 409, 3 users → 'reported' flag and still LIVE, admin sees reasons not who, Reported filter, amber alert, handled clears flag and keeps reports, history row); browser student dialog + admin panel, note shown as text, 375 px; test data removed; 662 tests |
| P6-T8 | Safer bulk actions: undo, bulk reject/expire (F-04) | [x] | dea0b25 | API 13/13 on 5 snapshotted postings (approve 5 → Undo → all Pending, publishedAt + reviewer restored exactly, history APPROVE + 'Bulk approve undone'; undo twice skipped; bulk reject 2 / expire 2 = 4 review rows; no reason 400; mixed → skipped not failed; student 403); browser toast Undo (Pending 1 → 0 → 1), Reject… needs a reason; 375 px; all restored; 667 tests |
| P6-T9 | Hide a posting (F-12) 🗄️ | [x] | 8bf813c | Migration careers_hidden_postings (CREATE TABLE + 2 indexes + 2 FKs); API 12/12 (hidden only from that student, showHidden lists it alone, hiddenByYou follows filters, New-for-you count skips it, non-LIVE 404, cascade on delete in a rolled-back transaction, unhide); browser hide → 27 openings + 'Show hidden (1)' → Show again → 28; 'Nothing hidden.' empty view; 375 px; 671 tests |
| P6-T10 | Notes and dates on application tracking (F-13) 🗄️ | [x] | 97d02a9 | Migration careers_application_notes (ADD COLUMN ×2, nullable); API 11/11 (note needs a status 409, appliedAt set once and never moves, note + date on job page and Saved, never another user's, 501 → 400, blank clears); browser: Applied on 10 Oct 2026, '<img onerror>' note stays text (0 img), Saved card, clear-status warning, 375 px; rows removed; 674 tests |
| P6-T11 | Edit and archive a source (F-07) 🗄️ | [x] | 731ca0a | Migration careers_source_archive (ADD COLUMN, nullable); API 16/16 (edit persists, merged / unknown company refused, token fixed, archive hides + disables + leaves ops numbers, enable refused, worker skips it even if enabled in the DB, restore disabled, MANUAL refused); browser edit / archive confirm / Show archived (1) / Restore, 375 px; source reset; also fixed a time-dependent B-11 test; 678 tests |

## P7: Depth
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P7-T1 | Job alerts by email (F-19) ⚖️ 🗄️ | [x] | e05f590 | User OK'd emails 10 Oct. Migration careers_saved_searches (new enum + table); API 25/25 (limit 3, owner-only, emails-off / hidden / no-SMTP send nothing, real digest of 17 LIVE internships via jsonTransport, once per period, unsubscribe + resubscribe without login, also while hidden); browser dialog 1280 / 375, unsubscribe page logged out; 695 tests |
| P7-T2 | Eligibility by graduation batch and programme (F-22) 🗄️ | [x] | 1f7dc14 | Migration careers_graduation_year (3 nullable ADD COLUMNs); API 14/14 (3rd-year CS student not eligible for a "2027 graduates" posting until they set Dual degree + 2027, then eligible on the job page and in Eligible for me; columns in no other response, default Prisma user queries omit them; admin edits batches); browser card edit 1280 / 375; 707 tests |
| P7-T3 | Internship season and duration (F-25) 🗄️ | [x] | b4d82d7 | Migration careers_internship_season (3 nullable ADD COLUMNs); parser 10 tests on dev titles/lines (incl. traps: experience, ago, Java Spring); API 9/9 (season=WINTER → only #64, minDurationMonths=6 → #53/#86, unstated lengths left out, admin edit, alert keeps them); browser chip / filters / job page / editor, 375 px; 720 tests |
| P7-T4 | Usage numbers for ACC (F-30) 🗄️ | [x] | 50a664e | Migration careers_usage_counts (2 new tables); API 12/12 + 3/3 (student counted once a week, admins not; row = week + 64-hex key only; Apply clicks +2; this week and 8 weeks equal independent SQL; 3 saves / 2 tracking / 1 applied show up; no ids or emails in any response; students 403); Usage card 1280 / 375; 728 tests |
| P7-T5 | Review reminders (F-31) ⚖️ | [x] | fb5aa51 | User OK'd the email 10 Oct. API 11/11 (REVIEW_WAITING = 19 postings > 48 h as in the DB; switch off / nothing > 24 h / no SMTP send nothing; one email per CAREER_ADMIN user with the DB numbers; once a day; failure alert set and cleared); browser flags + alert link; 735 tests |
| P7-T6 | Share a posting (F-32) | [x] | 3aa3460 | Client only. Browser: Copy link → clipboard = portal URL of #64, button shows Copied; WhatsApp link (new tab) text "Software Engineer (CPD) - Winter Intern at Rubrik, on ACC Jobs & Internships: <url>", wa.me → api.whatsapp.com/send with that text (200); 375 px; 735 tests |
| P7-T7 | SmartRecruiters + Workable adapters (F-24) | [x] | 29b0dec | APIs verified live first (SR: Swiggy/Bosch/ServiceNow/Experian; Workable v3 POST + v2 detail, pagination token checked on leena-ai). Enum values added with the user's OK (D-14). 11 adapter tests on real fixtures; live ingest 9/9: Swiggy 173 fetched → "Software Dev Engineer I" PENDING_REVIEW with description, 2nd run seen=1 new=0; Leena AI 11 fetched, 0 kept (no junior roles), 2nd run new=0; unknown Workable account BOARD_INVALID; 746 tests |
| P7-T8 | Merge two postings by hand (F-06) | [x] | f3e485c | No schema change. 7 unit tests (rules, application merge, in-memory transaction); API 13/13 on #53 ← #59 (student saved both → one posting on Saved with APPLIED + note; admin's save moved; 3 observations moved; #59 REJECTED "Duplicate of #53"; exactly 2 review rows; repeat / reverse 409; student 403), all restored; browser dialog + preview + Swap, 375 px; 753 tests |
| P7-T9 | Per-source keyword rules (F-08) 🗄️ | [x] | af45c8c | Migration careers_source_keyword_rules (3 nullable ADD COLUMNs); 5 unit tests; live run 8/8: Paytm (Lever) 180 fetched, 18 kept by the global rules, rule "sales, tele" dropped exactly the 2 matching titles (kept 16, run shows sourceRules=2); Stripe (no rules) dropped 0; browser edit fields + run line; 758 tests |
| P7-T10 | Experience shortcuts on company pages (F-10) | [x] | 56ac838 | Client only, no new delete logic. Browser on throwaway experiences: admin Unlink → still PUBLISHED, companyId null; admin Delete… (confirm) → removed via upstream DELETE /posts/:id; student sees the experience with no admin bar (375 px); API: student unlink 403, student delete of another's 403; all throwaway rows removed |
| P7-T11 | Candidate company cleanup (F-11) | [x] | eb1dd35 | User chose hide (D-13). Migration careers_reject_candidate (3 nullable ADD COLUMNs); 6 unit tests; API 15/15 (refused while LIVE uses it; reject → hidden from candidates / All / pickers, under REJECTED, count 11 → 10, its pending posting in Flagged with company uncertain and not approvable; same name later resolves to it, no new company; restore); browser Edit / Reject… / Show rejected / Restore, 375 px; 764 tests |
| P7-T12 | Admin activity log (F-15) | [x] | c19fa11 | Read-only, no schema change. 4 unit tests; API 14/14: all 73 entries (63 reviews, 5 merges / splits, 5 undos) listed with admin and time, newest first, each action filter = DB count, admin filter, fresh reject + reopen on top (rolled back); browser page + filters, 375 px; 768 tests |

## P8: Needs a decision
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P8-T1 | Seniors' reported stipend and process (F-29) ⚖️ 🗄️ | [x] | 2d14c4e | User OK 11 Oct (D-15, one-off exception to AI_Rules §4 for the experience form). 🗄️ `careers_senior_reports`. 7 unit tests; API 15/15 (validation, stored, never echoed or listed, admin edit keeps them, shown only from 3 published reports); browser form + company card, 1280 + 375 px; 786 tests |
| P8-T2 | Delete a posting permanently (F-02 level 2) ⚖️ | [x] | cc81ff6 | User OK 11 Oct (D-15). 🗄️ `careers_posting_deletions`. 5 unit tests; API 18/18 (LIVE 409, wrong confirm 400, student 403, every dependent row gone, link kept + marked, audit row, activity log); browser dialog from row and editor, 1280 + 375 px; 773 tests |
| P8-T3 | Clear test data before go-live (F-17) ⚖️ | [x] | 633ac9b | User OK 11 Oct (D-15): dry run by default, deletes only with `--yes`, refuses NODE_ENV=production. 6 unit tests; dev DB: dry run listed 8 postings, 4 companies, 1 source, 4 links; `--yes` deleted exactly those (DB backup first), second run "Nothing to delete"; activity log 5/5; 779 tests |

---

## PRD success criteria (fill in during P4-T2)
| # | Criterion (short) | Pass? | Evidence |
|---|---|---|---|
| 1 | Feature flag hides/shows without redeploy | | |
| 2 | ≥5 sources ingest; broken source shows FAILING | | |
| 3 | Same role via ATS + link = one posting, two sources | | |
| 4 | Alias resolution + merge/split/undo with log | | |
| 5 | Undisclosed stipend never silently filtered/shown as ₹0 | | |
| 6 | ≥5 company pages with postings + experiences | | |
| 7 | Private-IP link rejected; LinkedIn stored-only | | |
| 8 | LLM spend visible; budget cap stops extraction | | |
| 9 | Server tests + client lint/build pass | | |
| 10 | Only additive migrations; nothing existing broken | | |
