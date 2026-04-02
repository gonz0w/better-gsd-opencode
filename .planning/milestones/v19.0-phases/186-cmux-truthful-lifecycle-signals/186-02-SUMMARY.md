---
phase: 186-cmux-truthful-lifecycle-signals
plan: 02
subsystem: plugin
tags: [cmux, attention, lifecycle, notifications, runtime]

# Dependency graph
requires:
  - phase: 186-01
    provides: shared workspace lifecycle classifier and sidebar snapshot truth
provides:
  - shared lifecycle-driven attention events for waiting, stale, finalize-failed, blocked, and recovery transitions
  - intervention-only notification policy with semantic cooldowns
  - focused proof that sidebar hints and attention logs reuse the same lifecycle meaning
affects: [cmux-attention-sync, cmux-attention-policy, plugin.js]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared lifecycle snapshot for attention, intervention-only notifications]

key-files:
  created: [tests/plugin-cmux-attention-sync.test.cjs]
  modified: [src/plugin/cmux-attention-sync.js, src/plugin/cmux-attention-policy.js, tests/plugin-cmux-attention-policy.test.cjs]

key-decisions:
  - "Derive attention events from the same sidebar lifecycle snapshot so state, hint, and attention semantics cannot drift apart."
  - "Notify only for waiting, stale, and finalize-failed states while keeping blocked and resolved-running transitions log-only."

patterns-established:
  - "Shared lifecycle fan-out: derive one workspace lifecycle snapshot, then project sidebar and attention from that same object."
  - "Intervention recovery logging: when a required-action state resolves, emit one quiet running/complete log without sending another notification."

requirements-completed: [CMUX-02, CMUX-03]
one-liner: "cmux attention now reuses the shared lifecycle snapshot to notify only for waiting, stale, and finalize-failed workspaces while logging truthful recovery transitions."

# Metrics
duration: 6 min
completed: 2026-04-02
---

# Phase 186 Plan 02: cmux Truthful Lifecycle Signals Summary

**cmux attention now reuses the shared lifecycle snapshot to notify only for waiting, stale, and finalize-failed workspaces while logging truthful recovery transitions.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-02T05:16:17Z
- **Completed:** 2026-04-02T05:22:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added RED contract coverage for shared-signal attention semantics, intervention-only notifications, and recovery logging.
- Routed cmux attention through the shared lifecycle snapshot so sidebar hints, logs, and notification decisions stay aligned.
- Rebuilt the local runtime and reran focused proof against the rebuilt checkout to confirm the touched slice after generation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED coverage for intervention-only notifications and shared-signal transition logs** - `94f99e52` (test)
2. **Task 2: Wire attention policy and sidebar sync to the shared lifecycle signal** - `a4320e0a` (feat)

**Plan metadata:** pending final docs commit

## TDD Audit Trail

### RED
- **Commit:** `94f99e52` (test: add failing attention lifecycle contract coverage)
- **GSD-Phase:** red
- **Target command:** `node --test tests/plugin-cmux-attention-sync.test.cjs tests/plugin-cmux-attention-policy.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `actual: 'checkpoint' expected: 'waiting'`

### GREEN
- **Commit:** `a4320e0a` (feat: unify attention lifecycle semantics)
- **GSD-Phase:** green
- **Target command:** `node --test tests/plugin-cmux-attention-sync.test.cjs tests/plugin-cmux-attention-policy.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `pass 7 fail 0`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "94f99e52", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/plugin-cmux-attention-sync.test.cjs tests/plugin-cmux-attention-policy.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "actual: 'checkpoint' expected: 'waiting'"
    }
  },
  "green": {
    "commit": { "hash": "a4320e0a", "gsd_phase": "green" },
    "proof": {
      "target_command": "node --test tests/plugin-cmux-attention-sync.test.cjs tests/plugin-cmux-attention-policy.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "pass 7 fail 0"
    }
  }
}
```

## Verification Summary

- **Behavior proof:** required — passed via `node --test tests/plugin-cmux-attention-sync.test.cjs tests/plugin-cmux-attention-policy.test.cjs`.
- **Regression proof:** required — passed via `npm run build && node --test tests/plugin-cmux-attention-sync.test.cjs tests/plugin-cmux-attention-policy.test.cjs`.
- **Human verification:** not required — command-surface/runtime attention behavior only.
- **Rebuilt runtime proof:** required — passed after rebuilding `plugin.js` locally and rerunning the focused attention tests against the rebuilt checkout.
- **Intent Alignment:** aligned — required-intervention states now stand out through shared lifecycle-driven logs and notifications, while resolved/running states stop behaving like active alerts.
- **Requirement Coverage:** CMUX-03 complete; CMUX-02 cross-surface truth is now consistent across the sidebar work from Plan 01 plus the attention/logging slice from this plan.

## Files Created/Modified
- `tests/plugin-cmux-attention-sync.test.cjs` - Focused transition and recovery tests for shared-signal attention behavior.
- `tests/plugin-cmux-attention-policy.test.cjs` - Policy tests now lock intervention-only notification kinds and semantic cooldown behavior.
- `src/plugin/cmux-attention-sync.js` - Attention candidates now derive from the shared lifecycle snapshot and emit recovery logs only on semantic transitions.
- `src/plugin/cmux-attention-policy.js` - Notification policy now distinguishes intervention-required states from log-only blocked or quiet lifecycle transitions.

## Decisions Made
- Reused `deriveCmuxSidebarSnapshot()` as the attention input so sidebar hint text and attention messaging stay sourced from the same lifecycle object.
- Restricted notification delivery to `waiting`, `stale`, and `finalize-failed` states to keep loud attention reserved for actual operator intervention.
- Logged one resolved-state transition when intervention clears so operators can notice recovery without leaving a warning badge implied on `running` or `complete` work.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Rebuilding `plugin.js` in this checkout also refreshed unrelated pre-existing dirty-source output, so the rebuilt runtime was used for verification but only the plan-scope source files were included in the atomic task commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 186 is complete: sidebar status, hint text, logs, and notifications now reuse one lifecycle truth across the cmux surface.
- Milestone v19.0 is ready for phase verification or completion review.

## Self-Check: PASSED

- Found summary file `.planning/phases/186-cmux-truthful-lifecycle-signals/186-02-SUMMARY.md`.
- Found task commits `94f99e52` and `a4320e0a` in JJ history.
