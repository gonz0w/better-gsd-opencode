---
phase: 0126-extended-tools
plan: 01
subsystem: cli
tags: [yq, bat, yaml, syntax-highlighting, config-schema, cli-tools]
requires:
  - phase: 0125-core-tools-integration
    provides: withToolFallback, isToolEnabled, cli-tools index with ripgrep/fd/jq
provides:
  - Per-tool config toggles for yq, bat, gh in CONFIG_SCHEMA
  - yq-backed YAML parsing in detectInfraServices (docker-compose) and detectMonorepo (pnpm-workspace)
  - bat-enhanced diff display in cmdSessionDiff and cmdRollbackInfo with silent fallback
affects: [0127-agent-routing, 0128-agent-collaboration]
tech-stack:
  added: []
  patterns:
    - "ripgrep pre-filter → yq structured parse → regex fallback for YAML extraction"
    - "bat display enhancement: write to temp .diff file, catWithHighlight, cleanup in finally block"
key-files:
  created: []
  modified:
    - src/lib/constants.js
    - src/commands/env.js
    - src/commands/features.js
    - tests/infra.test.cjs
    - tests/integration.test.cjs
key-decisions:
  - "cmdRollbackInfo lives in features.js not misc.js — plan description had wrong file, implementation correct"
  - "Silent fallback enforced: no usedFallback/guidance fields printed to user output"
  - "Integration test 'modern config' snapshots updated to include yq/bat/gh entries"
patterns-established:
  - "Config toggles follow tools_<name> pattern with nested section/field — isToolEnabled() works generically"
  - "bat enhancement pattern: isToolEnabled check → temp file → catWithHighlight → finally cleanup → additive result field"
requirements-completed: [TOOL-04, TOOL-05]
one-liner: "Config toggles for yq/bat/gh in CONFIG_SCHEMA, yq wired into docker-compose/pnpm-workspace YAML parsing, bat wired into session-diff/rollback-info diff display with silent fallback"
duration: 15min
completed: 2026-03-15
---

# Phase 126 Plan 01: Extended Tools Config Toggles and Integration Summary

**Config toggles for yq/bat/gh in CONFIG_SCHEMA, yq wired into docker-compose/pnpm-workspace YAML parsing, bat wired into session-diff/rollback-info diff display with silent fallback**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-15T13:16:37Z
- **Completed:** 2026-03-15T13:32:09Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added `tools_yq`, `tools_bat`, `tools_gh` entries to `CONFIG_SCHEMA` — `isToolEnabled()` now works generically for all 6 tools without any changes to fallback.js
- Replaced brittle regex-based YAML parsing in `detectInfraServices()` and `detectMonorepo()` with a yq-first structured parse approach (`ripgrep pre-filter → parseYAML → regex fallback`), making docker-compose service and pnpm-workspace member extraction more robust
- Enhanced `cmdSessionDiff` and `cmdRollbackInfo` in features.js with optional bat syntax highlighting — when bat is enabled/available, diff content is written to a temp file, highlighted, and added as `diff_highlighted` in the JSON output (additive, silent fallback)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add config toggles for yq, bat, and gh** - `a209c44` (feat)
2. **Task 2: Integrate yq into YAML parsing and bat into diff display** - `4933eac` (feat)

## Files Created/Modified

- `src/lib/constants.js` — Added tools_yq, tools_bat, tools_gh CONFIG_SCHEMA entries
- `src/commands/env.js` — yq-backed YAML parsing for docker-compose services and pnpm-workspace members
- `src/commands/features.js` — bat-enhanced diff display in cmdSessionDiff and cmdRollbackInfo
- `tests/infra.test.cjs` — Updated "modern config" snapshot to include yq/bat/gh tool entries
- `tests/integration.test.cjs` — Updated "modern config" snapshot to include yq/bat/gh tool entries
- `bin/bgsd-tools.cjs` — Rebuilt with all changes
- `bin/manifest.json` — Build manifest updated
- `src/lib/cli-tools/gh.js` — Pre-existing modification (not part of this plan)
- `src/lib/cli-tools/index.js` — Pre-existing modification (not part of this plan)

## Decisions Made

- **cmdRollbackInfo is in features.js, not misc.js**: The plan described misc.js at ~line 1608, but the function lives in features.js. Implementation correctly placed in features.js where the function actually resides.
- **Silent fallback enforced**: The `usedFallback` and `guidance` fields from `parseYAML`/`catWithHighlight` results are never printed to user output — the workflow just works with whichever backend ran.
- **isToolEnabled() used for bat, not isBatAvailable()**: Respects config toggles as required by the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated integration test snapshots for new CONFIG_SCHEMA entries**
- **Found during:** Task 1 (Add config toggles for yq, bat, gh)
- **Issue:** Two test files (`integration.test.cjs`, `infra.test.cjs`) had "modern config" snapshots with only `tools: { ripgrep, fd, jq }`. Adding three new CONFIG_SCHEMA entries caused `util:config-migrate` to flag them as needing migration, failing the "zero migration on modern config" assertions.
- **Fix:** Updated both test files to include `yq: true, bat: true, gh: true` in their tools sections.
- **Files modified:** `tests/integration.test.cjs`, `tests/infra.test.cjs`
- **Verification:** `npm test` → 1398 pass, 0 fail
- **Committed in:** `a209c44` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test snapshot update was required — tests exist precisely to catch this; the fix is correct. No scope creep.

## Issues Encountered

None — plan executed cleanly. The only issue was the expected test snapshot updates from adding new CONFIG_SCHEMA entries.

## Next Phase Readiness

- Config toggles fully functional: `isToolEnabled('yq')`, `isToolEnabled('bat')`, `isToolEnabled('gh')` all work via the existing generic mechanism
- yq integration in 2 YAML parsing callsites (docker-compose, pnpm-workspace) with structured parse and regex fallback
- bat integration in 2 diff display callsites (session-diff, rollback-info) with silent fallback and additive `diff_highlighted` field
- All 1398 tests pass (no regressions from the 1350 baseline)
- Ready for Phase 127 (agent routing) and Phase 128 (agent collaboration)

---
*Phase: 0126-extended-tools*
*Completed: 2026-03-15*
