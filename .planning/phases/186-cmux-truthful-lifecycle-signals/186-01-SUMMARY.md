---
phase: 186-cmux-truthful-lifecycle-signals
plan: 01
subsystem: plugin
tags: [cmux, sidebar, lifecycle, runtime, verification]

# Dependency graph
requires: []
provides:
  - shared workspace lifecycle classifier for cmux sidebar truth
  - compact sidebar activity hints and intervention-state progress suppression
  - focused lifecycle precedence proof plus rebuilt plugin runtime smoke coverage
affects: [cmux-sidebar-sync, cmux-attention-sync, plugin.js]

# Tech tracking
tech-stack:
  added: []
  patterns: [classify-first-then-project, shared lifecycle signal]

key-files:
  created: [src/plugin/cmux-lifecycle-signal.js, tests/plugin-cmux-lifecycle-signal.test.cjs]
  modified: [src/plugin/cmux-sidebar-snapshot.js, src/plugin/cmux-sidebar-sync.js, tests/plugin-cmux-sidebar-snapshot.test.cjs, plugin.js]

key-decisions:
  - "Use one ordered lifecycle classifier for finalize-failed, waiting, stale, blocked, reconciling, running, complete, and idle instead of separate sidebar heuristics."
  - "Project lightweight activity hints separately from numeric progress so intervention-required states can clear misleading progress while quiet states stay readable."

patterns-established:
  - "cmux lifecycle truth: derive semantic state once, then project status/context/activity/progress from that signal."
  - "Generated runtime verification: rebuild plugin.js, rerun focused tests, then smoke the rebuilt sidebar sync against a mock cmux adapter."

requirements-completed: [CMUX-02]
one-liner: "Shared cmux lifecycle classification now drives truthful waiting/stale/finalize-failed/running sidebar status, compact hints, and progress suppression from one source of truth."

# Metrics
duration: 8 min
completed: 2026-04-02
---

# Phase 186 Plan 01: cmux Truthful Lifecycle Signals Summary

**Shared cmux lifecycle classification now drives truthful waiting/stale/finalize-failed/running sidebar status, compact hints, and progress suppression from one source of truth.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-02T05:03:24Z
- **Completed:** 2026-04-02T05:12:36Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `deriveWorkspaceLifecycleSignal()` with explicit lifecycle precedence, plain-English labels, compact hints, and intervention-aware progress treatment.
- Routed sidebar snapshot projection through the shared lifecycle signal so status, context, activity, and progress stay aligned.
- Rebuilt `plugin.js` and proved the touched runtime with focused tests plus a direct sidebar-sync smoke run against the rebuilt bundle.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED coverage for lifecycle precedence, compact hints, and progress suppression** - `de0ad80c` (test)
2. **Task 2: Implement the shared lifecycle classifier and route sidebar projection through it** - `641279db` (feat)
3. **Runtime sync: rebuild generated plugin artifact** - `3016e488` (refactor)

**Plan metadata:** pending final docs commit

## TDD Audit Trail

### RED
- **Commit:** `de0ad80c` (test: add failing lifecycle signal contract tests)
- **GSD-Phase:** red
- **Target command:** `node --test tests/plugin-cmux-lifecycle-signal.test.cjs tests/plugin-cmux-sidebar-snapshot.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `TypeError: deriveWorkspaceLifecycleSignal is not a function`

### GREEN
- **Commit:** `641279db` (feat: derive shared cmux lifecycle signal)
- **GSD-Phase:** green
- **Target command:** `node --test tests/plugin-cmux-lifecycle-signal.test.cjs tests/plugin-cmux-sidebar-snapshot.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `pass 9 fail 0`

### REFACTOR
- **Commit:** `3016e488` (refactor: sync plugin runtime lifecycle bundle)
- **GSD-Phase:** refactor
- **Target command:** `node --test tests/plugin-cmux-lifecycle-signal.test.cjs tests/plugin-cmux-sidebar-snapshot.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `pass 9 fail 0`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "de0ad80c", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/plugin-cmux-lifecycle-signal.test.cjs tests/plugin-cmux-sidebar-snapshot.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "TypeError: deriveWorkspaceLifecycleSignal is not a function"
    }
  },
  "green": {
    "commit": { "hash": "641279db", "gsd_phase": "green" },
    "proof": {
      "target_command": "node --test tests/plugin-cmux-lifecycle-signal.test.cjs tests/plugin-cmux-sidebar-snapshot.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "pass 9 fail 0"
    }
  },
  "refactor": {
    "commit": { "hash": "3016e488", "gsd_phase": "refactor" },
    "proof": {
      "target_command": "node --test tests/plugin-cmux-lifecycle-signal.test.cjs tests/plugin-cmux-sidebar-snapshot.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "pass 9 fail 0"
    }
  }
}
```

## Verification Summary

- **Behavior proof:** required — passed via focused lifecycle and sidebar contract tests.
- **Regression proof:** required — passed via `npm run build && node --test tests/plugin-cmux-lifecycle-signal.test.cjs tests/plugin-cmux-sidebar-snapshot.test.cjs`.
- **Human verification:** not required — command-surface/runtime projection work only.
- **Rebuilt runtime proof:** passed via direct `plugin.js` smoke script showing `Waiting`, `Phase 186 P01`, `Checkpoint waiting for review`, and cleared progress for a waiting scenario.
- **Intent Alignment:** aligned — the sidebar now shows one workspace-scoped lifecycle truth with compact hints and intervention-state progress suppression instead of independent heuristic meanings.
- **Requirement Coverage:** CMUX-02 complete for the sidebar truth slice covered by Plan 01; CMUX-03 remains for the follow-up attention/notification plan.

## Files Created/Modified
- `src/plugin/cmux-lifecycle-signal.js` - Shared lifecycle classifier with ordered precedence, hint generation, context reuse, and progress treatment.
- `src/plugin/cmux-sidebar-snapshot.js` - Sidebar projection now consumes the shared lifecycle signal.
- `src/plugin/cmux-sidebar-sync.js` - Sidebar sync now writes the shared activity hint separately from numeric progress.
- `tests/plugin-cmux-lifecycle-signal.test.cjs` - Focused lifecycle precedence and progress-suppression contract tests.
- `tests/plugin-cmux-sidebar-snapshot.test.cjs` - Snapshot tests aligned to truthful lifecycle labels and compact activity hints.
- `plugin.js` - Rebuilt local runtime bundle containing the new lifecycle projection behavior.

## Decisions Made
- Used structured `blocking_reason` / `recovery_summary` signals first so stale and finalize-failed states reuse Phase 184 taxonomy when present.
- Kept `context` projection separate from `activity` so phase/plan identity stays stable while the inline hint changes with lifecycle state.
- Treated intervention-required states as progress-hidden regardless of stale numeric values to avoid implying advancing work during waits or recovery.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated sidebar sync to project the new shared activity hint field**
- **Found during:** Task 2 (Implement the shared lifecycle classifier and route sidebar projection through it)
- **Issue:** Routing snapshot derivation through a shared lifecycle signal was not sufficient on its own because `cmux-sidebar-sync.js` still read progress-only activity output and would have dropped the new compact hint contract.
- **Fix:** Updated sidebar sync to set `bgsd.activity` from `snapshot.activity` and clear numeric progress independently.
- **Files modified:** `src/plugin/cmux-sidebar-sync.js`
- **Verification:** Focused node:test suite plus rebuilt runtime smoke script showed waiting state uses the compact hint and clears progress.
- **Committed in:** `641279db` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Kept the implementation aligned with the intended sidebar truth contract. No scope creep.

## Issues Encountered
- `execute:tdd validate-red` and `execute:tdd validate-green` currently report `TDD command not yet implemented`, so direct `node --test ...` exit codes were used as the authoritative RED/GREEN proof for this run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Shared lifecycle truth is in place for sidebar projection and ready to be reused by Plan 02 attention/logging work.
- The next plan can focus on transition-aware attention and intervention-only notifications without re-inventing lifecycle classification.

## Self-Check: PASSED

- Found summary file `.planning/phases/186-cmux-truthful-lifecycle-signals/186-01-SUMMARY.md`.
- Found task/runtime commits `de0ad80c`, `641279db`, and `3016e488` in JJ history.

---
*Phase: 186-cmux-truthful-lifecycle-signals*
*Completed: 2026-04-02*
