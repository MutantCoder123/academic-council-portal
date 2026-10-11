# Verify later: things built but not fully checked

> Features that are built, unit-tested and partly checked, but whose last step could not be checked
> locally. Each item says why it is open, how to check it, and what counts as passing.
> When an item is checked, set its Status to ✅ with the date and the result, and add a line to the
> Memory.md session log. If a check fails, open a bug in `bugs_and_features.md` and link it here.

| # | What | From | Status |
|---|---|---|---|
| V-01 | Real email delivery (job alerts + review reminders) | P7-T1, P7-T5 | ⬜ Open |
| V-02 | Workable dedup of a kept posting | P7-T7 | ⬜ Open |
| V-03 | SmartRecruiters accepts an unknown company id | P7-T7 | ⬜ Open (known gap) |
| V-04 | Merge postings from the company screen after a company merge | P7-T8 | ⬜ Open |
| V-05 | Season data on postings that existed before P7-T3 | P7-T3 | ⬜ Open |
| V-06 | Live Gemini call (P1-T10b built and mock-tested only) | P1-T10b | ⬜ Open (needs GEMINI_API_KEY) |

---

## V-01: Real email delivery

- **Why open:** there are no mail-server (SMTP) settings locally. Both emails were checked only
  through nodemailer's JSON test transport, which builds the message but sends nothing.
- **Needs:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` in `server-acc/.env` (staging or
  production values; never commit them). Both switches are off by default.
- **How to check:**
  1. Operations → Feature flags: turn on **Job alert emails** and **Review reminder emails**
     (and Careers visible to students). Wait 31 s for the settings cache.
  2. As a student with a real inbox, save a job alert whose filters match at least one published
     posting from the last day (daily) or week (weekly).
  3. `cd server-acc && node scripts/careers/runJob.js alerts`
  4. Leave a posting in the review queue for over 24 h, then run
     `node scripts/careers/runJob.js reminder`.
- **Passes when:**
  - The alert email arrives (not in spam). The subject, posting list and links are correct, and the
    links open the right job pages.
  - The unsubscribe link works without logging in. A second `alerts` run sends nothing for that
    alert. Resubscribing works.
  - The reminder email reaches career admins only (role CAREER_ADMIN), at most once a day.
  - With wrong SMTP settings, Operations shows `ALERT_EMAILS_FAILING` /
    `REVIEW_REMINDER_FAILING`, and the student sees only "the last email failed", never the
    server error text.

## V-02: Workable dedup of a kept posting

- **Why open:** the only Workable board tried had no early-career roles, so nothing was kept and
  there was nothing to dedup. Pagination and the description fetch were checked; dedup was not.
- **How to check:**
  1. Find a Workable board (`apply.workable.com/<token>`) that has intern / graduate / junior roles.
  2. Sources → Add source → Workable, with that token. Run "Fetch now" (or
     `node scripts/careers/runJob.js ingest <sourceId>`).
  3. Run it a second time.
- **Passes when:** the first run keeps at least one posting (it appears in the review queue). The
  second run shows those as `seen`, with `new = 0`, and no duplicate postings exist for the same job.

## V-03: SmartRecruiters accepts an unknown company id

- **Why open:** SmartRecruiters returns an empty job list (not an error) for a company id that does
  not exist. The board check therefore accepts a typo with "0 jobs now".
- **How to check:** Sources → Add source → SmartRecruiters with a made-up id (e.g. `NoSuchCompany123`).
- **Today's result:** accepted with "0 jobs now". Not a crash, but an admin can save a dead source.
- **Possible fix (needs a decision):** warn on "0 jobs" for SmartRecruiters ("check the company id;
  it may be wrong or the board may be empty") instead of a plain success. Health tracking already
  marks a source that never returns jobs.
- **Passes when:** a fix is chosen and checked, or the user accepts the current behaviour.

## V-04: Merge postings from the company screen

- **Why open:** after a company merge, the company `MergeDialog` lists duplicate posting pairs, each
  with a "Merge" button that opens `MergePostingsDialog`. The API and the All-postings route were
  checked in the browser; this entry point was not.
- **How to check:**
  1. Find (or make) two companies that both have a posting for the same role, e.g. "X India" and
     "X", each with an "SDE Intern" posting.
  2. Companies → merge "X India" into "X". The dialog should list the pair.
  3. Click "Merge" on the pair, check the preview, confirm.
  4. Undo the company merge afterwards if it was only a test.
- **Passes when:** the pair is listed. The preview matches what All postings → "Merge into…" shows
  for the same two postings. After merging, saves and statuses are on the kept posting, the other
  shows "Duplicate of #N", and the activity log has the entries. Works at 375 px.

## V-05: Season data on older postings

- **Why open:** season, start month and duration are filled when a posting is built. Internships
  that existed before P7-T3 have them empty, so the season filter and chip skip them.
- **How to check:**
  1. Count internships without a season:
     `SELECT count(*) FROM "Posting" WHERE type = 'INTERNSHIP' AND season IS NULL;`
  2. Run an ingest (`node scripts/careers/runJob.js ingest`) and count again.
- **Passes when:** either the count drops for ATS postings that mention a season (an ingest
  refreshes them), or a one-off backfill is decided on. A backfill would run `parseSeason` over the
  stored title and description and fill only empty columns, never overwriting an admin's edit.
  Manual and student-link postings without season words stay empty, which is correct.

## V-06: Live Gemini call

- **Why open:** there is no `GEMINI_API_KEY`. `providers/gemini.js` is unit-tested against mocked
  responses and the switch is checked (`LLM_PROVIDER=gemini` → "GEMINI_API_KEY is not set"); no real
  request has been sent. The demo (P4-T2) runs on Groq by the user's choice.
- **How to check:**
  1. In `server-acc/.env`: `GEMINI_API_KEY=<key>`, `LLM_PROVIDER=gemini`,
     `CAREERS_LLM_FAST_MODEL=gemini-3.1-flash-lite`. Restart the API.
  2. Operations → AI extraction shows provider gemini, usable.
  3. Retry two student links (or share a non-ATS job page) and run
     `node scripts/careers/runJob.js links`.
- **Passes when:** the calls succeed (Gemini accepts `responseJsonSchema` with nullable
  `["string","null"]` types; if it does not, switch to `anyOf` per Architecture §8.1), the postings
  land in the review queue, `LlmUsage` rows say provider gemini with cost 0 on the free tier, and
  switching `LLM_PROVIDER` back to groq or ollama still works.
