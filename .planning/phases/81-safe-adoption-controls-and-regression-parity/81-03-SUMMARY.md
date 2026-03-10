---
phase: 81-safe-adoption-controls-and-regression-parity
plan: 03
subsystem: testing
tags: [parity-check, testing, validation, discovery, valibot, compile-cache, sqlite]

# Dependency graph
requires:
  - phase: 81-safe-adoption-controls-and-regression-parity
    provides: Phase 81 Plan 01 established optimization flags and settings display
provides:
  - Generalized parity-check utility module (src/lib/utils/parity-check.js)
  - bgsd-tools util:parity-check command for on-demand validation
affects: [phase-77-validation-engine-modernization, phase-78-discovery-optimization, phase-79-compile-cache, phase-80-sqlite-cache]

# Tech tracking
tech-stack:
  added: []
  patterns: [parity-check, diagnoseParity reuse]

key-files:
  created:
    - src/lib/utils/parity-check.js - Generalized parity checking utility
  modified:
    - src/commands/misc.js - Added cmdParityCheck function
    - src/router.js - Added util:parity-check routing
    - bin/bgsd-tools.cjs - Rebuilt CLI with new command

key-decisions:
  - "Used diagnoseParity from discovery.js for discovery optimization parity checks"
  - "Filtered known build artifacts from discovery comparison to avoid false positives"
  - "Used config flag checking for valibot parity since adapter ensures output contract parity"

patterns-established:
  - "Parity check pattern: Capability detection + config flag checking + output contract validation"

requirements-completed: [SAFE-03]
one-liner: "Created generalized parity-check utility and bgsd-tools command to validate dependency-backed optimizations"

# Metrics
duration: 7min
completed: 2026-03-10
---

# Phase 81 Plan 03: Parity Check Utility Summary

**Created generalized parity-check utility and bgsd-tools command to validate dependency-backed optimizations**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-10T04:30:00Z
- **Completed:** 2026-03-10T04:37:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments
- Created src/lib/utils/parity-check.js with checkParity function supporting valibot, discovery, compile_cache, and sqlite_cache optimizations
- Added bgsd-tools util:parity-check command with --optimization, --json, --help flags
- Command returns proper exit codes (0 for match, 1 for mismatch)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create generalized parity-check utility module** - `447c696` (feat)
2. **Task 4: Add bgsd-tools util:parity-check command** - `50f71e8` (feat)

**Plan metadata:** N/A (in progress)

## Files Created/Modified
- `src/lib/utils/parity-check.js` - Generalized parity checking utility with checkParity function
- `src/commands/misc.js` - Added cmdParityCheck function (105 lines)
- `src/router.js` - Added util:parity-check routing
- `bin/bgsd-tools.cjs` - Rebuilt CLI with new command

## Decisions Made
- Used diagnoseParity from discovery.js for discovery optimization parity checks
- Filtered known build artifacts from discovery comparison to avoid false positives (build-output.txt, test-results.txt)
- Used config flag checking for valibot parity since adapter ensures output contract parity

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — gap closure plan / checkpoint plan / review context unavailable

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 81 complete - all 3 plans executed
- Milestone v9.1 ready for completion

---
*Phase: 81-safe-adoption-controls-and-regression-parity*
*Completed: 2026-03-10*
