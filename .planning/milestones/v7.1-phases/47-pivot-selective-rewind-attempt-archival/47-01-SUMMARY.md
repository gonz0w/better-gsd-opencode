---
phase: 47-pivot-selective-rewind-attempt-archival
plan: 01
subsystem: cli
tags: [trajectory, pivot, rewind, git, checkpoint, archival]

# Dependency graph
requires:
  - phase: 46-checkpoint-snapshot-metrics-collection
    provides: trajectory checkpoint command, journal store, selectiveRewind
provides:
  - trajectory pivot command with reason capture, auto-checkpoint, selective rewind
  - archived branch creation for abandoned attempts
  - TTY-formatted pivot output
affects: [47-02, 48-compare, 49-choose, 50-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [archived branch namespace, abandoned checkpoint tagging, reason capture via --reason flag]

key-files:
  created: []
  modified:
    - src/commands/trajectory.js
    - src/router.js
    - src/lib/constants.js
    - bin/gsd-tools.cjs

key-decisions:
  - "Reason capture via --reason flag (not interactive prompts) since gsd-tools is invoked via execFileSync"
  - "Abandoned branches use archived/trajectory/<scope>/<name>/attempt-N namespace"
  - "Reuse selectiveRewind() from lib/git for code rewind — no reimplementation"

patterns-established:
  - "Archived branch namespace: archived/trajectory/<scope>/<name>/attempt-N"
  - "Abandoned journal entries tagged with ['checkpoint', 'abandoned'] for filtering"

requirements-completed: [PIVOT-01, PIVOT-02, PIVOT-03]

# Metrics
duration: 7min
completed: 2026-03-01
---

# Phase 47 Plan 01: Pivot Command Implementation Summary

**Trajectory pivot command with dirty-tree guard, reason capture, auto-checkpoint as abandoned attempt, and selective rewind via selectiveRewind()**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-01T02:07:08Z
- **Completed:** 2026-03-01T02:14:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Full `trajectory pivot <checkpoint>` command with --reason, --scope, --attempt, --stash flags
- Dirty working tree detection with auto-stash option and clear error guidance
- Auto-checkpoint of current work as abandoned attempt with archived branch before rewind
- Structured reason persisted in journal entry for abandoned checkpoint
- Router routing and comprehensive help text with examples

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement trajectory pivot command** - `467f3f1` (feat)
2. **Task 2: Add router case and help text** - `c9356e7` (feat)

## Files Created/Modified
- `src/commands/trajectory.js` - Added cmdTrajectoryPivot() with full pivot workflow and formatPivotResult TTY formatter
- `src/router.js` - Added 'pivot' case to trajectory switch block
- `src/lib/constants.js` - Added pivot subcommand to trajectory help, added 'trajectory pivot' compound help key
- `bin/gsd-tools.cjs` - Rebuilt bundle (1029KB / 1050KB budget)

## Decisions Made
- Used `--reason` flag as the sole reason capture mechanism (no interactive prompts) since gsd-tools runs via execFileSync, not interactive TTY
- Abandoned branches go to `archived/trajectory/` namespace (separate from active `trajectory/` branches)
- Reused selectiveRewind() from lib/git directly — no rewrite of checkout logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pivot command complete and routed — ready for stuck-detector integration (47-02)
- All trajectory commands (checkpoint, list, pivot) share consistent patterns
- Journal entries with abandoned tags ready for compare command to filter

---
*Phase: 47-pivot-selective-rewind-attempt-archival*
*Completed: 2026-03-01*
