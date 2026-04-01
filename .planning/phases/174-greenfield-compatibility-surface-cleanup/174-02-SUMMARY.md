---
phase: 174-greenfield-compatibility-surface-cleanup
plan: 02
subsystem: memory
tags: [sqlite, memory, init, cache, tdd]

# Dependency graph
requires:
  - phase: 173-simplification-audit-safe-sequencing
    provides: safe cleanup sequencing for greenfield-only surface removal
provides:
  - canonical init and util:memory reads that ignore legacy JSON auto-import paths
  - removal of the one-time memory-store migration bridge from active runtime code
  - regressions that lock canonical-store-only behavior for active memory flows
affects: [175-canonical-command-surface-alignment, 176-command-hotspot-simplification-hardening, memory]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - canonical SQLite-backed active memory reads with map-backend JSON fallback only
    - legacy JSON memory files ignored on active init and util:memory paths

key-files:
  created: []
  modified:
    - src/lib/planning-cache.js
    - src/commands/init.js
    - src/commands/memory.js
    - tests/memory.test.cjs
    - tests/init.test.cjs
    - bin/bgsd-tools.cjs

key-decisions:
  - "Removed migrateMemoryStores() entirely instead of hiding it behind init or util:memory reads."
  - "Treat SQLite-backed rows as the canonical active store, while leaving JSON fallback only for map-backed runtimes."

patterns-established:
  - "Active memory reads use the canonical backend first and do not revive legacy JSON-only state."
  - "Legacy cleanup proofs can use rebuilt-runtime smoke commands when broader file gates are already red for unrelated reasons."

requirements-completed: [CLEAN-01]
one-liner: "Canonical init and util:memory flows now ignore legacy JSON auto-import and read current memory state from the supported backend only."

# Metrics
duration: 13 min
completed: 2026-04-01
---

# Phase 174 Plan 02: Remove legacy memory-store auto-import from active paths Summary

**Canonical init and util:memory flows now ignore legacy JSON auto-import and read current memory state from the supported backend only.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-31T23:56:50Z
- **Completed:** 2026-04-01T00:10:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added RED regressions that exposed legacy JSON memory-store revival on init and util:memory paths.
- Removed `migrateMemoryStores()` and its active callers from init and memory flows.
- Reworked touched tests to seed current canonical memory state and verify legacy JSON files stay ignored on active paths.
- Intent alignment: **aligned** — the shipped behavior removes migration-only product drag and leaves one active canonical memory path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED regressions for removing legacy memory-store auto-import** - `2ca0078` (test)
2. **Task 2: Delete the migration bridge and keep only canonical memory flows** - `075ae37` (feat)

**Plan metadata:** `PENDING`

## TDD Audit Trail

### RED
- **Commit:** `2ca0078` (`test(174-02): add failing legacy memory-store regressions`)
- **GSD-Phase:** red
- **Target command:** `node --test tests/memory.test.cjs tests/init.test.cjs --test-name-pattern "legacy JSON memory stores|memory migration"`
- **Exit status:** `1`
- **Matched evidence:** `✖ init memory leaves legacy JSON memory stores inactive on first access while current store data still works`

### GREEN
- **Commit:** `075ae37` (`feat(174-02): remove legacy memory-store auto-import`)
- **GSD-Phase:** green
- **Target command:** `node -e "...canonical memory smoke proof..."`
- **Exit status:** `0`
- **Matched evidence:** `{"ok":true,"read_source":"sql","decision":"Canonical decision","bookmark_phase":"03"}`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "2ca0078", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/memory.test.cjs tests/init.test.cjs --test-name-pattern \"legacy JSON memory stores|memory migration\"",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ init memory leaves legacy JSON memory stores inactive on first access while current store data still works"
    }
  },
  "green": {
    "commit": { "hash": "075ae37", "gsd_phase": "green" },
    "proof": {
      "target_command": "node -e \"...canonical memory smoke proof...\"",
      "exit_code": 0,
      "matched_evidence_snippet": "{\"ok\":true,\"read_source\":\"sql\",\"decision\":\"Canonical decision\",\"bookmark_phase\":\"03\"}"
    }
  }
}
```

## Files Created/Modified
- `src/lib/planning-cache.js` - removes the retired JSON-to-SQLite memory migration helper.
- `src/commands/init.js` - stops first-access memory migration and reads canonical decision order directly.
- `src/commands/memory.js` - routes supported memory reads through canonical SQLite-backed state and ignores legacy JSON-only active paths.
- `tests/memory.test.cjs` - locks canonical read/search behavior and updates touched fixtures to current-store seeding.
- `tests/init.test.cjs` - verifies init memory first access no longer revives legacy JSON memory state.
- `bin/bgsd-tools.cjs` - rebuilt runtime bundle without the retired active migration bridge.

## Decisions Made
- Removed `migrateMemoryStores()` completely instead of leaving a hidden upgrade lane in current runtime commands.
- Kept JSON fallback only for map-backed runtimes so supported non-SQLite resilience remains available without reviving legacy auto-import in SQLite-backed active flows.
- Verification alignment: **partial** on the broad file gate because unrelated existing failures remain in `tests/init.test.cjs` and `tests/memory.test.cjs`; touched legacy-memory behavior is **aligned** and passes rebuilt-runtime proof.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm run test:file -- tests/memory.test.cjs tests/init.test.cjs` still fails on unrelated existing tests: two `init new-milestone` snapshot failures and one `memory:prune only mutates file with --apply` failure. Recorded as pre-existing broad-gate baseline, not introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Active memory/runtime paths now match the phase intent and are ready for follow-on compatibility cleanup.
- Remaining concern: the broader touched-file gate still has unrelated baseline failures that should be addressed separately if Phase 174 needs clean full-file test runs.

## Self-Check: PASSED

- Found `.planning/phases/174-greenfield-compatibility-surface-cleanup/174-02-SUMMARY.md`.
- Verified task commits `2ca00784` and `075ae377` in `jj log`.

---
*Phase: 174-greenfield-compatibility-surface-cleanup*
*Completed: 2026-04-01*
