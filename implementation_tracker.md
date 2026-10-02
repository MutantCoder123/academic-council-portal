# Implementation Tracker

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done (checks passed) · `[!]` blocked (see Memory.md) · `[-]` cut / deferred
Update this file at the end of **every** task. The commit column = short SHA.

## Progress summary

| Phase | Planned dates | Tasks | Done | Status |
|---|---|---|---|---|
| P0 Foundation | 29 Sep – 1 Oct | 8 | 8 | **Done** |
| P1 Ingestion | 1 – 4 Oct | 12 | 11 | In progress |
| P2 Browsing | 5 – 6 Oct | 4 | 4 | **Done** |
| P3 Linking | 7 – 8 Oct | 4 | 4 | **Done** |
| P4-lite + Buffer | 9 – 10 Oct | 3 | 0 | Not started |
| **Total** | | **31** | **27** | **87 %** |

**Next task:** `P4-T1` (saved + application tracking). Deferred: P1-T10b (needs Gemini key, before P4-T2)

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
| P1-T10b | Gemini provider (required for final phase; needs API key) | [ ] | | **Deferred (user, 2 Oct): waiting for GEMINI_API_KEY. Must be done before P4-T2** |
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
| P4-T1 ◇ | Saved + application tracking | [ ] | | |
| P4-T2 | Demo readiness + PRD §7 criteria run | [ ] | | |
| P4-T3 | Final QA + PR draft | [ ] | | |

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
