# ACC Portal — Automated Job & Internship Fetcher
## Working notes for the proposal (Project 2, Career Vault)

---

## How to use this document

This is **not** the proposal. It is the material the proposal is written from.

It contains the design decisions, the reasoning behind each one, the numbers,
and the things deliberately rejected.


The three required headings from the PS are Sections 2, 3 and 4 below.
Sections 1, 5, 6 and 7 are supporting material that makes those three
credible.

---

## Section 1 — Design principles (context for everything else)

These four principles are referenced throughout. State them once, early, in
the proposal, then stop repeating them.

### 1.1 Cost cascade

Every expensive operation is preceded by a cheaper one that removes most of
the work.

The ordering used throughout this project:

1. **Structured APIs** — free, reliable, already in machine-readable form.
2. **Deterministic logic** — free. String normalisation, set arithmetic,
   fingerprint comparison. No model involved.
3. **Claude Haiku** — cheap. Used only on content the first two tiers could
   not handle.
4. **Claude Sonnet** — expensive. Used only when Haiku returns low confidence.

The failure mode this exists to prevent: the naive version of this project
sends every fetched page to a language model, and becomes too expensive for a
student council to keep running. That is worth saying explicitly in the
proposal, because naming the failure you are avoiding is what turns an
architecture into a decision rather than a buzzword.

### 1.2 Loud failure

A broken data pipeline usually does not crash. It returns zero rows, quietly,
and the interface simply looks empty. Nobody notices for a week.

Every automated component in this system therefore reports its own health, and
anomalies surface in the admin panel rather than in a log file nobody opens.

### 1.3 Additive integration

The ACC Portal is a live system with real users. Every database change is
additive. Nothing existing is restructured, renamed, or dropped.

*Migration* = a scripted change to database structure. A destructive migration
rewrites or removes existing columns, which is how a working system gets broken
permanently.

### 1.4 Honest data

Where a value is unknown, the system says it is unknown. It does not
substitute a default that looks like a real value.

This applies specifically to undisclosed stipends and to unknown application
deadlines, both handled in detail below.

---

## Section 2 — INTEGRATION PLAN

*(Required heading 1)*

The core claim of this section: **this project does not add a fourth silo to
the ACC Portal. It connects an existing one to new data.**

Career Vault already holds internship and interview experiences contributed by
students and alumni. Those experiences are about companies. Job postings are
also about companies. Until now there has been nothing joining the two.

### 2.1 Placement inside the portal

The fetcher ships as an extension of the existing Career Vault section, not as
a separate application linked out to.

- Same authentication, same session, same navigation shell.
- Same visual language and component library as the rest of the portal.
- Two faces, matching the portal-wide pattern described in the PS:
  a **public browsing interface** for students, and an **admin review
  interface** for the limited set of student administrators.

No new account system. No second login. Roles come from the portal's existing
role model — students see browsing, admins additionally see the review queue
and source health.

### 2.2 The company registry — the actual join point

This is the load-bearing piece of the integration, and the single most
important design decision in the project.

**The problem.** The same organisation appears in text under many names:
"Google", "Google India", "Google LLC", "google". An experience post says one
thing; a fetched posting says another. Without resolution, the two never meet.

**The solution.** A canonical company table. One row per real organisation,
with an alias list attached. Every posting and every experience references a
company by ID, never by raw string.

**Resolution pipeline**, in cost-cascade order:

1. Exact match against known aliases — free.
2. Normalised match (lowercase, strip legal suffixes such as Ltd / Inc / Pvt,
   collapse whitespace) — free.
3. Fuzzy string similarity above a threshold — free.
4. Unresolved names go to an admin queue as *candidate companies*.

**Admin merge and split interface.** Automatic matching will get things wrong.
Two companies will be merged that should not be; one company will be split
across two records. There must be a visible, reversible correction path in the
admin panel.

This point is worth stating plainly in the proposal. Any system that resolves
messy names automatically is wrong some of the time, and the difference between
a good design and a bad one is whether the wrongness is correctable or silently
baked in.

**What the registry unlocks:**

- A posting page can show past experiences for that company.
- An experience page can show current openings at that company.
- Company pages become possible at all (Section 4.1).
- Deduplication across sources becomes reliable (Section 3.4).

### 2.3 Database changes

All additive. New tables only:

- `companies` — canonical record.
- `company_aliases` — many aliases to one company.
- `postings` — normalised job/internship records.
- `posting_observations` — first seen, last seen, per source (Section 3.7).
- `sources` — registry of ingestion sources and their health.
- `extraction_reviews` — admin review queue state and confidence scores.

Existing experience tables gain, at most, a nullable `company_id` foreign key
so they can participate in the registry. Existing columns are not altered or
removed. Backfilling company IDs onto historic experiences is a one-time,
reversible, admin-supervised operation.

### 2.4 Rollout safety

**Feature flag.** The new Career Vault section is controlled by an on/off
switch that an admin can flip without a redeploy. If the fetcher misbehaves in
front of real users, it goes dark immediately rather than requiring an
emergency fix.

**Read-only first.** Ingestion can run and populate the review queue before
anything is visible to students at all. The system can be validated against
real data with zero public exposure.

**Nothing auto-publishes.** Every fetched posting passes through admin review
before students see it (Section 3.5). The blast radius of a bad extraction is
an admin's time, not a student's trust.

### 2.5 Operational integration

The admin panel gains a small operations view, because a system that runs
unattended overnight needs somewhere to report on itself:

- Last successful run per source, and count of postings returned.
- Sources currently failing or returning zero.
- Size of the review queue and count of low-confidence items.
- Extraction spend, so cost is observable rather than discovered on a bill.

---

## Section 3 — ENHANCEMENTS TO LISTED FEATURES

*(Required heading 3 — placed before Additional Features here because these
justify the architecture that Additional Features then reuses)*

The PS listed four things: automated fetching across domains, integration into
Career Vault, a student-facing interface, and a management system. Everything
in this section is one of those four done better than the obvious version.

### 3.1 Four-tier cost cascade for ingestion

Applied concretely to fetching:

- **Tier 1 — ATS APIs.** Greenhouse, Lever, Ashby and Workday expose public,
  structured job board endpoints. A company using Greenhouse publishes its
  entire board as JSON at a predictable URL. This is free, stable, and already
  structured — no extraction needed at all. Target: the majority of volume.
- **Tier 2 — deterministic processing.** Normalisation, deduplication,
  keyword filtering, obvious-junk rejection. Free.
- **Tier 3 — Haiku extraction.** Only for unstructured sources that survived
  tiers 1 and 2. Turns free text into the normalised posting schema.
- **Tier 4 — Sonnet escalation.** Only where Haiku reports low confidence.

Processing runs overnight through the Batch API rather than synchronously,
because nothing about this workload is time-critical to the minute.

### 3.2 Scheduled fetching over an allowlist — not open web crawling

**This is a deliberate rejection, and it belongs in the proposal as one.**

A *crawler* discovers unknown pages by following links outward. That is the
wrong tool here, for two concrete reasons:

**It inverts the cost cascade.** A crawler pointed at the open web returns
thousands of pages a day, most of which are not job postings. Determining
whether each page is a posting is exactly the expensive tier. So the crawler's
practical effect is to maximise language-model work — the opposite of what a
cost cascade exists to do.

**Its failures are undiagnosable in this context.** Scraped sites change their
HTML without notice. When that happens the parser does not error; it returns
nothing. Diagnosing that requires reading page structure and comparing it
against parser logic, which is the highest back-and-forth-cost activity
available in this project.

**What replaces it:** a scheduled fetcher over a fixed allowlist. Same
libraries (Crawlee, Playwright), entirely different posture — pulling from a
known list of endpoints on a timer, with one adapter per source, rather than
exploring.

### 3.3 Ingestion tiers including human input

Sources, listed in cost order:

1. **ATS job board APIs** — structured, free, stable.
2. **RSS / JSON feeds** where a source publishes one.
3. **Scheduled career-page fetchers** on an allowlist, one adapter each.
4. **Admin manual entry** — cheapest and highest-quality source in the system.
5. **Student-submitted links** — a student pastes a URL, it enters the same
   review queue as everything automated.

Points 4 and 5 are not a fallback for when automation fails. They are a tier.
Automated coverage of the job market is never complete, and a design that
pretends otherwise is a design that will silently miss opportunities.

Student submission additionally turns the user base into a distributed
discovery network at zero infrastructure cost.

### 3.4 Deterministic deduplication

The same role appears on a company career page, an aggregator, and an ATS
feed. Students should see it once.

Matching signal, all computed without a model:

- Canonical company ID (from Section 2.2) — not the raw company string.
- Normalised role title (lowercase, strip seniority noise and punctuation).
- Normalised location.
- A **content fingerprint** of the description — the text reduced to a compact
  signature so that near-identical descriptions collide even when formatting,
  whitespace or boilerplate differs.

Duplicates are merged into one posting record that retains **all** source
links, so a student can see the posting exists on three sites and pick where to
apply.

This is tier 2 of the cascade doing real work. No LLM call is needed, and
adding one here would be an architectural regression.

### 3.5 Admin review queue with confidence scoring

Every extracted posting carries a numeric confidence score from the extraction
step.

- Above threshold → queued for routine approval.
- Below threshold → lands in a distinct **flagged** view, with the specific
  fields the extractor was unsure about highlighted.
- Admins approve, edit, or reject. Edits are captured, which gives a record of
  where extraction is systematically weak.

Nothing reaches students unreviewed. This is the concrete implementation of
"loud failure" on the ingestion side: uncertainty becomes visible work rather
than silently wrong data.

### 3.6 Null-safe filtering (student interface)

Filters over role type, skills, location, work mode, stipend and CTC.

**The trap, and the reason this is an enhancement rather than a checkbox:**

Real job descriptions say "competitive", "as per industry standards",
"₹40,000–60,000 per month", or say nothing about pay at all.

If stipend is stored as a single number, every posting without one silently
becomes zero. A student filtering for a minimum stipend then has half the
listings hidden from them and no indication it happened.

**Therefore stipend and CTC are stored as three fields:**

- numeric minimum
- numeric maximum
- **disclosure status** — `disclosed`, `range`, or `not_disclosed`

The filter UI then offers an explicit "include postings with undisclosed
compensation" option, and undisclosed postings display as undisclosed rather
than as zero.

The same treatment applies to any field that is frequently absent: unknown is a
value, not a default.

### 3.7 Honest freshness instead of invented deadlines

Many sources do not publish an application deadline.

**Shipped from day one:** "First seen 6 days ago · confirmed live this
morning." Both statements are observed facts.

**Recorded underneath from day one:** a `posting_observations` log capturing
when each posting was first seen and when it was last seen live, per source.

**Available later, once data accumulates:** typical open-duration estimates per
company or per source — "postings from this company have historically stayed
open around 18 days."

Two things to be honest about in the proposal, because claiming otherwise is
worse than useless:

- This produces **nothing on day one**. It needs months of observation.
- First-seen to last-seen measures a posting's **lifespan**, not its
  **deadline**. Listings often remain up after closing. Any future estimate
  must be labelled as an estimate.

A fabricated countdown is actively harmful — a student trusts it and misses an
application.

---

## Section 4 — ADDITIONAL FEATURES

*(Required heading 2)*

Ordered by strength of justification, not by novelty.

### 4.1 Company pages — postings joined to existing experiences

The strongest item in the proposal, because it is simultaneously an additional
feature and the proof that the integration plan is real.

One page per canonical company, carrying:

- Current open postings.
- Past internship and interview experiences already in Career Vault.
- A discussion thread.
- OA and interview pattern notes (4.5).
- A question bank (4.6).

Individual posting pages then surface a compact panel: "4 past experiences ·
12 discussion replies · OA pattern available", linking through.

**Why company level and not posting level.** The instinct is to attach
discussion to each posting. That fails predictably: 300 postings produce 300
threads with one comment each, and discussion dies for lack of concentration.

There is a second, structural reason. Postings expire. A posting-level thread
takes its content with it when the posting closes, so the same questions get
re-asked every hiring cycle. A company-level page accumulates across cycles and
gets more valuable every year — which is exactly the property you want from the
knowledge assets in 4.5 and 4.6.

### 4.2 Resume match scoring — the cascade applied to a second problem

**The arithmetic that shapes the design:**

500 students × 300 live postings = **150,000 comparisons.**

One language-model call per comparison abandons the cost model entirely. So the
same four-tier logic applies:

- **Tier 1 — deterministic, free.** Skill tokens extracted once from the resume
  on upload, and once from each JD at ingestion. Overlap is set arithmetic.
- **Tier 2 — embeddings, one-time cost.** An *embedding* is a numeric
  representation of a text's meaning, so two texts can be compared by measuring
  the distance between their numbers. The cost is **per document, not per
  pair**: 500 resumes + 300 JDs = 800 operations, against which all 150,000
  comparisons are free arithmetic.
- **Tier 3 — LLM, on demand only.** When a student opens a specific posting
  and asks *why* it is a moderate match, one Haiku call writes the
  explanation.

So: **good / moderate / weak buckets come from the free tiers. Prose comes
from the paid tier, only on request.**

This is the argument to make explicitly in the proposal — the cascade is a
principle being reasoned with, not a paragraph written once and abandoned.

**Personal data handling.** Resumes contain names, phone numbers and
addresses. Explicit consent at upload, clear statement of what is stored and
for how long, and a working delete option. This is not a footnote; it is a
requirement of handling student data on an institute system.

### 4.3 Match-aware notifications

New postings scoring above a student's threshold trigger a notification,
labelled good / moderate / weak.

Because the labels come from the free tiers, notification volume has no
per-message model cost. Digest by default rather than per-posting alerts, so
the feature does not become noise students switch off.

Deadline-proximity alerts hook into the same channel once 3.7 has enough data
to support them.

### 4.4 Application tracking

One click from the posting page: interested → applied → in progress →
rejected / offer.

Kept to one click deliberately. A separate tracking form that students must
remember to fill in is a feature that exists in the codebase and not in
reality.

Aggregate, anonymised tracking data also becomes the honest source for
"how many people from our campus applied here" — unlike 5.2 below, this is
data the portal actually generates itself.

### 4.5 OA and interview pattern guides

Structured summaries at company level: question types, difficulty, round
structure, typical timeline — derived from submitted experiences rather than
invented.

Two ways to populate:

- Admin-curated summaries.
- A structured form attached to experience submission, so future experiences
  arrive already tagged with round type and difficulty rather than as free
  prose that has to be re-read to be useful.

The second is the more valuable change, because it improves the data at the
point of entry.

### 4.6 Question bank

Past OA and interview questions, attached at company level, contributed by
students and admin-reviewed.

Lives on the company page for the same reason as 4.1 — it accumulates across
years, whereas anything attached to a posting dies with the posting.

Contributions must be original recollections. Copying proprietary test content
is not acceptable and should be stated as a submission rule.

### 4.7 Experience-weighted discussion ranking

In company discussions, users with an approved, linked experience post for that
company rank above general commentary.

Cheap to implement — it is a sort key, not a system — and it addresses the real
failure mode of student forums, which is not lack of content but lack of
signal.

---

## Section 5 — Deferred (roadmap)

These are parked deliberately, not omitted. A short future-scope section
showing an idea was evaluated and postponed reads as judgment; silently
dropping it reads as an oversight.

### 5.1 Alumni referral contact

The risk is not technical.

Creating a channel that lets several hundred students message alumni asking for
referrals produces a predictable outcome: alumni get spammed, alumni disengage,
and the council carries the reputational cost. That cost is paid by ACC, not by
the feature.

It also presumes a verified alumni database with recorded consent to be
contacted for this purpose, which is a prerequisite rather than an
implementation detail.

**If it is ever built:** opt-in only, alumni choose to be listed; no open
messaging; a structured, rate-limited referral request; a hard cap per student
per month.

### 5.2 Batch selection statistics

A data-availability problem, not an engineering one.

On-campus and off-campus selection counts typically sit with the placement
cell, and are often confidential. Building an interface for a table that may
never legally be populated is wasted work.

The correct move in the proposal is to raise it as a question that needs
answering before design begins. That is more credible than promising a feature
with no confirmed data source.

Note that 4.4 provides a partial, honest substitute using data the portal
generates itself.

### 5.3 Broader source coverage

Additional ATS providers and additional allowlisted career pages, added
incrementally. Each new source is an adapter plus a health check — deliberately
a small, repeatable unit of work rather than a re-architecture.

---

## Section 6 — Delivery phasing

A proposal listing features without an order invites the question "in what
sequence, and what happens if something slips?" Answer it before it is asked.

**Phase 0 — Foundation**
Company registry with admin merge/split. Normalised posting schema. Source
registry with health checks. Nothing else functions without these.

**Phase 1 — Ingestion**
ATS connectors, deduplication, Haiku extraction, admin review queue with
confidence scoring.

**Phase 2 — Public browsing**
Listing page, null-safe filters, posting detail page, freshness line.

**Phase 3 — Linking layer**
Company pages joining postings to existing Career Vault experiences. This is
the phase that delivers the integration argument.

**Phase 4 — Personalisation**
Resume upload and consent, tiered match scoring, notifications, application
tracking.

**Phase 5 — Community and accumulated intelligence**
Discussion with experience weighting, OA pattern guides, question bank,
deadline estimates once observation data exists.

State clearly which phases are committed core and which are stretch.
Committing to a smaller set and naming the rest as staged is more convincing
than promising thirteen features at once.

---

## Section 7 — Risks and mitigations

Rarely included, disproportionately effective. Four is enough.

**Source breakage.** Fetchers break silently when sites change.
*Mitigation:* per-source health checks, zero-result alerts, and manual /
student-submission tiers that keep the pipeline useful while a source is down.

**Cost overrun.** Extraction cost scales with volume.
*Mitigation:* the cascade, batch processing, and a visible spend figure in the
admin operations view.

**Data availability.** Selection statistics and alumni contact both depend on
data that may not exist or may not be shareable.
*Mitigation:* flagged as open questions, deferred rather than assumed.

**Personal data.** Resumes are personal data on an institute system.
*Mitigation:* explicit consent, stated retention, working deletion.

---

## Appendix A — Posting schema sketch

Field-level detail, useful for the proposal's technical section and for the
first Claude Code prompt.

| Field | Notes |
|---|---|
| `company_id` | FK to canonical company. Never a raw string. |
| `role_title` | Raw. |
| `role_title_normalised` | For dedup. |
| `type` | internship / full-time / PPO |
| `location` | Raw plus normalised. |
| `work_mode` | onsite / hybrid / remote / unknown |
| `skills[]` | Extracted tokens; drives filtering and match tier 1. |
| `stipend_min` | Nullable. |
| `stipend_max` | Nullable. |
| `stipend_disclosure` | disclosed / range / not_disclosed |
| `ctc_min`, `ctc_max`, `ctc_disclosure` | Same pattern. |
| `description_text` | Full text for embeddings and display. |
| `content_fingerprint` | For deduplication. |
| `source_links[]` | All sources this posting was seen on. |
| `first_seen_at` | Set once. |
| `last_seen_live_at` | Updated each run. |
| `status` | pending_review / live / expired / rejected |
| `extraction_confidence` | Numeric; drives the flagged queue. |
| `deadline_stated` | Nullable — only if the source actually published one. |

The disclosure-status columns and the nullable stated deadline are the
schema-level expression of principle 1.4. Honesty about missing data is
enforced by the structure, not left to the interface.

---

## Appendix B — Points that most demonstrate judgment

If the proposal has to be cut for length, these are the last things to remove.
Each is hard to produce without having actually thought about the problem.

- **The 150,000-comparison figure** and the per-document embedding answer.
- **Rejecting open web crawling**, with the cost-inversion and
  undiagnosable-failure reasoning.
- **The company registry as the integration mechanism**, including the
  admission that automatic matching needs an admin correction path.
- **Stipend disclosure status**, and the silent-zero failure it prevents.
- **Refusing to fabricate deadlines**, while still building the observation log
  that makes real estimates possible later.
- **Company-level rather than posting-level** community content, with the
  expiry argument.
- **Deferring alumni referrals** on reputational rather than technical grounds.
