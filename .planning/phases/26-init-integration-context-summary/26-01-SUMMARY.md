---
phase: 26-init-integration-context-summary
plan: 01
subsystem: init, codebase-intel
tags: [codebase-context, conventions, dependencies, staleness, confidence-scores]

# Dependency graph
requires:
  - phase: 24-convention-extraction
    provides: Convention extraction engine with naming patterns and file organization
  - phase: 25-dependency-graph
    provides: Module dependency graph with forward/reverse adjacency lists
provides:
  - Three-field codebase context (stats, conventions, dependencies) in all init outputs
  - Confidence scores per field for agent trust calibration
  - Hybrid staleness detection (commit-based + time-based)
  - getStalenessAge helper for freshness flagging
affects: [26-02, 27-task-scoped-context, 29-workflow-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [three-field context injection, confidence scoring, hybrid staleness detection]

key-files:
  created: []
  modified:
    - src/commands/init.js
    - src/lib/codebase-intel.js
    - src/commands/codebase.js
    - bin/gsd-tools.cjs
    - bin/gsd-tools.test.cjs

key-decisions:
  - "Replaced single codebase_summary with three fields (stats/conventions/dependencies) for granular null handling"
  - "Confidence scores: 1.0 for stats (precise), variable for conventions, 0.85 for dependencies (regex parsing)"
  - "Freshness threshold: >24h or >10 commits behind triggers advisory — normal staleness is silent"
  - "autoTriggerCodebaseIntel preserves conventions/dependencies across re-analysis to prevent data loss"

patterns-established:
  - "Three-field structured context: each field independently nullable with confidence score"
  - "getStalenessAge as reusable helper for age + commits-behind calculation"
  - "Hybrid staleness: git-commit check + 1-hour time fallback for comprehensive freshness"

requirements-completed: [CTXI-01, INFRA-04]

# Metrics
duration: 16min
completed: 2026-02-26
---

# Phase 26 Plan 01: Init Integration & Context Summary

**Three-field codebase context (stats, conventions, dependencies) with confidence scores in all init outputs, plus hybrid commit+time staleness detection**

## Performance

- **Duration:** 16 min
- **Started:** 2026-02-26T15:53:20Z
- **Completed:** 2026-02-26T16:09:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Replaced single `codebase_summary` field with three structured fields (`codebase_stats`, `codebase_conventions`, `codebase_dependencies`) across all four init commands
- Each field includes a confidence score (1.0 stats, variable conventions, 0.85 deps) for agent trust calibration
- Added hybrid staleness: even when git HEAD matches, data >1 hour old is flagged as time_stale
- Added `getStalenessAge()` helper for freshness advisory in init output (>24h or >10 commits behind)

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand formatCodebaseSummary to three-field structure** - `81e45f7` (feat)
2. **Task 2: Add hybrid staleness detection with time-based fallback** - `8368aa7` (feat)

## Files Created/Modified
- `src/commands/init.js` - New `formatCodebaseContext()` function, updated all init commands
- `src/lib/codebase-intel.js` - Time-based staleness check, `getStalenessAge()` helper
- `src/commands/codebase.js` - Fixed `autoTriggerCodebaseIntel` to preserve conventions/dependencies
- `bin/gsd-tools.cjs` - Rebuilt bundle
- `bin/gsd-tools.test.cjs` - Updated tests for new three-field structure

## Decisions Made
- Replaced `formatCodebaseSummary` with `formatCodebaseContext` returning an object with three nullable fields plus freshness advisory
- Confidence scores are per-field: stats always 1.0, conventions averaged from naming + structure, dependencies 0.85 (regex accuracy)
- Freshness uses conservative thresholds (24h/10 commits) to avoid noisy advisories — normal staleness triggers auto-analysis silently
- Added typeof guard for `getStalenessAge` in formatCodebaseContext so the function degrades gracefully when not yet exported

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed autoTriggerCodebaseIntel overwriting conventions/dependencies**
- **Found during:** Task 2 (verifying hybrid staleness)
- **Issue:** When autoTriggerCodebaseIntel re-analyzed stale data, `performAnalysis` returned a fresh intel object without conventions/dependencies keys. These were populated by separate `codebase conventions` and `codebase deps` commands but lost on re-analysis.
- **Fix:** Added preservation of `intel.conventions` and `intel.dependencies` from previous intel when new analysis doesn't include them.
- **Files modified:** src/commands/codebase.js
- **Verification:** After re-analysis, init progress shows all three fields with data
- **Committed in:** 8368aa7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix — without it, conventions and dependencies data would be lost on every auto-trigger re-analysis.

## Issues Encountered
- Bundle runs from built `bin/gsd-tools.cjs`, not source files directly — needed `node build.js` after source changes for CLI verification to work
- Pre-existing test failures (batch grep, bundle size budget) unrelated to this plan's changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Three-field context structure ready for Plan 02 (background analysis, --refresh flag)
- `getStalenessAge` exported and available for any command needing freshness info
- All existing tests pass (pre-existing failures unchanged)

---
*Phase: 26-init-integration-context-summary*
*Completed: 2026-02-26*
