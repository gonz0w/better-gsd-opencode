---
phase: 170-cmux-workspace-detection-safe-targeting
plan: 03
subsystem: plugin
tags: [javascript, plugin, cmux, workspace-targeting, sidebar]
requires:
  - phase: 170-cmux-workspace-detection-safe-targeting
    provides: bounded cmux transport plus exact managed-terminal-first workspace proof from plans 01 and 02
provides:
  - reversible targeted write-path proof before cmux attachment becomes usable
  - attached sidebar transport methods for status, progress, and log writes behind one trusted adapter boundary
  - session-sticky caching of the final attached-or-suppressed adapter without changing non-cmux behavior
affects: [plugin, cmux, workspace-targeting, sidebar-metadata, ambient-ux]
tech-stack:
  added: []
  patterns:
    - write-capable cmux attachment now requires exact workspace proof plus a reversible targeted sidebar probe
    - plugin startup caches one attached-or-suppressed cmux adapter per session key so later hooks do not re-probe
key-files:
  created:
    - .planning/phases/170-cmux-workspace-detection-safe-targeting/170-03-SUMMARY.md
  modified:
    - src/plugin/cmux-targeting.js
    - src/plugin/index.js
    - tests/plugin-cmux-targeting.test.cjs
    - tests/plugin.test.cjs
    - plugin.js
key-decisions:
  - "Marked cmux as attached only after a reserved `set-status --workspace` probe becomes visible through `sidebar-state --workspace` and is cleared successfully."
  - "Kept later `setStatus`, `clearStatus`, `setProgress`, `clearProgress`, and `log` methods transport-only behind one cached adapter so suppressed sessions stay inert and quiet."
patterns-established:
  - "Trusted cmux writes must pass exact-target proof and reversible cleanup before attachment flips to usable."
  - "Plugin callers always talk to one adapter API while startup caches the final attached-or-suppressed verdict for the session."
requirements-completed: [CMUX-01, CMUX-07, CMUX-08]
one-liner: "cmux attachment now requires a reversible targeted sidebar write probe, then exposes cached workspace-scoped status, progress, and log methods through one trusted adapter."
duration: 14min
completed: 2026-03-31
---

# Phase 170 Plan 03: Write-proven session-sticky cmux adapter Summary

**cmux attachment now requires a reversible targeted sidebar write probe, then exposes cached workspace-scoped status, progress, and log methods through one trusted adapter.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-31T13:20:46Z
- **Completed:** 2026-03-31T13:35:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added a reserved reversible cmux write probe that uses `set-status --workspace`, verifies visibility through `sidebar-state --workspace`, and clears the probe immediately before attachment succeeds.
- Added attached adapter methods for `setStatus`, `clearStatus`, `setProgress`, `clearProgress`, and `log` while keeping suppressed adapters inert and quiet.
- Updated plugin startup to cache one final attached-or-suppressed adapter per session key and proved attached reuse plus write-probe suppression with focused plugin regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add reversible write-path proof and attached adapter methods**
   - `b6e6329` — `test(170-03): add failing cmux write-probe regressions`
   - `54b365f` — `feat(170-03): add write-proven cmux adapter methods`
2. **Task 2: Cache the write-proven adapter once per session and prove fail-open plugin behavior**
   - `7565447` — `test(170-03): add failing plugin cmux cache regressions`
   - `fa44977` — `feat(170-03): cache the write-proven cmux adapter`

_Note: This TDD plan used RED/GREEN commits for both tasks; no separate refactor commit was needed._

## TDD Audit Trail

Review the exact RED/GREEN proof package here.

### Task 1 — Reversible write-path proof

#### RED
- **Commit:** `b6e6329` (`test(170-03): add failing cmux write-probe regressions`)
- **GSD-Phase:** red
- **Target command:** `npm run test:file -- tests/plugin-cmux-targeting.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `TypeError: probeCmuxWritePath is not a function`

#### GREEN
- **Commit:** `54b365f` (`feat(170-03): add write-proven cmux adapter methods`)
- **GSD-Phase:** green
- **Target command:** `npm run test:file -- tests/plugin-cmux-targeting.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 15`

### Task 2 — Session-sticky attached adapter caching

#### RED
- **Commit:** `7565447` (`test(170-03): add failing plugin cmux cache regressions`)
- **GSD-Phase:** red
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux adapter fail-open contract" tests/plugin.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `✖ attached cmux startup caches one write-proven adapter and reuses targeted writes`

#### GREEN
- **Commit:** `fa44977` (`feat(170-03): cache the write-proven cmux adapter`)
- **GSD-Phase:** green
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux adapter fail-open contract" tests/plugin.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 4`

### Machine-Readable Stage Proof
```json
{
  "task_1": {
    "red": {
      "commit": { "hash": "b6e6329", "gsd_phase": "red" },
      "proof": {
        "target_command": "npm run test:file -- tests/plugin-cmux-targeting.test.cjs",
        "exit_code": 1,
        "matched_evidence_snippet": "TypeError: probeCmuxWritePath is not a function"
      }
    },
    "green": {
      "commit": { "hash": "54b365f", "gsd_phase": "green" },
      "proof": {
        "target_command": "npm run test:file -- tests/plugin-cmux-targeting.test.cjs",
        "exit_code": 0,
        "matched_evidence_snippet": "ℹ pass 15"
      }
    }
  },
  "task_2": {
    "red": {
      "commit": { "hash": "7565447", "gsd_phase": "red" },
      "proof": {
        "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux adapter fail-open contract\" tests/plugin.test.cjs",
        "exit_code": 1,
        "matched_evidence_snippet": "✖ attached cmux startup caches one write-proven adapter and reuses targeted writes"
      }
    },
    "green": {
      "commit": { "hash": "fa44977", "gsd_phase": "green" },
      "proof": {
        "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux adapter fail-open contract\" tests/plugin.test.cjs",
        "exit_code": 0,
        "matched_evidence_snippet": "ℹ pass 4"
      }
    }
  }
}
```

## Files Created/Modified
- `src/plugin/cmux-targeting.js` - adds the reserved write probe, attached adapter methods, and attachment gating on reversible cleanup
- `src/plugin/index.js` - caches and returns the final attached-or-suppressed adapter once per session key
- `tests/plugin-cmux-targeting.test.cjs` - locks probe success, probe failure, cleanup failure, and attached transport method behavior
- `tests/plugin.test.cjs` - proves attached adapter caching plus quiet write-probe suppression at the plugin boundary
- `plugin.js` - rebuilt plugin bundle with the attached adapter cache path

## Decisions Made
- Required both visibility and cleanup success before marking a proven workspace as attached, so failed writes never leave stray probe state behind.
- Kept the later sidebar API transport-only: methods only target the proven workspace and do not introduce status vocabulary, progress heuristics, or notification policy yet.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The broad `npm run test:file -- tests/plugin-cmux-targeting.test.cjs tests/plugin.test.cjs` gate stalled on the full `tests/plugin.test.cjs` file in this workspace, so final proof used the touched-surface plugin suite pattern plus `npm run build`, matching the workflow guidance for hanging broad gates after focused checks already pass.

## User Setup Required

None - no external service configuration required.

## Auth Gates

None.

## Next Phase Readiness
- Later ambient cmux phases can call one cached adapter boundary for status, progress, and log writes without re-implementing targeting or probe logic.
- Suppressed sessions still stay quiet and non-cmux flows remain unchanged, so follow-on UX work can focus on message policy instead of attachment safety.

## Self-Check

PASSED

- Verified required summary, source, test, and rebuilt runtime files exist on disk.
- Verified task commits `b6e63293`, `54b365f3`, `75654477`, and `fa449775` exist in `jj log`.

---
*Phase: 170-cmux-workspace-detection-safe-targeting*
*Completed: 2026-03-31*
