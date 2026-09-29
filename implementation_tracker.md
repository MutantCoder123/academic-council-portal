# Implementation Tracker

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done (checks passed) · `[!]` blocked (see Memory.md) · `[-]` cut / deferred
Update this file at the end of **every** task. The commit column = short SHA.

## Progress summary

| Phase | Planned dates | Tasks | Done | Status |
|---|---|---|---|---|
| P0 Foundation | 29 Sep – 1 Oct | 8 | 3 | In progress |
| P1 Ingestion | 1 – 4 Oct | 12 | 0 | Not started |
| P2 Browsing | 5 – 6 Oct | 4 | 0 | Not started |
| P3 Linking | 7 – 8 Oct | 4 | 0 | Not started |
| P4-lite + Buffer | 9 – 10 Oct | 3 | 0 | Not started |
| **Total** | | **31** | **3** | **10 %** |

**Next task:** `P0-T4` (settings service, job lock, careers middlewares, router skeleton)

---

## P0: Foundation
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P0-T1 | Fork, branch, local env, dev seed users + demo experiences | [x] | becda3b | Postgres via docker compose; logins verified |
| P0-T2 | Test tooling (vitest), server deps, .env.example | [x] | 543cb36 | 1 test passes; server boots |
| P0-T3 | Migration `careers_foundation` | [x] | b0021cc | Additive only; existing Career Vault endpoints re-tested |
| P0-T4 | Settings, job lock, careers middlewares, router skeleton | [ ] | | |
| P0-T5 | Text normalisers + tests | [ ] | | |
| P0-T6 | Company matcher/resolver + seedCareers | [ ] | | |
| P0-T7 | Merge/split/undo service + admin company API | [ ] | | |
| P0-T8 | Admin Companies UI | [ ] | | |

## P1: Ingestion
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P1-T1 | Migration `careers_ingestion` + system sources | [ ] | | |
| P1-T2 | Deterministic processors + tests | [ ] | | |
| P1-T3 | ATS adapters + verify boards (≥5 sources) | [ ] | | |
| P1-T4 | runSource/ingestAll/dedup/upsert/health/liveness | [ ] | | |
| P1-T5 | Worker process + compose service | [ ] | | |
| P1-T6 | Review/sources/ops admin API | [ ] | | |
| P1-T7 | Review queue UI + manual entry | [ ] | | |
| P1-T8 | Sources + Operations UI | [ ] | | |
| P1-T9 | Student link pipeline (SSRF guard, JSON-LD, ATS links) | [ ] | | |
| P1-T10 | LLM extraction: provider layer + local Qwen 7B (Ollama) + verify.js | [ ] | | |
| P1-T10b | Gemini provider (required for final phase; needs API key) | [ ] | | Qwen = testing only; switch before P4-T2 |
| P1-T11 ◇ | Liveness recheck for manual/link postings | [ ] | | |

## P2: Browsing
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P2-T1 | Migration `careers_user_cpi` + eligibility API | [ ] | | |
| P2-T2 | Postings list/detail API (null-safe + eligibility) | [ ] | | |
| P2-T3 | Jobs list page + filters + eligibility card | [ ] | | |
| P2-T4 | Job detail page + submit link | [ ] | | |

## P3: Linking
| ID | Task | Status | Commit | Notes |
|---|---|---|---|---|
| P3-T1 | Company API + pages | [ ] | | |
| P3-T2 | Experience backfill (admin) | [ ] | | |
| P3-T3 | Cross-links (posting ↔ experiences) | [ ] | | |
| P3-T4 | Company picker on experience form | [ ] | | |

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
