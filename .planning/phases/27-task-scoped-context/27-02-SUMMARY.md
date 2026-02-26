---
phase: 27-task-scoped-context
plan: 02
subsystem: codebase-intelligence
tags: [context, scoring, token-budget, heuristic, relevance, degradation]

# Dependency graph
requires:
  - phase: 27-task-scoped-context
    provides: cmdCodebaseContext base command with per-file imports, dependents, conventions, risk level
  - phase: 25-dependency-graph
    provides: forward/reverse adjacency lists for graph distance scoring
  - phase: 24-convention-extraction
    provides: conventions data for convention matching
provides:
  - "Heuristic relevance scoring (graph distance 50%, plan scope 30%, git recency 20%)"
  - "5K token budget enforcement with graceful degradation"
  - "--plan flag reads plan frontmatter files_modified for scope signal"
  - "Git recency signal from last 10 commits"
  - "14 integration tests covering scoring, budget, and degradation"
affects: [29-workflow-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [heuristic-relevance-scoring, token-budget-enforcement, graceful-degradation-levels]

key-files:
  created: []
  modified:
    - src/commands/codebase.js
    - bin/gsd-tools.cjs
    - bin/gsd-tools.test.cjs

key-decisions:
  - "Target files always get relevance_score 1.0 (they are what was requested)"
  - "Imports/dependents sorted by relevance score with fan-in/fan-out as tiebreaker"
  - "Degradation applied to ALL files equally per CONTEXT.md atomic rule"
  - "Last resort drops lowest-scored files one by one until budget fits"

patterns-established:
  - "Pure scoring function (scoreRelevance) with three weighted signals"
  - "Budget enforcement as separate pure function for testability"
  - "Graceful degradation: dependents→imports→conventions→file+risk→drop files"

requirements-completed: [CTXI-03, CTXI-04]

# Metrics
duration: 12min
completed: 2026-02-26
---

# Phase 27 Plan 02: Task-Scoped Context - Scoring & Budget Summary

**Heuristic relevance scoring (50/30/20 weights) and 5K token budget enforcement with graceful degradation for `codebase context` command**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-26T17:08:31Z
- **Completed:** 2026-02-26T17:21:18Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented `scoreRelevance()` with three weighted signals: graph distance (50%, 1-hop +0.50, 2-hop +0.25), plan scope (30%), git recency (20%)
- Implemented `enforceTokenBudget()` with 5K hard cap and 4-level graceful degradation plus file dropping as last resort
- Integrated `--plan` flag to read plan frontmatter `files_modified` for scope signal via `getPlanFiles()`
- Added `getRecentlyModifiedFiles()` checking last 10 git commits for recency signal
- 14 new integration tests covering all three requirements (CTXI-02, CTXI-03, CTXI-04) — all pass, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add heuristic scoring and token budget enforcement** - `6634194` + `b5718e2` (feat + chore: source + bundle rebuild)
2. **Task 2: Add test coverage for context command** - `1765423` (test)

## Files Created/Modified
- `src/commands/codebase.js` - Added scoreRelevance, getRecentlyModifiedFiles, getPlanFiles, enforceTokenBudget functions; integrated into cmdCodebaseContext
- `bin/gsd-tools.cjs` - Rebuilt bundle (637KB, within 1000KB budget)
- `bin/gsd-tools.test.cjs` - Added 14 tests in 'codebase context' describe block

## Decisions Made
- Target files themselves always get score 1.0 — they are what was requested, always included
- Imports and dependents sorted by relevance score first, fan-in/fan-out as tiebreaker (per plan specification)
- Degradation applied to ALL files equally before dropping any files (CONTEXT.md atomic rule)
- Last resort: drop lowest-scored files one by one until budget fits
- Exported pure functions (scoreRelevance, enforceTokenBudget, etc.) for testability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 27 complete: both Plan 01 (core command) and Plan 02 (scoring + budget) delivered
- `codebase context` command fully functional with heuristic scoring and 5K token budget
- Ready for Phase 29: workflow integration to wire context into executor agents

---
*Phase: 27-task-scoped-context*
*Completed: 2026-02-26*
