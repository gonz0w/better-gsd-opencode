---
phase: 10-state-intelligence
plan: 01
subsystem: infra
tags: [state-validation, drift-detection, auto-fix, state-management]

# Dependency graph
  requires: []
  provides:
    - "cmdStateValidate function"
    - "state validate CLI subcommand"
    - "state validate --fix auto-correction"
  affects:
    - "STATE.md validation"
    - "ROADMAP.md consistency"
tech-stack:
  added: []
  patterns:
    - "Multi-check validation engine with structured issue output"
    - "Auto-fix with git commit for plan count drift"
key-files:
  created:
    - "bin/gsd-tools.test.cjs (11 new tests)"
  modified:
    - "src/commands/state.js"
    - "src/router.js"
    - "src/lib/constants.js"
    - "bin/gsd-tools.cjs"
key-decisions:
  - "Issue structure uses { type, location, expected, actual, severity } — consistent, machine-readable"
  - "Auto-fix only corrects plan count drift, not timestamps or position — those need human judgment"
  - "Blocker staleness uses total completed plan count, not per-blocker git history"

patterns-established:
  - "Multi-check validation engine with structured issue output"
  - "Advisory validation pattern: warn and suggest fixes, never block workflows"

requirements-completed:
  - SVAL-01
  - SVAL-02
  - SVAL-03
  - SVAL-04
  - SVAL-05

# Metrics
  duration: "5m 45s"
  completed: "2026-02-22"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 11
  tests_passing: 213
---

# Phase 10 Plan 01: State Validate Command Summary

state validate command with 5 drift-detection checks and auto-fix for plan count mismatches

## What Was Built

Implemented `cmdStateValidate(cwd, options, raw)` in `src/commands/state.js` with 5 validation checks that detect drift between declared state (ROADMAP.md, STATE.md) and filesystem/git reality:

1. **Plan Count Drift (SVAL-01):** Compares ROADMAP.md `**Plans:**` claims against actual `-PLAN.md` file counts on disk per phase. Reports `plan_count_drift` errors.

2. **Completion Drift (SVAL-01):** Detects when ROADMAP.md checkbox is `[x]` (complete) but disk has fewer summaries than plans. Reports `completion_drift` errors.

3. **Position Validation (SVAL-02):** Validates STATE.md `**Phase:**` field references a real phase directory. Reports `position_missing` (error) or `position_completed` (warn) if the phase is already done.

4. **Activity Staleness (SVAL-03):** Compares STATE.md `**Last Activity:**` timestamp against most recent `.planning/` git commit. Reports `activity_stale` warning when >24 hours out of date.

5. **Blocker/Todo Staleness (SVAL-05):** Flags blockers and pending todos that have persisted through 2+ completed plan executions. Threshold is configurable via `staleness_threshold` in config.json. Reports `stale_blocker` and `stale_todo` warnings.

**Auto-fix (SVAL-04):** `state validate --fix` auto-corrects plan count mismatches in ROADMAP.md and auto-commits each fix with a descriptive message.

**Output format:**
```json
{
  "status": "clean|warnings|errors",
  "issues": [{ "type": "...", "location": "...", "expected": "...", "actual": "...", "severity": "error|warn" }],
  "fixes_applied": [{ "phase": "...", "field": "...", "old": "...", "new": "..." }],
  "summary": "State validation passed — no issues found"
}
```

## Key Implementation Details

- Uses `safeReadFile()` for graceful handling of missing files
- Uses `findPhaseInternal()` for position validation (searches both active and archived phases)
- Uses `execGit()` for activity staleness detection via git log
- Uses `normalizePhaseName()` for matching ROADMAP phase numbers to disk directories
- Reuses phase-parsing patterns from `cmdRoadmapAnalyze()` for ROADMAP parsing
- CLI routing added as `state validate` subcommand before the default `cmdStateLoad` fallback
- Help text added as both `state validate` key and in the `state` subcommand list

## Tests

11 test cases covering all validation scenarios:
1. Clean state returns "clean" status
2. Detects plan count drift
3. Detects completion drift
4. Detects missing position
5. Detects completed position
6. Detects stale activity via git (with temp git repo)
7. --fix auto-corrects plan count drift and commits
8. No false positives when blockers section is empty
9. Detects stale blockers after 2+ completed plans
10. Returns error when both ROADMAP.md and STATE.md are missing
11. Multiple issue types combine correctly in output

## Decisions Made

1. **Issue structure:** `{ type, location, expected, actual, severity }` — consistent, machine-readable per CONTEXT.md design decision
2. **Auto-fix scope:** Only plan count drift — timestamps and position need human judgment
3. **Blocker staleness approach:** Total completed plan count comparison rather than per-blocker git history analysis — simpler, avoids complex git log parsing

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `6d6a4b2` | feat(10-01): implement state validate command with 5 validation checks |
| 2 | `cf07c56` | test(10-01): add state validate test suite with 11 test cases |
