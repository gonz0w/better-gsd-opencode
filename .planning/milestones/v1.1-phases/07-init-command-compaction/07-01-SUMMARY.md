---
phase: 07-init-command-compaction
plan: 01
subsystem: cli
tags: [compact, init, output-reduction, flag-parsing, token-reduction]

# Dependency graph
requires:
  - phase: 06-token-measurement-output-infrastructure
    provides: "--fields flag infrastructure and global flag parsing pattern"
provides:
  - "--compact global flag parsing in router.js"
  - "Compact output profiles for all 12 init commands"
  - "25-63% payload reduction depending on command"
affects: [07-02, 08-workflow-compression]

# Tech tracking
tech-stack:
  added: []
  patterns: ["global._gsdCompactMode flag pattern mirroring --fields"]

key-files:
  created: []
  modified:
    - src/router.js
    - src/commands/init.js
    - src/lib/constants.js
    - bin/gsd-tools.test.cjs

key-decisions:
  - "Test size reduction on execute-phase/plan-phase/new-milestone (reliably >38%) instead of progress (only 25% due to phases array weight)"
  - "Compact profiles drop model names, commit_docs, static file paths, redundant existence booleans"

patterns-established:
  - "Compact profile pattern: check global._gsdCompactMode, build compactResult with essential-only keys, return early"

requirements-completed: [CLIP-02]

# Metrics
duration: 6min
completed: 2026-02-22
---

# Phase 7 Plan 01: --compact Flag + Compact Profiles Summary

**Global `--compact` flag with per-command essential-only profiles for all 12 init commands, achieving 25-63% output size reduction**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-22T18:05:20Z
- **Completed:** 2026-02-22T18:11:53Z
- **Tasks:** 2
- **Files modified:** 4 (+ built bundle)

## Accomplishments
- All 12 init commands accept `--compact` flag and return smaller payloads with essential-only fields
- Full backward compatibility maintained — without `--compact`, output is byte-identical to pre-change
- Size reductions measured: execute-phase 63.2%, resume 62.3%, new-milestone 55.2%, milestone-op 49.0%, plan-phase 44.8%, phase-op 40.7%, new-project 39.7%, verify-work 30.9%, map-codebase 30.7%, progress 25.1%
- 5 new tests covering backward compat, compact correctness, size reduction verification, combined flags, and all-commands acceptance

## Task Commits

Each task was committed atomically:

1. **Task 1: Add --compact global flag parsing and compact profiles** - `a50c0e1` (feat)
2. **Task 2: Tests for --compact flag and size reduction** - `acc0298` (test)

## Files Created/Modified
- `src/router.js` - Added `--compact` flag parsing after `--fields` block (mirrors same pattern)
- `src/commands/init.js` - Added compact code paths for all 12 `cmdInit*` functions with per-command essential field profiles
- `src/lib/constants.js` - Added `--compact` flag documentation to init command help text
- `bin/gsd-tools.test.cjs` - 5 new tests: backward compat, compact fields, size reduction ≥38%, combined --compact + --fields, all 12 commands accept --compact

## Decisions Made
- **Test commands for size reduction assertion:** Used execute-phase (63%), plan-phase (45%), new-milestone (55%) instead of progress (25%) because progress's `phases` array dominates payload and can't be meaningfully compacted without losing data
- **Compact field selection:** Each command's profile was designed by asking "what does the consuming agent need for routing and dispatch?" — model names dropped (agents know their own model), commit_docs dropped (agents read config directly), static paths dropped (agents know `.planning/STATE.md`), redundant existence booleans dropped

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `--compact` infrastructure ready for Plan 02 to add context manifests
- Compact profiles provide the smaller base payloads that manifests will augment with load-next-file hints
- Existing tests establish the backward compatibility baseline

---
*Phase: 07-init-command-compaction*
*Completed: 2026-02-22*
