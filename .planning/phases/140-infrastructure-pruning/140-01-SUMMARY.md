---
phase: 140-infrastructure-pruning
plan: 01
subsystem: infra
tags: [decision-rules, enricher, test-cleanup, pruning]

# Dependency graph
requires:
  - phase: 139-end-to-end-validation
    provides: confirmed consumer mapping for all tool infrastructure fields
provides:
  - handoff_tool_context simplified to { capability_level } only
  - DECISION_REGISTRY pruned to 19 entries (3 orphaned rules removed)
  - isConsumer() contract test uses accurate decisions.{id} pattern
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dead-weight pruning: remove infrastructure whose consumers are confirmed absent after E2E validation"
    - "Contract test accuracy: isConsumer() checks specific decisions.{id} pattern, not broad tool_availability"

key-files:
  created: []
  modified:
    - src/plugin/command-enricher.js
    - src/lib/decision-rules.js
    - tests/enricher-decisions.test.cjs
    - tests/decisions.test.cjs
    - tests/tool-routing-contract.test.cjs
    - tests/cli-tools-integration.test.cjs
    - bin/bgsd-tools.cjs

key-decisions:
  - "Remove available_tools and tool_count from handoff_tool_context — capability_level is the sole confirmed consumer field"
  - "Remove json-transform-mode, agent-capability-level, phase-dependencies from DECISION_REGISTRY — zero workflow/agent consumers confirmed"
  - "Fix isConsumer() to use decisions.{id} pattern only — tool_availability blanket match was causing false positives"

patterns-established:
  - "Pruning pattern: E2E validation confirms consumers before Phase 140 removes dead infrastructure"
  - "Contract test precision: consumer detection uses exact decisions.{rule-id} pattern, not broad signal matching"

requirements-completed:
  - PRUNE-01
  - PRUNE-02

one-liner: "Pruned unused tool infrastructure: handoff_tool_context simplified to capability_level-only, 3 orphaned decision rules removed (agent-capability-level, json-transform-mode, phase-dependencies), DECISION_REGISTRY shrunk from 22 to 19 entries, all 1677 tests pass"

# Metrics
duration: 9min
completed: 2026-03-17
---

# Phase 140 Plan 01: Infrastructure Pruning Summary

**Pruned unused tool infrastructure: handoff_tool_context simplified to capability_level-only, 3 orphaned decision rules removed (agent-capability-level, json-transform-mode, phase-dependencies), DECISION_REGISTRY shrunk from 22 to 19 entries, all 1677 tests pass**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-17T22:24:41Z
- **Completed:** 2026-03-17T22:34:03Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Simplified `handoff_tool_context` enrichment field to `{ capability_level }` only — removing `available_tools` array and `tool_count` (zero-consumer fields)
- Removed 3 orphaned decision rules from DECISION_REGISTRY: `agent-capability-level`, `json-transform-mode`, `phase-dependencies` — deleted registry entries, resolve functions (~180 lines), and module.exports entries
- Fixed `isConsumer()` in tool-routing-contract.test.cjs to use `decisions.{rule-id}` pattern only (removed `tool_availability` blanket match that was causing false-positive consumer detection)
- Updated all 4 affected test files, rebuilt CLI, confirmed 1677 tests / 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Simplify handoff_tool_context to capability_level only (PRUNE-01)** - `423a42a` (refactor)
2. **Task 2: Remove orphaned decision rules and update all affected tests (PRUNE-02)** - `1e02b3a` (refactor)
3. **Task 3: Rebuild CLI and run full test suite** - `bf64e62` (build)

## Files Created/Modified

- `src/plugin/command-enricher.js` - Removed available_tools array, tool_count var; handoff_tool_context now `{ capability_level }` only
- `src/lib/decision-rules.js` - Removed 3 DECISION_REGISTRY entries + 3 resolve functions + Phase 128 section comment (996→811 lines)
- `tests/enricher-decisions.test.cjs` - Removed 4 tests for removed sub-fields; updated buildEnrichment helper to return capability_level only
- `tests/decisions.test.cjs` - Removed 3 imports, resolveJsonTransformMode describe block, evaluateDecisions 3-rules test, entire Phase 128 describe block
- `tests/tool-routing-contract.test.cjs` - Fixed isConsumer(), updated Chain B count >= 4 → >= 2, removed per-rule tests for removed rules, removed false consumer location test
- `tests/cli-tools-integration.test.cjs` - Removed json-transform-mode (3 tests) and agent-capability-level (3 tests) test blocks, updated Chain B count
- `bin/bgsd-tools.cjs` - Rebuilt from updated source; removed symbols confirmed absent

## Decisions Made

- `capability_level` is the sole confirmed consumer of `handoff_tool_context` — `execute-phase.md` and `map-codebase.md` read `handoff_tool_context.capability_level`, no files read `available_tools` or `tool_count`
- `agent-capability-level` decision rule was redundant with `handoff_tool_context.capability_level` — the enricher already computes the same value directly to avoid circular dependency; no workflow consumed the decision version
- `json-transform-mode` and `phase-dependencies` decision rules had zero workflow/agent consumers (grep confirmed 0 matches for `decisions.json-transform-mode` and `decisions.phase-dependencies` in workflows/ and agents/)
- `isConsumer()` using `tool_availability` as blanket match was incorrect — it caused `agent-capability-level` and `json-transform-mode` to falsely appear as "consumed" because agents reference `tool_availability` as a general field

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — gap closure plan / checkpoint plan / review context unavailable

## Issues Encountered

None — all edits went smoothly. The intermediate state after removing the Phase 128 describe block from decisions.test.cjs required two edit passes (the first edit removed the resolveAgentCapabilityLevel block but left orphaned resolvePhaseDependencies and DECISION_REGISTRY integration content, which was then cleaned up in a second pass). No behavioral issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- v14.1 milestone complete — all 3 phases executed: Phase 138 (routing), Phase 139 (validation), Phase 140 (pruning)
- DECISION_REGISTRY is clean: 19 entries, all with confirmed consumers
- Tool infrastructure is lean: `handoff_tool_context` contains only the field that workflows actually read
- Full test suite at 1677 tests, 0 failures
- Ready for milestone completion (`/bgsd-complete-milestone`)

## Self-Check: PASSED

- `140-01-SUMMARY.md` — FOUND
- `src/plugin/command-enricher.js` — FOUND
- `src/lib/decision-rules.js` — FOUND
- Commit `423a42a` (Task 1) — FOUND
- Commit `1e02b3a` (Task 2) — FOUND
- Commit `bf64e62` (Task 3) — FOUND

---
*Phase: 140-infrastructure-pruning*
*Completed: 2026-03-17*
