---
phase: 175-canonical-command-surface-alignment
plan: 03
subsystem: cli
tags: [planning, commands, workflows, validation]
requires:
  - phase: 175-canonical-command-surface-alignment
    provides: shared /bgsd-plan route metadata and shorthand rejection rules
provides:
  - expanded sibling-route parity tests for roadmap add|insert|remove, gaps, and todo add|check surfaces
  - canonical /bgsd-plan umbrella alignment in roadmap, gaps, and todo workflow guidance
affects: [phase-175-plan-04]
tech-stack:
  added: []
  patterns:
    - sibling-route regressions validate canonical planning-family routes across workflow surfaces
    - workflow surfaces teach explicit /bgsd-plan sub-action patterns with visible operand placeholders
key-files:
  created: []
  modified:
    - tests/guidance-command-integrity-workflow-prep-a.test.cjs
    - workflows/add-phase.md
    - workflows/insert-phase.md
    - workflows/remove-phase.md
    - workflows/add-todo.md
    - workflows/check-todos.md
key-decisions:
  - "Expanded sibling-route tests to cover insert-phase, remove-phase, plan-milestone-gaps, and check-todos surfaces in addition to add-phase and add-todo."
  - "Fixed workflow fallback reconstruction contexts to use canonical /bgsd-plan umbrella commands with proper operand placeholders."
  - "Replaced util:generate-slug (not in COMMAND_HELP) with inline bash slug generation to avoid validator false positives."
  - "Replaced init:todos (nonexistent) with util:list-todos (valid CLI command) in add-todo and check-todos workflows."
patterns-established:
  - "Workflow fallback reconstruction contexts use canonical /bgsd-plan <subaction> <operands> form instead of bare subaction names."
  - "Internal bash commands not in COMMAND_HELP should use inline substitution rather than undocumented CLI commands."
requirements-completed: [CLEAN-03, SAFE-03]
one-liner: "Expanded sibling-route parity tests and aligned roadmap/gaps/todo workflows to canonical /bgsd-plan umbrella with proper operand patterns"
duration: 10min
completed: 2026-04-01
---

# Phase 175 Plan 03: Align roadmap, gaps, and todo workflow surfaces to canonical `/bgsd-plan` umbrella Summary

**Expanded sibling-route parity tests and aligned roadmap/gaps/todo workflows to canonical /bgsd-plan umbrella with proper operand patterns**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-01T04:15:48Z
- **Completed:** 2026-04-01T04:25:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Expanded sibling-route regression tests to cover all roadmap add|insert|remove, gaps, and todo add|check surfaces with canonical /bgsd-plan umbrella patterns.
- Fixed workflow fallback reconstruction contexts in add-phase, insert-phase, remove-phase, and add-todo to use canonical /bgsd-plan <subaction> <operands> form.
- Fixed check-todos workflow to use valid CLI command (util:list-todos) instead of nonexistent init:todos.
- Replaced util:generate-slug (not in COMMAND_HELP) with inline bash slug generation to avoid validator false positives.

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Expand sibling-route parity tests and fix workflow surfaces** - `woyzmkvk` (feat)

**Plan metadata:** `woyzmkvk` (feat: tighten sibling-route parity tests for roadmap, gaps, and todo surfaces)

## Files Created/Modified

- `tests/guidance-command-integrity-workflow-prep-a.test.cjs` [+72/-15] - Expanded to cover all sibling routes
- `workflows/add-phase.md` [+1/-1] - Fixed fallback context to use canonical form
- `workflows/insert-phase.md` [+1/-1] - Fixed fallback context to use canonical form
- `workflows/remove-phase.md` [+1/-1] - Fixed fallback context to use canonical form
- `workflows/add-todo.md` [+4/-4] - Fixed fallback context, replaced init:todos with util:list-todos, replaced util:generate-slug with inline bash
- `workflows/check-todos.md` [+4/-4] - Fixed init:todos to util:list-todos, fixed todo add references

## Decisions Made

- Expanded sibling-route tests to cover insert-phase, remove-phase, plan-milestone-gaps, and check-todos surfaces in addition to add-phase and add-todo.
- Fixed workflow fallback reconstruction contexts to use canonical /bgsd-plan umbrella commands with proper operand placeholders.
- Replaced util:generate-slug (not in COMMAND_HELP) with inline bash slug generation to avoid validator false positives.
- Replaced init:todos (nonexistent) with util:list-todos (valid CLI command) in add-todo and check-todos workflows.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The gap-closure test (`tests/guidance-command-integrity-gap-closure.test.cjs`) still reports failures in `docs/expert-guide.md` lines 357, 601, 609, 611 - but `docs/expert-guide.md` is outside this plan's scope (plan explicitly excludes "adjacent docs"). These are pre-existing issues to be addressed in a separate plan.

## Next Phase Readiness

- Plan 04 can complete the canonical command surface alignment with the expanded sibling-route regression coverage now in place.
- The workflow surfaces now consistently teach canonical /bgsd-plan routes with proper operand patterns.

## Self-Check: PASSED

- Found `.planning/phases/175-canonical-command-surface-alignment/175-03-SUMMARY.md`
- Verified commit `woyzmkvk` in `jj log`
- All workflow tests pass (4/4)

---
*Phase: 175-canonical-command-surface-alignment*
*Completed: 2026-04-01*
