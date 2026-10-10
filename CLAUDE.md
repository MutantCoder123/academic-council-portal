# ACC Portal: Automated Job & Internship Fetcher

You are building the **Job & Internship Fetcher** as an extension of **Career Vault** inside the
live ACC Portal of IIT Patna. The work is additive: this is a feature added to a live system with
real students on it, not a rewrite.

## Folder layout (paths relative to `ACC Open Project/`)

```
ACC Open Project/
├── CLAUDE.md                  ← one line: imports planning/CLAUDE.md (this file)
├── planning/                  ← git worktree of the fork, branch `planning-docs` (docs only)
├── academic-council-portal/   ← git worktree of the fork, branch `feat/jobs-fetcher` (code only)
├── acc_fetcher_proposal_notes.md
└── ACC_Job_Internship_Fetcher_Proposal (2).pdf
```

Both folders belong to the same repo (fork `MutantCoder123/academic-council-portal`), on two
different branches. `planning-docs` is an orphan branch that shares no history with the code.

## Read before every session, in this order

1. `planning/Memory.md`: where the last session stopped. **Read this first.**
2. `planning/implementation_tracker.md`: which task is next.
3. `planning/AI_Rules.md`: hard rules. Non-negotiable.
4. The section of `planning/Phases.md` for the current task.
5. `planning/Architecture.md` and `planning/Design.md`: only the sections the task touches.
6. `planning/PRD.md`: only when a requirement is unclear.
7. `planning/bugs_and_features.md` (feature backlog, F-xx) and `planning/decisions_to_review.md` (decisions the user accepted, D-xx) for P5 onwards.

Do not re-read the whole codebase. Memory.md and Architecture.md tell you where things are.

## After every task

1. Run the task's "Done when" checks and paste the actual results into Memory.md.
2. Tick the task in `implementation_tracker.md`.
3. If you deviated from the plan, add an entry to `planning/change_specsheet.md` (what + why).
4. Update `planning/Memory.md` (state, decisions, gotchas, next step).
5. Commit the **code** in `academic-council-portal/` (branch `feat/jobs-fetcher`).
6. Commit the **docs** in `planning/` (branch `planning-docs`): `git -C planning add -A && git -C planning commit`.
7. Push both when the user asks: `git -C academic-council-portal push origin feat/jobs-fetcher` and
   `git -C planning push origin planning-docs`.

## Keep the two branches separate

- Planning docs go **only** on `planning-docs`. Never copy them into `academic-council-portal/`, and
  never merge `planning-docs` into `feat/jobs-fetcher`. The code branch becomes the upstream PR and
  must contain code only.
- The fork is **public**, so the planning branch is visible to anyone.
- **`planning/upstream_vulnerabilities.md` stays local only.** It is gitignored on `planning-docs`.
  Never commit it, never paste its content into any committed file, PR, issue or commit message.
  Before each planning commit, check that `git -C planning status --short` does not list it.
- Never commit secrets from either folder (`.env` values, passwords, keys).
