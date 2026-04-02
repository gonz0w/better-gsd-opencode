---
phase: 185-cmux-coordination-backbone
plan: 02
subsystem: infra
tags: [cmux, plugin, debounce, fail-open, node:test]

# Dependency graph
requires:
  - phase: 185-01
    provides: shared single-flight backbone wiring points for plugin hook coordination
provides:
  - plugin startup and later runtime hooks now flow through one shared cmux refresh backbone
  - bounded fail-open suppression that stays quiet during backoff and wakes early on planning-file changes
  - focused plugin integration regressions for shared-cycle coalescing and suppression recovery
affects: [186-cmux-truthful-lifecycle-signals, plugin runtime refresh wiring]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared hook enqueue backbone, quiet suppression backoff, planning-change early wake]

key-files:
  created: []
  modified: [src/plugin/index.js, tests/plugin.test.cjs]

key-decisions:
  - "Keep startup on one immediate refreshNow cycle, then route watcher, idle, command, tool, and external planning changes through enqueue on the same backbone."
  - "Wake retryable suppressed cmux sessions by clearing only the current adapter cache on planning-file changes instead of adding a second refresh path."

patterns-established:
  - "Plugin hook pattern: event sources enqueue one shared cmux coordinator instead of calling sidebar and attention refresh helpers directly."
  - "Suppression recovery pattern: bounded retry stays quiet during backoff, but planning-file signals can invalidate the cached suppression verdict for one fresh re-check."

requirements-completed: [CMUX-01, CMUX-04]
one-liner: "Plugin hooks now share one debounced cmux refresh backbone with quiet suppression backoff and planning-file wake-up"

# Metrics
duration: 6 min
completed: 2026-04-02
---

# Phase 185 Plan 02: cmux Coordination Backbone Summary

**Plugin hooks now share one debounced cmux refresh backbone with quiet suppression backoff and planning-file wake-up**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-02T04:26:35Z
- **Completed:** 2026-04-02T04:32:12Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Routed startup, watcher, idle, command, tool, and external planning-change refresh work through one shared `createCmuxRefreshBackbone` instance.
- Preserved quiet fail-open behavior by keeping bounded retry logic on the cached cmux adapter while letting planning-file changes wake suppressed sessions early.
- Added focused plugin integration regressions that prove one immediate startup cycle, later burst coalescing, bounded suppression, and planning-change wake-up.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add plugin-level regressions for coordinated refresh and bounded suppression wake-up** - `d51bf36e` (test)
2. **Task 2: Replace per-hook direct refreshes with one shared backbone in the plugin** - `aba858c6` (feat)

## TDD Audit Trail

### RED
- **Commit:** `d51bf36e` (test: add failing plugin coordinated refresh regressions)
- **GSD-Phase:** red
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux coordinated refresh" tests/plugin.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `later bursts should wait for the debounced shared cycle`

### GREEN
- **Commit:** `aba858c6` (feat: route plugin hooks through shared cmux refresh backbone)
- **GSD-Phase:** green
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux coordinated refresh" tests/plugin.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `pass 2, fail 0`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "d51bf36e", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux coordinated refresh\" tests/plugin.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "later bursts should wait for the debounced shared cycle"
    }
  },
  "green": {
    "commit": { "hash": "aba858c6", "gsd_phase": "green" },
    "proof": {
      "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux coordinated refresh\" tests/plugin.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "pass 2, fail 0"
    }
  }
}
```

## Verification

- **Behavior proof (required):** Passed — `node --test --test-force-exit --test-name-pattern "Plugin cmux coordinated refresh" tests/plugin.test.cjs`
- **Regression proof (required):** Passed — `npm run build`
- **Human verification (not required):** Plugin coordination and suppression behavior are covered by deterministic integration tests plus rebuilt runtime validation.
- **Intent Alignment:** aligned — startup keeps one immediate refresh, later hooks coalesce through the shared backbone, and suppressed cmux can wake early on planning-file changes.
- **Requirement Coverage:** CMUX-01 and CMUX-04 satisfied for Phase 185.

## Files Created/Modified
- `src/plugin/index.js` - Replaces per-hook sidebar and attention refresh fan-out with one shared coordinated backbone and planning-change wake logic.
- `tests/plugin.test.cjs` - Adds plugin-level regressions for coordinated hook bursts, bounded suppression, and planning-file wake-up.

## Decisions Made
- Kept startup on an immediate `refreshNow()` call so plugin initialization still publishes one fresh cmux snapshot before later hooks debounce.
- Cleared only the current adapter cache on planning-file changes so retryable suppression can wake early without introducing a second refresh path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The first RED run exercised the stale built plugin runtime, so GREEN verification reran against the rebuilt local `plugin.js` after `npm run build` as required by the verification route.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 186 can now layer truthful lifecycle/status signals on top of a single shared cmux refresh pipeline instead of competing hook-specific refresh paths.
- Quiet suppression and planning-change wake behavior are proven at the plugin integration level, so the next phase can focus on visible lifecycle semantics rather than coordination correctness.

## Self-Check

PASSED
