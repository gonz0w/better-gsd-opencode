---
phase: 174-greenfield-compatibility-surface-cleanup
plan: 07
subsystem: core
tags: [nl, docs, workflows, command-integrity, cli]

# Dependency graph
requires:
  - phase: 174-04
    provides: workspace-first docs regression posture for surfaced guidance
  - phase: 174-05
    provides: initial NL cleanup baseline for hidden command mappings
provides:
  - Hidden NL helpers now point at canonical slash-command routes instead of unsupported internal command names
  - Surfaced command reference and workflow docs avoid workflow-private bootstrap routes in public guidance
  - Command-integrity regressions catch both hidden command drift and surfaced canonical guidance drift
affects: [phase-175-command-surface-alignment, nl, docs, workflows, command-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - canonical slash-command guidance across hidden NL helpers and surfaced docs
    - command-integrity regressions that cover both hidden helper drift and public guidance drift

key-files:
  created: []
  modified:
    - tests/validate-commands.test.cjs
    - src/lib/nl/command-registry.js
    - src/lib/nl/help-fallback.js
    - src/lib/nl/suggestion-engine.js
    - src/lib/nl/conversational-planner.js
    - src/lib/nl/nl-parser.js
    - docs/commands.md
    - docs/workflows.md

key-decisions:
  - "Hidden NL discovery should emit canonical slash-command routes like `/bgsd-execute-phase` and `/bgsd-verify-work`, not unsupported internal command names."
  - "Public docs should describe workflow-private bootstrap commands conceptually instead of teaching them as runnable CLI examples."

patterns-established:
  - "Hidden fallback surfaces must stay aligned with the surfaced canonical slash-command families."
  - "Docs that mention internal bootstrap routes should frame them as workflow-private implementation details, not executable user guidance."

requirements-completed: [CLEAN-03]
one-liner: "NL helpers and surfaced command guidance now agree on canonical slash-command routes, with regressions blocking hidden internal names and stale workflow-private public examples."

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 174 Plan 07: Close GAP-174-02 and GAP-174-03 by finishing the remaining canonical command-integrity cleanup across hidden NL/fallback helpers and the surfaced docs/workflow guidance they drifted from. Summary

**NL helpers and surfaced command guidance now agree on canonical slash-command routes, with regressions blocking hidden internal names and stale workflow-private public examples.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T01:46:27Z
- **Completed:** 2026-04-01T01:51:12Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added failing command-integrity regressions for the remaining hidden NL drift and for surfaced canonical guidance drift tied to GAP-174-02 and GAP-174-03.
- Repointed the touched NL registry, parser, planner, suggestion, and fallback helpers to canonical slash-command routes instead of unsupported internal command names.
- Removed workflow-private bootstrap examples from public docs so the surfaced command story stays aligned with the supported canonical routes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED command-integrity coverage for the remaining hidden and surfaced drift** - `75917e95` (test)
2. **Task 2: Remove unsupported hidden mappings from the touched NL and fallback helpers** - `0b27f7d2` (feat)
3. **Task 3: Rewrite surfaced docs and workflows to the canonical command surface** - `335f2d02` (docs)

**Additional verification fix:** `d4235f5d` (fix)

## Files Created/Modified

- `tests/validate-commands.test.cjs` - Extends command-integrity coverage for hidden NL drift, surfaced docs drift, and rebuilt-runtime alias classification.
- `src/lib/nl/command-registry.js` - Replaces unsupported internal command names with canonical slash-command routes in phrases and aliases.
- `src/lib/nl/help-fallback.js` - Aligns fallback suggestions to surfaced canonical slash commands.
- `src/lib/nl/suggestion-engine.js` - Keeps command categorization and next-action suggestions aligned with canonical slash-command routes.
- `src/lib/nl/conversational-planner.js` - Updates planner-side intent classification to match canonical execution and verification routes.
- `src/lib/nl/nl-parser.js` - Maps canonical slash-command outputs back to the correct intent families.
- `docs/commands.md` - Removes workflow-private bootstrap examples from public CLI guidance.
- `docs/workflows.md` - Reframes bootstrap-route discussion as internal workflow behavior instead of runnable surfaced guidance.

## Decisions Made

- Keep hidden NL helpers on the same slash-command surface users see in docs so command discovery does not preserve a split-brain internal alias layer.
- Treat `init:*` workflow bootstrap routes as internal implementation details in public docs because command-integrity validation should only bless supported surfaced commands.
- Intent alignment: **aligned** — the touched hidden and surfaced command surfaces now reinforce the same canonical command story.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired a rebuilt-runtime regression assertion after the final build gate**
- **Found during:** Task 3 (Rewrite surfaced docs and workflows to the canonical command surface)
- **Issue:** After `npm run build`, the broad `tests/validate-commands.test.cjs` gate exposed that the existing legacy alias assertion expected `nonexistent-command` while the validator now correctly reports `legacy-command`.
- **Fix:** Updated the touched command-integrity test to match the current validator classification without weakening the regression intent.
- **Files modified:** `tests/validate-commands.test.cjs`
- **Verification:** `npm run test:file -- tests/validate-commands.test.cjs`
- **Committed in:** `d4235f5d`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The follow-up kept the rebuilt-runtime verification gate green without changing planned product scope.

## Issues Encountered

- `npm run build` initially failed in the execution workspace because `esbuild` was not installed there. Running `npm install` in the workspace resolved the local verification environment and the subsequent build succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 175 can build on NL and surfaced command guidance that now agree on canonical slash-command routes.
- The touched command-integrity suite now blocks reintroduction of unsupported hidden mappings and public workflow-private command examples.

## Self-Check

PASSED

- Found `.planning/phases/174-greenfield-compatibility-surface-cleanup/174-07-SUMMARY.md`
- Found `tests/validate-commands.test.cjs`, `src/lib/nl/command-registry.js`, and `docs/commands.md`
- Verified task commits `75917e95`, `0b27f7d2`, `335f2d02`, and `d4235f5d` in `jj log`
