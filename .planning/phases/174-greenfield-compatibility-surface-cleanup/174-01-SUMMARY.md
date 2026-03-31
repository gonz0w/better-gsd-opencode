---
phase: 174-greenfield-compatibility-surface-cleanup
plan: 01
subsystem: cli
tags: [cli, config, command-discovery, docs, tdd]
requires:
  - phase: 173-simplification-audit-safe-sequencing
    provides: cleanup sequencing for low-blast-radius command-surface removals
provides:
  - util:config-migrate removed from router, help, discovery, and docs
  - canonical config guidance now points to validate-config plus direct config edits
affects: [175-canonical-command-surface-alignment, docs, command-integrity]
tech-stack:
  added: []
  patterns:
    - retire routed command surfaces by deleting router, help, discovery, docs, tests, and rebuilt runtime artifacts together
key-files:
  created: []
  modified:
    - src/commands/misc.js
    - src/router.js
    - src/lib/constants.js
    - src/lib/commandDiscovery.js
    - docs/troubleshooting.md
    - docs/expert-guide.md
    - tests/infra.test.cjs
    - tests/integration.test.cjs
    - tests/validate-commands.test.cjs
    - bin/bgsd-tools.cjs
    - bin/manifest.json
    - plugin.js
key-decisions:
  - "Delete util:config-migrate outright so invocation falls through the normal unknown-command path instead of preserving a stub."
  - "Teach canonical config validation/editing with verify:validate-config, util:config-set, and manual config edits rather than a migration helper."
patterns-established:
  - "Retired command surfaces must be removed from routing, help, discovery, docs, tests, and rebuilt bundles in one slice."
requirements-completed: [CLEAN-01]
one-liner: "Removed the retired util:config-migrate CLI surface and replaced config guidance with canonical validate/edit workflows."
duration: 6 min
completed: 2026-03-31
---

# Phase 174 Plan 01: Retire the config migration command surface Summary

**Removed the retired util:config-migrate CLI surface and replaced config guidance with canonical validate/edit workflows.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T23:47:07Z
- **Completed:** 2026-03-31T23:53:25Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Added RED regressions that fail if `util:config-migrate` remains routable, help-visible, or discovery-visible.
- Removed the migration command implementation plus router/help/discovery entries and rebuilt the local runtime artifacts.
- Rewrote troubleshooting and expert guidance to the canonical config workflow; **intent alignment:** aligned with Phase 174's greenfield-only cleanup posture.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED regressions for the retired config migration surface** - `5d79e6f` (test)
2. **Task 2: Remove the command, help text, and troubleshooting guidance together** - `36ea7ec` (fix)

## TDD Audit Trail

### RED
- **Commit:** `5d79e6f` (test: add failing regressions for config-migrate retirement)
- **GSD-Phase:** red
- **Target command:** node --test tests/infra.test.cjs tests/integration.test.cjs tests/validate-commands.test.cjs --test-name-pattern "config-migrate|canonical config|discovery inventory"
- **Exit status:** `1`
- **Matched evidence:** `Retired util:config-migrate should be absent from available commands`

### GREEN
- **Commit:** `36ea7ec` (fix: retire config-migrate command surface)
- **GSD-Phase:** green
- **Target command:** npm run test:file -- tests/infra.test.cjs tests/integration.test.cjs tests/validate-commands.test.cjs
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 109`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "5d79e6f", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/infra.test.cjs tests/integration.test.cjs tests/validate-commands.test.cjs --test-name-pattern \"config-migrate|canonical config|discovery inventory\"",
      "exit_code": 1,
      "matched_evidence_snippet": "Retired util:config-migrate should be absent from available commands"
    }
  },
  "green": {
    "commit": { "hash": "36ea7ec", "gsd_phase": "green" },
    "proof": {
      "target_command": "npm run test:file -- tests/infra.test.cjs tests/integration.test.cjs tests/validate-commands.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ℹ pass 109"
    }
  }
}
```

## Files Created/Modified
- `src/commands/misc.js` - removed `cmdConfigMigrate()` and its export
- `src/router.js` - removed `util:config-migrate` routing and help fallback text
- `src/lib/constants.js` - removed `util:config-migrate` help entry
- `src/lib/commandDiscovery.js` - removed `config-migrate` from command-registry validation inventory
- `docs/troubleshooting.md` - replaced migration-helper guidance with validate/edit instructions
- `docs/expert-guide.md` - removed migration-helper config management guidance
- `tests/infra.test.cjs` - asserted help output and invocation reject the retired command
- `tests/integration.test.cjs` - locked canonical config validation/edit workflow behavior
- `tests/validate-commands.test.cjs` - locked discovery/doc integrity against reintroducing `config-migrate`
- `bin/bgsd-tools.cjs` - rebuilt CLI bundle after command-surface removal
- `bin/manifest.json` - regenerated manifest during build
- `plugin.js` - rebuilt plugin artifact during build

## Decisions Made
- Deleted the retired command surface instead of preserving a stub because Phase 174 requires migration-only helpers to disappear from the supported product.
- Updated user guidance in the same slice as the code removal so canonical config teaching stays aligned rather than leaving stale migration instructions behind.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - rebuilt runtime artifacts were part of the expected verification path because targeted proof exercises the generated CLI bundle.

## Next Phase Readiness

- Plan 174-01 is **aligned** with phase intent: the repo now exposes one canonical config workflow instead of a migration-era helper.
- Phase 175 can build on the reduced command/help/discovery surface without carrying `util:config-migrate` drift forward.

## Self-Check

PASSED

- Verified summary file plus all touched source, docs, tests, and rebuilt runtime artifacts exist.
- Verified task commits `5d79e6f` and `36ea7ec` exist in repository history.

---
*Phase: 174-greenfield-compatibility-surface-cleanup*
*Completed: 2026-03-31*
