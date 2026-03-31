---
phase: 171-ambient-workspace-status-progress
plan: 02
subsystem: plugin
tags: [javascript, commonjs, cmux]
provides:
  - attached cmux sidebar sync for primary state, compact context, and trustworthy progress
  - lifecycle refresh path that reapplies or clears sidebar metadata on startup, file changes, idle validation, and tool activity
affects: [cmux, plugin, sidebar-status, sidebar-progress]
tech-stack:
  added: []
  patterns: [adapter-driven sidebar sync, cache-invalidating lifecycle refresh]
key-files:
  created:
    - src/plugin/cmux-sidebar-sync.js
  modified:
    - src/plugin/index.js
    - plugin.js
    - tests/plugin.test.cjs
    - src/plugin/cmux-sidebar-sync.js
key-decisions:
  - "Kept all cmux sidebar writes behind one helper so plugin lifecycle hooks publish through one adapter boundary."
  - "Invalidate parser caches before each sidebar refresh so tool and watcher lifecycle writes never reuse stale planning state."
patterns-established:
  - "Lifecycle refresh boundary: startup, file watcher, idle validation, and tool hooks all call the same sidebar sync helper."
  - "Progress trust boundary: exact progress uses setProgress, activity-only work uses a separate status key, and hidden progress clears stale metadata immediately."
requirements-completed: [CMUX-02, CMUX-03, CMUX-04]
one-liner: "Attached cmux sidebar sync that publishes trusted state, workflow context, and exact-or-activity progress through one lifecycle-driven adapter path"
duration: 11min
completed: 2026-03-31
---

# Phase 171 Plan 02: Wire the shared ambient snapshot into attached `cmux` sidebar updates without disturbing the rest of the plugin. Summary

**Attached cmux sidebar sync that publishes trusted state, workflow context, and exact-or-activity progress through one lifecycle-driven adapter path**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-31 09:01:03 -0600
- **Completed:** 2026-03-31 09:12:02 -0600
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added plugin integration regressions that prove attached sessions publish trusted sidebar metadata, clear stale progress/context, and keep suppressed sessions quiet.
- Implemented `src/plugin/cmux-sidebar-sync.js` as the single writer boundary for bGSD-owned state, context, and activity keys plus exact progress updates.
- Wired startup, file watcher, idle, and tool lifecycle hooks to refresh sidebar metadata from fresh planning state without making other plugin subsystems cmux-aware.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add plugin integration regressions for attached sidebar sync and quiet suppression** - `0d0d384` (`test`)
2. **Task 2: Wire lifecycle-driven sidebar sync through the attached adapter** - `3ff0fd5` (`feat`)

## TDD Audit Trail

Review the exact RED/GREEN/REFACTOR proof package here. REFACTOR evidence is required when a refactor commit exists.

### RED
- **Commit:** `0d0d384` (test: test(171-02): add failing test for plugin cmux sidebar sync)
- **GSD-Phase:** red
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux sidebar sync" tests/plugin.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `✖ attached startup and lifecycle refreshes apply trusted sidebar state, clear stale metadata, and preserve activity-only progress`

### GREEN
- **Commit:** `3ff0fd5` (feat: feat(171-02): wire trusted cmux sidebar sync through plugin lifecycle hooks)
- **GSD-Phase:** green
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux sidebar sync" tests/plugin.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 2`

### Machine-Readable Stage Proof

```json
{
  "red": {
    "commit": {
      "hash": "0d0d384120c065fd1ef8d8a83815ed91ccfc99ab",
      "message": "test(171-02): add failing test for plugin cmux sidebar sync",
      "gsd_phase": "red"
    },
    "proof": {
      "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux sidebar sync\" tests/plugin.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ attached startup and lifecycle refreshes apply trusted sidebar state, clear stale metadata, and preserve activity-only progress",
      "expected_outcome": "fail",
      "observed_outcome": "fail"
    }
  },
  "green": {
    "commit": {
      "hash": "3ff0fd50df97f37a2e2091318409af523523a510",
      "message": "feat(171-02): wire trusted cmux sidebar sync through plugin lifecycle hooks",
      "gsd_phase": "green"
    },
    "proof": {
      "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux sidebar sync\" tests/plugin.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ℹ pass 2",
      "expected_outcome": "pass",
      "observed_outcome": "pass"
    }
  }
}
```

## Files Created/Modified

- `plugin.js` [+210/-9]
- `src/plugin/cmux-sidebar-sync.js` [+45/-0]
- `src/plugin/index.js` [+23/-0]
- `tests/plugin.test.cjs` [+210/-0]

## Decisions Made

- Centralized all sidebar writes in `syncCmuxSidebar()` so lifecycle hooks reuse one conservative adapter boundary instead of spreading cmux formatting logic across validators and detectors.
- Refresh now invalidates planning caches before reading state so `tool.execute.after`, `session.idle`, and file watcher updates reapply current trustworthy metadata rather than stale cached values.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial lifecycle refresh wiring reused cached planning state during `tool.execute.after`, which kept the prior exact-progress snapshot alive. The shared refresh path now invalidates parser caches before recomputing the sidebar snapshot so hook-driven updates reflect on-disk truth immediately.

## Next Phase Readiness

- Phase 172 can build log-stream and notification behavior on top of stable `bgsd.state`, `bgsd.context`, and `bgsd.activity` sidebar keys plus the shared lifecycle refresh path.
- No blockers from Phase 171 remain in the attached/suppressed sidebar sync boundary.

## Self-Check: PASSED

---
*Phase: 171-ambient-workspace-status-progress*
*Completed: 2026-03-31*
