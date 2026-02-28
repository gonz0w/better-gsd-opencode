---
phase: 07-init-command-compaction
plan: 03
subsystem: cli
tags: [compact, manifest, flag-split, output-reduction, gap-closure]

# Dependency graph
requires:
  - phase: 07-init-command-compaction
    provides: "--compact flag with field reduction (Plan 01) and context manifests (Plan 02)"
provides:
  - "--manifest opt-in flag for context manifest inclusion"
  - "--compact alone achieves 46.7% average reduction across all 12 init commands"
  - "Clean separation: field reduction (--compact) vs guidance (--manifest)"
affects: [08-workflow-compression]

# Tech tracking
tech-stack:
  added: []
  patterns: ["global._gsdManifestMode flag for opt-in manifest inclusion"]

key-files:
  created: []
  modified:
    - src/router.js
    - src/commands/init.js
    - src/lib/constants.js
    - bin/gsd-tools.test.cjs

key-decisions:
  - "Split --compact into two flags: --compact (fields only) and --manifest (opt-in guidance) to eliminate manifest overhead from size reduction"
  - "Test ALL 12 commands for average ≥38% reduction, not cherry-picked top-3"

patterns-established:
  - "Opt-in manifest pattern: global._gsdManifestMode gates _manifest inclusion in compact output"

requirements-completed: [CLIP-02, CLIP-03]

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 7 Plan 03: Split --manifest Flag Summary

**Split `--compact` manifest overhead into opt-in `--manifest` flag, achieving 46.7% average reduction across all 12 init commands (up from -39.2% with inline manifests)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T18:49:56Z
- **Completed:** 2026-02-22T18:55:00Z
- **Tasks:** 2
- **Files modified:** 4 (+ built bundle)

## Accomplishments
- All 12 init commands: `--compact` alone returns field-reduced JSON with no manifest overhead (46.7% average reduction)
- `--compact --manifest` returns fields + `_manifest.files` guidance (opt-in, bigger but provides context loading hints)
- Fixed the verification gap: 8/12 commands previously had LARGER compact output due to _manifest overhead; now all 12/12 have positive reduction
- Tests rewritten to assert ≥38% average across ALL 12 commands (not cherry-picked top-3)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add --manifest flag and gate manifest inclusion** - `444a693` (feat)
2. **Task 2: Update tests for split flag behavior** - `a3fe346` (test)

## Files Created/Modified
- `src/router.js` - Added `--manifest` global flag parsing (mirrors `--compact` pattern, sets `global._gsdManifestMode`)
- `src/commands/init.js` - Wrapped `_manifest` assignment in all 12 compact code paths with `if (global._gsdManifestMode)` conditional
- `src/lib/constants.js` - Updated help text: `--compact` now says "Return essential-only fields", added `--manifest` flag documentation
- `bin/gsd-tools.test.cjs` - Rewrote size reduction test (all 12 commands avg), updated 4 manifest tests to use `--manifest` flag, added 2 new tests (compact-only excludes manifest, manifest flag includes manifest for all)

## Decisions Made
- **Split flags over size optimization:** Rather than making manifests more compact (shorter paths, abbreviations), split them into an opt-in flag. This preserves the full manifest value while eliminating the overhead from the default `--compact` path.
- **Test all 12 commands:** Instead of cherry-picking model-heavy commands (new-milestone, resume, quick) that naturally exceed 38%, test the average across all 12 commands to ensure honest measurement.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 fully complete — all 3 plans executed successfully
- `--compact` achieves 46.7% average reduction (exceeds 38% target)
- `--manifest` provides opt-in context guidance when agents need loading hints
- Ready for Phase 8: Workflow Compression

## Self-Check: PASSED

- `src/router.js` exists: ✓
- `src/commands/init.js` exists: ✓
- `src/lib/constants.js` exists: ✓
- `bin/gsd-tools.test.cjs` exists: ✓
- Commit `444a693` exists: ✓
- Commit `a3fe346` exists: ✓

---
*Phase: 07-init-command-compaction*
*Completed: 2026-02-22*
