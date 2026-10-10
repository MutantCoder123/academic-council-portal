# Design: visual system for the Jobs & Companies pages

> **Important:** the repo contains a `design.md` describing a **dark theme with an orange accent**.
> That is **not** what the dashboard uses. Career Vault lives inside `DashboardLayout`, which is a
> **light "academic" theme** (slate/navy + blue), defined in `client-acc/src/global.css`. New pages
> must look like the existing Career Vault page, so **follow this file, not the upstream `design.md`**.
> (Don't edit the upstream file.)

---

## 1. Colour tokens (already defined in `global.css`; use via `var(...)`)

| Token | Value | Use |
|---|---|---|
| `--color-canvas` | `#F8FAFC` | Page background (the layout already sets it) |
| `--color-primary` | `#0F172A` | Headings, primary text, primary buttons |
| `--color-primary-accent` | `#1E3A8A` | Primary button hover |
| `--color-secondary` | `#2563EB` | Accent: accent bar, links, focus ring, active chips |
| `--color-secondary-light` | `#EFF6FF` | Accent backgrounds |
| `--color-secondary-glow` | `rgba(37,99,235,.08)` | CTA shadow |
| `--border-subtle` / `--border-strong` | `#E2E8F0` / `#CBD5E1` | Card borders / hover borders |

Tailwind aliases also exist: `text-acc-primary`, `bg-acc-secondary`, etc. Neutrals use Tailwind `slate-*`.

**Semantic status colours** (Tailwind palette, same pattern as the sidebar icon chips `text-X-600 bg-X-50 border-X-100`):

| Meaning | Colour | Where |
|---|---|---|
| Live / OK / Good | `emerald` | LIVE chip, health OK, "confirmed live today" |
| Uncertain / Stale / Flagged / Amber alert | `amber` | Flagged tab, uncertain field highlight, "last confirmed 5 days ago", ZERO_RESULTS |
| Failed / Rejected / Red alert | `rose` | FAILING source, rejected, budget reached, worker stale |
| Unknown / Undisclosed / Not stated | `slate` (italic text) | "Undisclosed", "Eligibility not stated", UNKNOWN work mode |
| Info / Candidate / Pending | `blue` | Pending review, candidate company, info banners |
| Company / linking | `teal` | "N past experiences", "N open roles" chips (Career Vault already uses teal for itself in the sidebar) |

Never use colour alone. Every status chip has a text label, and where it helps, a lucide icon.

## 2. Typography

- Body font: **Plus Jakarta Sans** (global default). Numbers and tables can use `font-inter` for tabular alignment.
- Page title: `text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--color-primary)]`
- Section / card title: `text-base md:text-lg font-bold text-[var(--color-primary)]`
- Body: `text-sm text-slate-600 leading-relaxed`
- Meta / helper: `text-xs text-slate-500`
- Label (form groups, card section headers): `text-[10px] font-bold uppercase tracking-wider text-slate-500`
- Field label: `text-xs font-semibold text-slate-600`

## 3. Signature elements (copy these exactly from Career Vault)

**Page header with accent bar**
```jsx
<div className="flex items-center gap-3 mb-2">
  <div className="w-[3px] h-6 bg-[var(--color-secondary)] rounded-full shadow-[0_0_8px_var(--color-secondary)]" />
  <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--color-primary)] tracking-tight">Jobs & Internships</h1>
</div>
<p className="text-slate-500 text-sm ml-4">Approved openings, linked to what seniors wrote about each company.</p>
```

**Card**: `p-5 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-xs`
Hover (clickable cards): `hover:border-[var(--color-secondary)]/40 transition-all duration-300`

**Primary button**: `px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-accent)] transition-colors disabled:opacity-50 cursor-pointer`
**Accent CTA**: `bg-[var(--color-secondary)] hover:opacity-90 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-[0_8px_20px_var(--color-secondary-glow)]`
**Outline button**: the existing `.academic-btn-outline` utility.
**Danger** (reject, undo): `text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl px-4 py-2 text-xs font-bold`

**Input / select**: `w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-[var(--color-primary)] placeholder-slate-400 bg-sky-50/50 focus:outline-none focus:border-[var(--color-secondary)] transition`
**Search bar**: same as the Career Vault search (rounded-2xl, left icon, `focus:ring-1 focus:ring-[var(--color-secondary)]`).
**react-select**: style it through `classNames` to match the input above (rounded-xl, slate-200 border, blue focus).

**Chip**: `inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider` + the semantic colour set.

## 4. Layout

- Content sits inside `DashboardLayout`'s `max-w-7xl` main area. Don't add another page-level container.
- Spacing on the 4/8 scale (`gap-4`, `space-y-6`). Sections separated by `space-y-6`.
- **Jobs page:** header → `CareerVaultTabs` → a two-column grid on `lg` (`lg:grid-cols-[280px_1fr] gap-6`):
  sticky filter sidebar (`lg:sticky lg:top-4 self-start`) + results. Below `lg`, filters open in a
  bottom/side drawer from a "Filters (3)" button.
- **Results:** a single-column list of `JobCard`s (scannable; better than a grid for text-heavy postings), a pagination footer, and a results summary line above the list: *"48 openings · 12 with undisclosed stipend included · 7 hidden by eligibility"*.
- **Detail page:** a two-column layout on `lg` (main description + a right rail with company panel, source links, eligibility, compensation, application status).
- **Admin pages:** full width, tables in cards (`overflow-x-auto`), tabs as pill buttons, a sticky action bar for bulk actions.

## 5. Components (visual rules)

**CareerVaultTabs**: pill tabs `Experiences | Jobs & Internships | Companies | Saved`. The active tab is `bg-white border border-slate-200 shadow-xs text-slate-950 font-bold`; inactive tabs are `text-slate-600 hover:bg-white/80`, matching the sidebar item style.

**JobCard**:
- Row 1: company name (teal link) · type chip · work-mode chip · "New" badge (P4-lite)
- Row 2: role title, `text-base font-bold`
- Row 3 (meta, `text-xs text-slate-500`, separated by `·`): location | compensation badge | eligibility badge
- Row 4: skills (max 5 chips + "+3") and `FreshnessLine` on the right
- Whole card clickable. Save icon button top-right (P4-lite).

**CompensationBadge**:
- RANGE → `₹40,000–60,000 /mo`
- DISCLOSED → `₹50,000 /mo` (CTC: `₹12 LPA`); INR formatting via `Intl.NumberFormat('en-IN')`
- NOT_DISCLOSED → slate italic **"Undisclosed"**. **Never ₹0.**
- UNCLEAR → slate "Pay mentioned: see details" (the detail page shows `compensationRaw` verbatim)
- Non-INR → show the currency as-is (`$5,000 /mo`), no conversion

**EligibilityBadge**:
- No constraints → slate "Eligibility not stated"
- User eligible → emerald "Eligible"
- Not eligible (only visible when the eligible filter is off) → rose "Not eligible: ME only"
- CPI cutoff and the user has no CPI → amber "CPI ≥ 7.0 · add your CPI"

**FreshnessLine** (`text-xs`, `Clock` icon):
- "First seen 6 days ago · confirmed live this morning" (emerald dot when confirmed ≤ 1 day ago, amber dot when > 3 days)
- Manual / link postings: "Added 3 days ago · not auto-checked"
- **No countdowns, no "closing soon".** A stated deadline appears on the detail page only: "Deadline stated by source: 12 Oct 2026".

**EligibilityCard** (jobs page, above the filters): branch and year from the profile (read-only;
"Add your roll number in profile" if missing). CPI input (number, step 0.01, 0–10) with helper
text: *"Optional. Only used to filter postings for you. Never shown to anyone else."* Save/Clear buttons.

**EmptyState**: icon + one-line reason + an action. Always explain *why* it's empty: "No openings
match. 7 are hidden by 'Eligible for me'. [Show all]". For the admin queue: "Queue is clear 🎉" is
**not** allowed; say "No postings waiting for review. Last ingestion: today 02:00, 34 fetched, 0 new."

**Skeletons** for loading (slate-100 pulse blocks shaped like cards). No spinners on full pages.

**Admin: PostingEditor**: two panes on `xl`: left is the source text (monospace `text-xs`,
scrollable, max-h), right is the form. Fields listed in `uncertainFields` get
`ring-2 ring-amber-300 bg-amber-50/50` plus a small amber "Unsure" chip showing the confidence (e.g. 0.42).
A `ConfidenceMeter` bar at the top (rose < 0.6 ≤ amber < 0.8 ≤ emerald). Sticky footer: Reject
(with a reason select) · Save · Approve & publish.

**Admin: HealthBadge**: OK emerald · ZERO_RESULTS amber · FAILING rose (shows `lastError` in a tooltip / expandable) · DISABLED slate · UNKNOWN blue.

**Admin: Operations**: an alerts banner at the top (red first, then amber; each alert links to its
page), then a grid of `StatCard`s (Worker, Sources, Review queue, LLM spend with a progress bar
against the budget, Live postings), then a Feature flags card with toggle switches and a
confirmation dialog for `visibleToStudents`.

**Merge/Split dialogs**: a modal (`fixed inset-0 bg-black/30`, card `max-w-2xl rounded-2xl`), with
a clear before/after summary ("3 aliases, 5 postings, 2 experiences will move from X to Y") and
the primary action button labelled with the verb ("Merge into Google").

**Planned in P5 (`Phases.md`):**
- **Admin: All postings** (P5-T1): same table-in-card layout as the review queue; status chips
  (LIVE emerald · PENDING blue · EXPIRED amber · REJECTED slate); a row menu with Open / Take down.
- **Take-down dialog** (P5-T2): reason list as radio rows, "Other" reveals a text box; the primary
  button names the result ("Mark as closed" for *Closed*, "Take down" otherwise) and says who is
  affected ("2 students saved this").
- **Admin bar on the student job page** (P5-T3): one slim row above the header, `bg-slate-50
  border border-slate-200 rounded-xl text-xs`, status chip + "Approved by … on …" + two small
  outline buttons. Never shown to students.
- **Sidebar count badge** (P5-T6): `min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-secondary)]
  text-white text-[10px] font-bold`, hidden at 0, `aria-label="12 waiting for review"`.
- **"About these openings"** (P5-T7): an info banner (`bg-[var(--color-secondary-light)]` with a
  close button) and a modal panel in plain sentences (Voice §9).
- Student link status "Waiting for an ACC admin" (P5-T5) uses the amber status tone.

## 6. Icons (lucide-react, size 14–16 in chips/meta, 18–20 in headers)

Briefcase (jobs), Building2 (company), MapPin (location), Wallet (compensation), GraduationCap (eligibility), Clock (freshness), Link2 (sources), Bookmark / BookmarkCheck (save), ListChecks (review queue), GitMerge / Split (merge/split), Undo2 (undo), Activity (ops), AlertTriangle (alerts), ShieldAlert (blocked link), Sparkles (**never** used for AI extraction labels; say "Extracted automatically" in words).

## 7. Motion

Subtle only: framer-motion fade/slide 150–250 ms on list items and dialogs, `cubic-bezier(0.16,1,0.3,1)`. Respect `prefers-reduced-motion` (skip animations). No parallax, no animated counters.

## 8. Accessibility and responsiveness

- Every input has a `<label htmlFor>`. Icon-only buttons have `aria-label`.
- Visible focus: `focus-visible:ring-2 focus-visible:ring-[var(--color-secondary)]`.
- Contrast: body text is slate-600 on white or darker. Don't put slate-400 on body text.
- Tables become stacked cards below `md`. Touch targets ≥ 36 px.
- Test at **375 px** and **1280 px**. No horizontal page scroll.

## 9. Voice (UI copy)

Plain, factual, student-friendly. Say what is known and what is not. Prefer "Undisclosed", "Not
stated", "Confirmed live 2 days ago" over marketing words. Don't imply the portal verified the
employer's claims. Label automated data: "Details extracted automatically and reviewed by ACC".
