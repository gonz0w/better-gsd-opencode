---
phase: 24-convention-extraction
plan: 02
subsystem: infra
tags: [codebase-intelligence, conventions, framework-detection, rules-generation, elixir-phoenix, cli]

# Dependency graph
requires:
  - phase: 24-convention-extraction
    plan: 01
    provides: "Convention extraction engine (naming, file-org, confidence scoring), extractConventions()"
provides:
  - "Extensible framework pattern registry (FRAMEWORK_DETECTORS) with Elixir/Phoenix detector"
  - "`codebase rules` CLI command generating agent-consumable rules document capped at 15 rules"
  - "generateRules() function for programmatic rules generation"
  - "detectFrameworkConventions() for framework-specific pattern detection"
affects: [26-init-integration, 27-task-scoped-context, 29-workflow-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [extensible-detector-registry, rules-generation-with-confidence-ranking, framework-detection-via-file-content]

key-files:
  created: []
  modified:
    - src/lib/conventions.js
    - src/commands/codebase.js
    - src/router.js
    - bin/gsd-tools.cjs
    - bin/gsd-tools.test.cjs

key-decisions:
  - "Framework detector registry as simple array — new frameworks added by pushing detector objects"
  - "Rules capped at 15 by default with --max override — prevents context bloat in agent prompts"
  - "codebase rules --raw outputs plain text for direct pipe into prompts"
  - "Auto-detect conventions on demand if intel has no cached conventions"

patterns-established:
  - "Extensible detector registry pattern: { name, detect, extractPatterns } objects in array"
  - "Rules generation: confidence-ranked, threshold-filtered, capped output for agent consumption"

requirements-completed: [CONV-03, CONV-05]

# Metrics
duration: 6min
completed: 2026-02-26
---

# Phase 24 Plan 02: Framework Detection + Rules Generation Summary

**Extensible framework pattern registry with Elixir/Phoenix detector and `codebase rules` command generating agent-consumable conventions document capped at 15 rules**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-26T14:25:31Z
- **Completed:** 2026-02-26T14:31:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created extensible FRAMEWORK_DETECTORS registry with Elixir/Phoenix detector (routes, schemas, plugs, contexts, migrations)
- Added `generateRules()` function that ranks conventions by confidence, filters by threshold, and caps at 15 rules
- Implemented `codebase rules` command with --threshold, --max, and --raw flags for agent prompt injection
- Added 6 comprehensive tests covering naming detection, file-org, confidence scoring, rules generation, cap enforcement, and CLI integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Framework pattern registry + Elixir detector** - `2730fdd` (feat)
2. **Task 2: `codebase rules` command + tests** - `794e4ff` (feat)

## Files Created/Modified
- `src/lib/conventions.js` — Added FRAMEWORK_DETECTORS registry, Elixir/Phoenix detector (5 pattern types), detectFrameworkConventions(), generateRules()
- `src/commands/codebase.js` — Added cmdCodebaseRules with --threshold, --max, --raw flags and auto-detection
- `src/router.js` — Extended codebase switch with `rules` subcommand
- `bin/gsd-tools.cjs` — Rebuilt bundle (598KB within 700KB budget)
- `bin/gsd-tools.test.cjs` — Added 6 tests in `codebase conventions` describe block

## Decisions Made
- Framework detector registry is a simple array of `{ name, detect, extractPatterns }` objects — adding a new framework requires only pushing a new detector, no other code changes
- Rules are capped at 15 by default (configurable via --max) to prevent overwhelming agent context windows
- `codebase rules --raw` outputs plain numbered text directly suitable for prompt injection, bypassing JSON formatting
- If intel has no cached conventions when rules is called, auto-runs extractConventions on demand

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Convention extraction phase complete — both naming/file-org detection (Plan 01) and framework/rules generation (Plan 02) delivered
- `codebase rules` ready for integration into Phase 26 (init integration) for automatic convention injection
- Framework detector registry ready for future framework additions (React, Go, Python/Django, etc.)
- Requirements CONV-01 through CONV-05 all addressed across Plans 01 and 02

---
*Phase: 24-convention-extraction*
*Completed: 2026-02-26*
