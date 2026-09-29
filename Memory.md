# Memory: session handoff log

> The coding AI's working memory. **Read first, update last**, every session.
> Keep "Current state" short and always true. Append to the Session log; never rewrite old entries.
> This file is empty until coding starts. That's intentional.

---

## Current state (overwrite this section each session)

- **Phase / task:** P0-T1..T3 done. **Next: P0-T4** (settings, job lock, careers middlewares, router skeleton).
- **Remotes:** `origin` = https://github.com/MutantCoder123/academic-council-portal (push here), `upstream` = PradeepSD476 (never push)
- **Branches:** code = `feat/jobs-fetcher` (in `academic-council-portal/`); docs = orphan `planning-docs` (worktree at `planning/`). Both pushed to `origin` on 29 Sep.
- **`planning/upstream_vulnerabilities.md` is gitignored**: local only, never commit or paste it anywhere.
- **Last commit:** `b0021cc` feat(careers): P0-T3 careers_foundation migration
- **LLM provider:** local Ollama `qwen2.5:7b` for testing; **Gemini for the final phase** (P1-T10b is required, before P4-T2). No API key needed until then.
- **Local env working?** Yes. Postgres = `docker compose up -d postgres-acc` (container `acc-postgres`, port 5432, creds from the repo-root `.env`). API: `cd server-acc && npm run dev` (:3000). Client: `cd client-acc && npm run dev` (:5173).
- **Dev logins:** `devstudent_2401cs98@iitp.ac.in` (STUDENT, CS, 2024) and `devadmin_2401ee97@iitp.ac.in` (CAREER_ADMIN, EE, 2024), password = the `DEV_SEED_PASSWORD` value in the local `server-acc/.env` (never write it in committed files).
- **Tests:** `npm test` → 1 passed.
- **Blockers:** none.

## Where things are (fill in as files are created; saves re-reading the codebase)

| What | Path | Notes |
|---|---|---|
| Local env files (gitignored) | `server-acc/.env`, `client-acc/.env` | Server `.env` has DB URL, random SECRET_KEY, dummy MINIO_* (required at import), LLM + careers keys |
| Dev seed | `server-acc/scripts/careers/seedLocalDev.js` | 2 users + 12 demo experiences with inconsistently spelled company names; idempotent |
| Vitest config | `server-acc/vitest.config.js` | `tests/**/*.test.js`, node env |
| Tests | `server-acc/tests/careers/` | fixtures go in `tests/careers/fixtures/` |
| Env names | `server-acc/.env.example` | names only |
| Registry schema | `server-acc/prisma/schema.prisma` (bottom) + `prisma/migrations/20260929174031_careers_foundation/` | Company, CompanyAlias, CompanyMergeLog, AppSetting, Experience.companyId |

## Decisions made during coding (small ones; big ones also go to change_specsheet.md)

- `Company` only has relations to `CompanyAlias` and `Experience` for now; `postings` / `sources` relations are added in P1-T1 when those models exist (a schema-only change, no SQL).
- Migrations are applied with `npx prisma migrate deploy` **after** reviewing the `--create-only` SQL. This applies exactly the reviewed file; `migrate dev` could regenerate it.
- Client lint gate changed (change_specsheet C-33): lint only the files we touch (0 errors); `npx eslint src` must stay ≤ 36.

## Gotchas / things that surprised me

- **`npx prisma format` reformats existing models** (it re-aligned 2 FinanceVault lines). After formatting, check `git diff prisma/schema.prisma | grep '^-[^-]'` returns nothing, and restore any upstream whitespace.
- Prisma may touch `prisma/migrations/migration_lock.toml` (line endings only). `git checkout --` it; never commit it.
- `config/minio.js` **throws at import if `MINIO_BUCKET_NAME` is missing**; with dummy values the server just logs "Minio bucket initialization failed" and runs.
- Upstream `GET /posts/:id/comments` returns 500 if `page`/`limit` are missing (passes NaN to Prisma). The client always sends them. Not our bug (noted below).
- Versions resolved: **zod 4**, **node-cron 4**, **vitest 5**, cheerio 1.2, undici 7. Check APIs against these majors (e.g. zod 4 error formatting, node-cron 4 `schedule` options).
- Don't redirect logs to `/tmp_*` in Git Bash on Windows (permission denied). Use the session scratchpad.
- The forbidden-SQL grep must not match `ON DELETE` / `ON UPDATE` in FK clauses. Use: `grep -n -i -E '\b(DROP|RENAME|ALTER COLUMN|SET NOT NULL|TRUNCATE)\b|^\s*(DELETE|UPDATE)\b' migration.sql`.

## Verified facts (e.g. ATS response shapes, board tokens that work)

- (29 Sep, dev laptop) Ollama 0.34.4 installed; models present: `qwen2.5:7b` (4.7 GB, Q4_K_M, 32k ctx), `llama3.2:1b`. GPU RTX 4060 8 GB, RAM 15.5 GB.
- `POST /api/chat` with `format` = JSON schema works on `qwen2.5:7b`, and nullable types `{"type":["string","null"]}` are accepted. Cold call about 14 s. Response fields: `message.content`, `done_reason`, `prompt_eval_count`, `eval_count`.
- Observed model errors (motivation for `verify.js`): intern labelled FULL_TIME, `overall_confidence: 100`, pay text paraphrased not verbatim.

## Upstream issues noticed (do NOT fix)

- **Security** issues go in `planning/upstream_vulnerabilities.md` (13 items recorded on 29 Sep). The
  user sends that file privately to the maintainers. **Never paste it into the public PR.**
- Other (non-security) upstream bugs:
  - `ForumController.getComments`: missing `page`/`limit` → `take: NaN` → Prisma error → 500 (should be 400 or default paging).
  - Client lint: 1,115 pre-existing errors (1,078 vendored `public/` jQuery files, 36 in `src/`, 1 in `vite.config.js`).

---

## Session log (append newest at the bottom)

<!--
Template for each entry:

### YYYY-MM-DD, <task id>: <one-line summary>
- Did:
- Files touched:
- Checks run + actual results: (paste summary lines, e.g. "Tests: 42 passed")
- Not verified / skipped (and why):
- Next step:
-->

### 2026-09-29, P0-T1: local environment + dev seed
- Did: started `acc-postgres` via docker compose; created gitignored `server-acc/.env` (DB URL from the repo-root `.env`, random SECRET_KEY, dummy MINIO_*, careers/LLM keys, DEV_SEED_PASSWORD) and `client-acc/.env` (`VITE_API_URL=http://localhost:3000/api`); `npm ci` in both; `prisma migrate deploy` applied all 18 upstream migrations; `prisma migrate diff` DB→schema = empty (no upstream drift); wrote and ran `seedLocalDev.js`.
- Files touched: `server-acc/scripts/careers/seedLocalDev.js` (commit becda3b).
- Checks run + actual results: seed run 1 → "2 users upserted, 12 experiences created"; run 2 → "0 experiences created (12 already present)". Login student → 200, `/auth/me` = STUDENT CS 2024; login admin → 200, CAREER_ADMIN EE 2024; wrong password → 401; `GET /posts` total = 12. Client `npm run build` → "✓ built in 15.60s". Lint baseline: 1,115 errors (not ours).
- Not verified: the client UI in a browser (build only).
- Next step: P0-T2.

### 2026-09-29, P0-T2: test tooling + deps
- Did: `npm i node-cron cheerio fastest-levenshtein zod undici`, `npm i -D vitest`; scripts test/test:watch/worker/careers:job/careers:seed; `vitest.config.js`; sanity test; `.env.example` (names only).
- Files touched: package.json, package-lock.json, vitest.config.js, tests/careers/sanity.test.js, .env.example (commit 543cb36).
- Checks run + actual results: `npm test` → "Test Files 1 passed (1) · Tests 1 passed (1)"; server restart → `/health` {"status":"OK"}, "Server is running on PORT: 3000".
- Next step: P0-T3.

### 2026-09-29, P0-T3: careers_foundation migration
- Did: added the Company/CompanyAlias/CompanyMergeLog/AppSetting models + 3 enums + nullable `Experience.companyId` (+ index); `migrate dev --create-only`; reviewed the SQL; applied with `migrate deploy`.
- Files touched: `prisma/schema.prisma` (+76, −0), `prisma/migrations/20260929174031_careers_foundation/migration.sql` (commit b0021cc).
- Checks run + actual results: statement list = 3× CREATE TYPE, 4× CREATE TABLE, 2× CREATE UNIQUE INDEX, 6× CREATE INDEX, 1× ALTER TABLE ADD COLUMN (`Experience.companyId INTEGER`, nullable), 2× ADD CONSTRAINT FOREIGN KEY. No DROP/RENAME/ALTER COLUMN/SET NOT NULL. `migrate status` → "Database schema is up to date!". Data: experiences 12 (all companyId null), users 2. Existing endpoints after restart: login 200, GET /posts 200 (total 12), toggle-like 200/200, toggle-bookmark 200/200, comments (page=1&limit=10) 200, add comment 201, delete comment 200 (smoke comment removed).
- Next step: P0-T4.
