---
phase: 172-ambient-attention-ux-noise-control
plan: 01
subsystem: plugin
tags: [json, javascript, commonjs]
requires:
  - phase: 170-cmux-workspace-detection-safe-targeting
    provides: attached workspace-scoped cmux adapter with trusted write gating
  - phase: 171-ambient-workspace-status-progress
    provides: lifecycle-driven sidebar sync that later attention wiring can consume
provides:
  - pure attention policy helpers for lifecycle event classification, semantic keys, and cooldown decisions
  - attached adapter notify transport that stays behind the existing trusted cmux boundary
affects: [plugin, cmux, notifications, ambient-ux]
tech-stack:
  added: []
  patterns:
    - pure attention policy separated from cmux side effects
    - attached adapter owns both log and notify delivery for workspace-scoped writes
key-files:
  created:
    - .planning/phases/172-ambient-attention-ux-noise-control/172-01-TDD-AUDIT.json
    - src/plugin/cmux-attention-policy.js
    - tests/plugin-cmux-attention-policy.test.cjs
  modified:
    - src/plugin/cmux-targeting.js
    - tests/plugin-cmux-targeting.test.cjs
key-decisions:
  - "Kept lifecycle classification pure so later plugin hooks can emit ambient events without re-deriving transport or attachment truth."
  - "Reused the existing attached cmux adapter boundary for notify delivery so suppressed or unattached sessions stay fail-open and quiet."
patterns-established:
  - "Semantic event keys include workspace plus stable event identity instead of rendered log copy."
  - "Warnings and blockers cool down by semantic key while first occurrences still notify."
requirements-completed: [CMUX-06, CMUX-09]
one-liner: "Pure cmux attention policy with semantic dedupe keys and trusted attached-only notify delivery"
duration: 15min
completed: 2026-03-31
---

# Phase 172 Plan 01: Create the attention-policy contract and trusted notify transport that Phase 172 will build on. Summary

**Pure cmux attention policy with semantic dedupe keys and trusted attached-only notify delivery**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-31 12:49:22 -0600
- **Completed:** 2026-03-31 13:04:46 -0600
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added a pure `cmux-attention-policy` helper that classifies lifecycle moments into log-only or notify-plus-log outcomes with stable semantic keys and warning/blocker cooldowns.
- Extended the attached `cmux` adapter with workspace-scoped `notify(...)` while keeping suppressed and unattached adapters inert behind the existing trust gate.
- Locked the Phase 172 contract with focused regressions for quiet-by-default starts/task completion, first-occurrence escalation, semantic dedupe keys, and cooldown behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regressions for notify transport and quiet-by-default attention policy** - `9828199` (`test`)
2. **Task 2: Implement the pure attention policy and attached notify boundary** - `7d776dd` (`feat`)

_Note: This TDD slice completed RED and GREEN commits; no separate refactor commit was needed._

## TDD Audit Trail

Review the exact RED/GREEN/REFACTOR proof package here. REFACTOR evidence is required when a refactor commit exists.

### RED
- **Commit:** `9828199` (test: test(172-01): add failing test for semantic ambient attention policy and trusted notify transport)
- **GSD-Phase:** red
- **Target command:** `npm run test:file -- tests/plugin-cmux-targeting.test.cjs tests/plugin-cmux-attention-policy.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `✖ planner-start, executor-start, and task-complete stay log-only (0.989916ms)`
- **Expected / observed:** fail → fail

### GREEN
- **Commit:** `7d776dd` (feat: feat(172-01): implement semantic ambient attention policy and trusted notify transport)
- **GSD-Phase:** green
- **Target command:** `npm run test:file -- tests/plugin-cmux-targeting.test.cjs tests/plugin-cmux-attention-policy.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 20`
- **Expected / observed:** pass → pass

### Machine-Readable Stage Proof

```json
{
  "red": {
    "commit": {
      "hash": "9828199a3b5d687ce48ed424355aea856934f60d",
      "message": "test(172-01): add failing test for semantic ambient attention policy and trusted notify transport",
      "gsd_phase": "red"
    },
    "proof": {
      "target_command": "npm run test:file -- tests/plugin-cmux-targeting.test.cjs tests/plugin-cmux-attention-policy.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ planner-start, executor-start, and task-complete stay log-only (0.989916ms)",
      "expected_outcome": "fail",
      "observed_outcome": "fail"
    }
  },
  "green": {
    "commit": {
      "hash": "7d776dda09a4cc043580d832968a261f4421dc5c",
      "message": "feat(172-01): implement semantic ambient attention policy and trusted notify transport",
      "gsd_phase": "green"
    },
    "proof": {
      "target_command": "npm run test:file -- tests/plugin-cmux-targeting.test.cjs tests/plugin-cmux-attention-policy.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ℹ pass 20",
      "expected_outcome": "pass",
      "observed_outcome": "pass"
    }
  }
}
```

## Files Created/Modified

- `.planning/phases/172-ambient-attention-ux-noise-control/172-01-TDD-AUDIT.json` [+18/-0]
- `src/plugin/cmux-attention-policy.js` [+94/-0]
- `src/plugin/cmux-targeting.js` [+18/-0]
- `tests/plugin-cmux-attention-policy.test.cjs` [+93/-0]
- `tests/plugin-cmux-targeting.test.cjs` [+36/-1]

## Decisions Made

- Kept classification and dedupe logic pure in `src/plugin/cmux-attention-policy.js` so later lifecycle wiring can consume one deterministic contract without bypassing Phase 171 truth layers.
- Added `notify(...)` only to the attached adapter contract, preserving the same workspace-scoped trust gate already used for log and sidebar writes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Intent Alignment Verdict

- **Verdict:** Aligned
- **Why:** The shipped contract keeps starts and routine task completion log-only, escalates checkpoints/warnings/blockers/completion boundaries through notifications, and reuses semantic workspace-scoped dedupe keys plus cooldowns to avoid repetitive churn.

## Next Phase Readiness

- Phase 172 plan 02 can now wire lifecycle hooks into one pure attention contract instead of inventing event classification inline.
- Attached sessions have a trusted notify transport ready for integration, while suppressed and unattached sessions remain quiet by default.

## Self-Check: PASSED

- Verified required summary, source, test, and audit files exist on disk.
- Verified task commits `9828199a` and `7d776dda` exist in `jj log`.

---
*Phase: 172-ambient-attention-ux-noise-control*
*Completed: 2026-03-31*
