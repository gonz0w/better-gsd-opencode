---
phase: 172-ambient-attention-ux-noise-control
plan: 02
subsystem: plugin
tags: [json, javascript, commonjs]
requires:
  - phase: 170-cmux-workspace-detection-safe-targeting
    provides: attached workspace-scoped cmux adapter with trusted write gating
  - phase: 171-ambient-workspace-status-progress
    provides: level-triggered sidebar refresh hooks and trustworthy project-state snapshots
  - phase: 172-ambient-attention-ux-noise-control
    provides: pure attention policy classification, semantic dedupe keys, and attached notify transport
provides:
  - edge-triggered plugin attention sync that emits concise ambient logs on meaningful lifecycle transitions
  - checkpoint, warning, and phase-complete escalation through attached cmux notifications without refresh spam
affects: [plugin, cmux, notifications, ambient-ux]
tech-stack:
  added: []
  patterns:
    - separate level-triggered sidebar refresh from edge-triggered attention emission
    - dedupe attention by workspace and event kind so repeated refreshes stay quiet
key-files:
  created:
    - .planning/phases/172-ambient-attention-ux-noise-control/172-02-TDD-AUDIT.json
    - src/plugin/cmux-attention-sync.js
  modified:
    - src/plugin/index.js
    - tests/plugin.test.cjs
key-decisions:
  - "Kept attention sync in a dedicated module so frequent sidebar refresh hooks can reuse one edge-triggered emission path without mixing write-side effects into snapshot sync."
  - "Scoped dedupe memory by workspace and event kind so startup, task-complete, warning, checkpoint, and completion events can suppress unchanged repeats while still allowing meaningful transitions to emit."
patterns-established:
  - "refreshCmuxSidebar stays level-triggered while refreshCmuxAttention classifies and emits only semantic transitions."
  - "Plugin attention regressions assert log-only routine activity, notify-worthy checkpoints and completion boundaries, and repeated warning suppression through the adapter boundary."
requirements-completed: [CMUX-05, CMUX-06, CMUX-09]
one-liner: "Edge-triggered plugin attention sync that logs meaningful lifecycle moments, notifies checkpoints and completion boundaries, and suppresses repeated warning churn"
duration: 6min
completed: 2026-03-31
---

# Phase 172 Plan 02: Wire low-noise ambient logs and notifications into the plugin lifecycle without turning refreshes into spam. Summary

**Edge-triggered plugin attention sync that logs meaningful lifecycle moments, notifies checkpoints and completion boundaries, and suppresses repeated warning churn**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31 13:09:08 -0600
- **Completed:** 2026-03-31 13:18:20 -0600
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `src/plugin/cmux-attention-sync.js` so attached `cmux` sessions emit edge-triggered ambient events from one shared lifecycle path instead of logging from every sidebar refresh.
- Wired startup, file watcher, idle, and `tool.execute.after` hooks in `src/plugin/index.js` to keep routine starts and task completion log-only while escalating checkpoints, warnings, and completion boundaries through notifications.
- Locked the integration contract with focused plugin regressions proving startup/task log-only behavior, checkpoint notification escalation, phase-complete attention, and repeated warning suppression.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add plugin integration regressions for ambient attention sync and quiet suppression** - `1e60a88` (`test`)
2. **Task 2: Wire edge-triggered attention sync through plugin lifecycle hooks** - `8aaee1f` (`feat`)

_Note: This TDD slice completed RED and GREEN commits; no separate refactor commit was needed._

## TDD Audit Trail

Review the exact RED/GREEN/REFACTOR proof package here. REFACTOR evidence is required when a refactor commit exists.

### RED
- **Commit:** `1e60a88` (test: test(172-02): add failing test for plugin cmux attention sync)
- **GSD-Phase:** red
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux attention sync" tests/plugin.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `✖ Plugin cmux attention sync keeps startup and routine task completion log-only while checkpoint waits notify (177.621166ms)`
- **Expected / observed:** fail → fail

### GREEN
- **Commit:** `8aaee1f` (feat: feat(172-02): implement plugin cmux attention sync)
- **GSD-Phase:** green
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux attention sync" tests/plugin.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 2`
- **Expected / observed:** pass → pass

### Machine-Readable Stage Proof

```json
{
  "red": {
    "commit": {
      "hash": "1e60a88eb1479d2ef635103fd4970c2fbf672753",
      "message": "test(172-02): add failing test for plugin cmux attention sync",
      "gsd_phase": "red"
    },
    "proof": {
      "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux attention sync\" tests/plugin.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ Plugin cmux attention sync keeps startup and routine task completion log-only while checkpoint waits notify (177.621166ms)",
      "expected_outcome": "fail",
      "observed_outcome": "fail"
    }
  },
  "green": {
    "commit": {
      "hash": "8aaee1f153ee650801deeb872ebd40ec55fc1f4d",
      "message": "feat(172-02): implement plugin cmux attention sync",
      "gsd_phase": "green"
    },
    "proof": {
      "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux attention sync\" tests/plugin.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ℹ pass 2",
      "expected_outcome": "pass",
      "observed_outcome": "pass"
    }
  }
}
```

## Files Created/Modified

- `.planning/phases/172-ambient-attention-ux-noise-control/172-02-TDD-AUDIT.json` [+18/-0]
- `src/plugin/cmux-attention-sync.js` [+313/-0]
- `src/plugin/index.js` [+26/-0]
- `tests/plugin.test.cjs` [+186/-0]

## Decisions Made

- Kept attention sync stateful and separate from sidebar sync so high-frequency refresh hooks can stay idempotent while ambient logs and notifications remain edge-triggered.
- Used workspace-plus-kind dedupe memory to suppress repeated warning refreshes without blocking later checkpoint or phase-complete events in the same session.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Intent Alignment Verdict

- **Verdict:** Aligned
- **Why:** The shipped path keeps sidebar snapshot refresh separate from edge-triggered attention sync, emits concise log-only starts and routine task completion, reserves notifications for checkpoints/warnings/completion boundaries, and suppresses repeated warning churn unless the semantic event changes.

## Next Phase Readiness

- Attached `cmux` workspaces now have a single lifecycle-driven attention path that future polish can tune without reopening trust gating or sidebar snapshot wiring.
- Focused plugin regressions now protect the quiet-by-default split between ambient logs and notify-worthy events.

## Self-Check: PASSED

- Verified required summary, source, and test files exist on disk.
- Verified task commits `1e60a88e` and `8aaee1f1` exist in `jj log`.

---
*Phase: 172-ambient-attention-ux-noise-control*
*Completed: 2026-03-31*
