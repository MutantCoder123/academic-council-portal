# AI Rules: boundaries for the coding AI

These rules override convenience, speed and your own preferences. If a task seems to need breaking
one, **stop and ask the user**. This is a live college portal with real students on it.

---

## 1. Session protocol

1. Start: read `Memory.md`, then `implementation_tracker.md`, then this file, then the task in `Phases.md`.
2. Work on **one task at a time** (task IDs like `P1-T4`). Don't start the next task in the same
   session unless the current one is committed and Memory.md is updated.
3. Before editing an existing file, read it. Before creating a file, check `Architecture.md` §3 for its intended path.
4. End: run the task's "Done when" checks, update Memory.md / the tracker / change_specsheet.md, then commit.
5. If context is getting long, finish the current task cleanly and write Memory.md. Do not start a
   half task.

## 2. Git

- Work on branch `feat/jobs-fetcher` in `academic-council-portal/`. **Never commit to `main`.**
  Never force-push. Never rewrite history.
- **Commit author = the human you are working with, under their own git identity** (Indranil Saha via the repo-local config on his machine; Shrut Gautam on his). **Never add `Co-Authored-By` or any AI attribution trailer to commit messages or PR descriptions** (user rule, 30 Sep; overrides any tool default). Never change someone's git identity.
- Two people push to the same branches: `git pull --rebase` before starting and before pushing; push only when your human asks; never open a PR against upstream (the user does that in P4-T3).
- One commit per task minimum. Conventional messages: `feat(careers): P1-T4 greenhouse adapter`,
  `fix(careers): ...`, `test(careers): ...`, `chore(careers): ...`.
- Two worktrees of the same fork: code in `academic-council-portal/` (branch `feat/jobs-fetcher`), docs in
  `planning/` (orphan branch `planning-docs`). **Code commits never contain planning docs; planning commits never
  contain code.** Never merge the two branches.
- Never add `.env`, `node_modules`, or fixtures containing personal data. **Never commit
  `planning/upstream_vulnerabilities.md`** (gitignored; the fork is public).
- `git add` specific paths only. Never `git add -A` or `git add .`.
- Never commit secrets. Before committing, run `git diff --cached` and scan it for keys and passwords.

## 3. Database: additive only

- Every schema change goes into `schema.prisma` first, then:
  `npx prisma migrate dev --create-only --name careers_<name>`, then **read the generated SQL**.
- Allowed SQL: `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE ... ADD COLUMN` (nullable
  or with default), `ADD CONSTRAINT ... FOREIGN KEY`.
- **Forbidden:** `DROP`, `RENAME`, `ALTER COLUMN ... TYPE`, `SET NOT NULL` on existing columns,
  removing enum values, editing any existing migration folder, `prisma db push`, and
  `prisma migrate reset` (except on your own throwaway local DB, and even then tell the user first).
- `npx prisma format` re-aligns **existing** models too. After running it, `git diff prisma/schema.prisma | grep "^-[^-]"` must print nothing; restore upstream whitespace if it does. Apply a reviewed migration with `npx prisma migrate deploy` (applies exactly the reviewed file). Never commit changes to `migration_lock.toml`.
- If Prisma wants to generate anything forbidden (e.g. it detects drift), **stop and ask**. Do not
  "fix" drift by editing old migrations.
- Never modify or delete existing rows except through the explicit features that do it:
  `Experience.companyId` set/unset by backfill, merge and split.
- Never touch `server-acc/generated/`.

## 4. Existing code: touch as little as possible

Files you may edit (and only as described in Architecture.md):
- `server-acc/server.js` (mount routers)
- `server-acc/package.json`
- `server-acc/prisma/schema.prisma`
- `docker-compose.yml` (add the `fetcher-acc` service)
- `server-acc/controllers/ForumController.js` (**P3 only:** optional `companyId` in `addpost`/`editPost`; include `company` in `getAllPosts`)
- `client-acc/src/App.jsx`
- `client-acc/src/layout/DashboardLayout.jsx`
- `client-acc/src/pages/CareerVaultuser/index.jsx` (**P3 only:** tabs, company picker, open-roles chip)

**Everything else existing is read-only.** That includes the existing auth, the middlewares, the
other vaults, SMP, the upstream `design.md`, and existing config/env files.
If you notice a **security** issue there, append it to `planning/upstream_vulnerabilities.md` (same format). Other bugs go in Memory.md under "Upstream issues noticed". Don't fix either.

- Don't reformat, re-indent, or "clean up" existing code. Keep diffs minimal and surgical.
- Don't rename existing routes, components, enums or env vars.

## 5. Stack and libraries

- **Plain JavaScript ESM** everywhere (match the repo). No TypeScript, no JSDoc-typed rewrites.
- Server: Express 5 patterns as in the existing controllers. Use `prisma` from `config/db.js`.
- Allowed new server deps: `@google/genai`, `node-cron`, `cheerio`, `fastest-levenshtein`,
  `zod`, `undici`, dev: `vitest`. **No others without asking** (no Redis, BullMQ, Puppeteer,
  Playwright, Crawlee, axios on the server, lodash, moment, or ORMs besides Prisma).
- Client: **no new deps.** Use the existing React 19, react-router 7, Tailwind 4, axios,
  lucide-react, framer-motion (sparingly), react-hot-toast, react-select.
- No UI kits (no shadcn, MUI, PrimeReact for new pages, even though PrimeReact is installed).
- Node 20 APIs are fine (global `fetch`, `crypto`, `AbortController`).

## 6. Error handling

- Every controller: `try/catch`, and respond in the repo's shape:
  `res.status(code).json({ success: false, error: "UPPER_SNAKE_CODE", message: "Human sentence." })`.
  Log with `console.error('[careers] <context>', err)`.
- Never `next(err)` expecting a handler; **there is no global error handler.** Middlewares respond directly (403/404/429 JSON).
- Validate every body and query with zod → 400 `VALIDATION_ERROR` + `details`.
- Use Prisma error codes: `P2002` (unique) → 409, `P2025` (not found) → 404.
- Worker: every cron callback is wrapped by `withJobLock`. **No exception may escape.** A failing
  source records a FAILED `SourceRun` and updates `Source.health`. It never throws past `runSource`.
- **Loud failure, always:** anything that fails silently (zero rows, skipped extraction, blocked URL)
  must leave a visible record: `SourceRun`, `Extraction.state/error`, `LinkSubmission.status/error`,
  or an ops alert. `catch {}` with nothing inside is forbidden.

## 7. Honest data (enforced in code, not just UI)

- Never write `0` to represent unknown. Unknown = `null`, `[]`, `UNKNOWN` or `NOT_DISCLOSED`.
- `deadlineStated` is set **only** from an explicit source field (ATS field, JSON-LD `validThrough`,
  or a model output where `deadline` confidence ≥ 0.6 **and** the admin approves). There are no
  estimated deadlines and no countdown UI.
- The UI renders unknowns explicitly: "Undisclosed", "Eligibility not stated", "Location not stated".
- The freshness line uses only `firstSeenAt` and `lastSeenLiveAt`.
- **Nothing is auto-published.** Only the admin approve endpoints (and admin manual create with
  `publish:true`) may set `status = LIVE`. The worker must never set LIVE, except when re-activating
  an already-approved (`publishedAt != null`) posting that it sees live again.

## 8. LLM (cost cascade, pluggable provider)

- **Never call the model when a cheaper tier can answer:** ATS structured data -> JSON-LD -> deterministic
  parsers -> `LLM_FAST` -> `LLM_STRONG` (only if a strong model is configured and confidence is low).
- **Default provider is local Ollama with `qwen2.5:7b`. Gemini is the later drop-in.** Switch only via
  `LLM_PROVIDER`. All vendor-specific code lives in `services/careers/extract/providers/*` and `callModel.js`;
  no other file may import an LLM SDK, mention a vendor, or call a model URL.
- Model calls only in `services/careers/extract/*`, only from the worker, only when `careers.llmEnabled` is
  true and `budget.canCall()` is true. Calls are sequential. Back off on failures (Architecture 8.1).
- Ollama: plain global `fetch` to `OLLAMA_URL` (`/api/chat`, `format` = JSON schema, `temperature: 0`). No
  npm package. Gemini: `@google/genai` only (install it at P1-T10b), never raw REST, never `gemini-2.0-*`,
  `gemini-2.5-*` or `gemini-flash-latest`.
- Model IDs come from env (`CAREERS_LLM_FAST_MODEL`, `CAREERS_LLM_STRONG_MODEL`), never hard-coded in logic.
- **Never trust model output.** Everything goes through `verify.js` (grounding against the source text,
  deterministic overrides, computed confidence, local-model confidence cap 0.7). Compensation numbers come
  only from `parseCompensation`. Check `finishReason` before parsing and validate with zod.
- Record every call in `LlmUsage` (tokens always; cost only for a paid Gemini key).
- `GEMINI_API_KEY` (when used) is server-side only in `server-acc/.env`. **Never** as `VITE_GEMINI_API_KEY` or
  any `VITE_*`, never sent to the client, never logged, never committed. Don't touch the upstream
  `client-acc/src/lib/askGemini.js`.
- **Data sent to any model = public job-page text only.** Never the student's note, name, email, roll
  number, CPI, resume or other user data.
- Tests mock `fetch`/the SDK. **Never make real Gemini calls in tests.** Real Ollama calls in dev are fine
  (free, local): use them for the P1-T10 smoke test and to tune the prompt, but keep them out of unit tests.
- Before writing `providers/gemini.js`, check the SDK docs via context7 (`/googleapis/js-genai`).

## 9. Security

- `safeFetch` is the **only** way to fetch a user-supplied URL. Never call `fetch(userUrl)` directly.
  SSRF rules are in Architecture.md §7a and are mandatory.
- Never fetch blocked domains (store-only list).
- Every admin route uses `checkAuth` + `requireCareerAdmin`. Every student route uses `checkAuth`
  (+ `requireCareersEnabled` where specified). Never trust role or user id from the request body.
- A student's CPI is returned only by `/careers/me/*` and the existing `/auth/me`. It never appears
  in any list, company page, admin page or log.
- The student-submitted `note` and URL are rendered as text, never as HTML. Experience descriptions
  are rendered the same way the existing Career Vault renders them. Do not introduce a new
  `dangerouslySetInnerHTML` path for any other data.
- Rate-limit student submissions (`careers.submissionDailyLimit`).
- Scrapers: identify with the User-Agent in Architecture.md, run sources sequentially, and never
  crawl links discovered on pages.

## 10. Code style

- Match the surrounding code: 2- or 4-space indent as in the neighbouring files, ESM imports with
  `.js` extensions, `async/await`, named exports for services, default export for routers.
- Pure logic (parsing, matching, dedup, health, eligibility, query building) lives in functions with
  **no DB or network access**, so it's unit-testable. The DB/network wrappers are thin.
- Small files (< ~300 lines), one responsibility each. Put magic numbers in `settings.js` defaults
  or named constants.
- Comments explain **why**, not what. No commented-out code.
- The frontend follows `Design.md`. No inline hex colours except the tokens listed there.

## 11. Testing and verification

- Write the unit tests for a pure module **in the same task** as the module. Test first when practical.
- Before claiming a task is done: `cd server-acc && npm test` (all pass), and for client tasks
  `cd client-acc && npm run build` must pass, and **lint the files you created or changed** (`npx eslint <those paths>`) with **0 errors**. Do not use `npm run lint` as the gate: upstream already has 1,115 errors (1,078 in vendored `public/` files, 36 in `src/`, 1 in `vite.config.js`). Also check `npx eslint src` never exceeds the baseline of **36** errors. Paste the **actual** summary lines into Memory.md.
  "Should work" is not verification.
- If something can't be verified locally (e.g. a real ATS call is blocked), say so explicitly in
  Memory.md. Don't claim it works.

## 12. Never do

- Invent APIs, endpoints, response fields or library functions. Verify them (fixtures, or docs via context7 / official pages).
- Silently expand scope. Stretch features (resume matching, notifications, discussion, OA guides,
  question bank, Workday, Playwright) are **out of scope** unless the tracker says the committed phases are done and the user asks.
- Delete or overwrite the user's files or the planning docs (except updating `planning/Memory.md`,
  `planning/implementation_tracker.md` and `planning/change_specsheet.md`, and appending to
  `planning/upstream_vulnerabilities.md`).
- Leave `console.log` debugging noise in committed code (a `console.error` / `console.info` with a
  `[careers]` prefix is fine).
- Mark a task done when its checks fail. Record the failure in Memory.md instead.
