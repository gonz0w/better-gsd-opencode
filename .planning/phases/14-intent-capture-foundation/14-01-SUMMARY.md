---
phase: 14-intent-capture-foundation
plan: 01
subsystem: intent
tags: [intent, parser, cli, xml-sections, template]

requires:
  - phase: 13-test-infrastructure-polish
    provides: test suite and build pipeline
provides:
  - INTENT.md template reference document
  - parseIntentMd() and generateIntentMd() parser functions
  - intent create command with --force flag
  - Router wiring for intent command family
affects: [14-02, 14-03, 15-intent-tracing]

tech-stack:
  added: []
  patterns: [XML-tagged sections, ID-format parsing (DO-XX, SC-XX, C-XX, HM-XX)]

key-files:
  created:
    - templates/intent.md
    - src/commands/intent.js
  modified:
    - src/lib/helpers.js
    - src/lib/constants.js
    - src/router.js
    - bin/gsd-tools.cjs

key-decisions:
  - "HTML comments as section instructions in generated INTENT.md (no pre-filled examples)"
  - "Graceful degradation in parser — missing sections return null/empty defaults"
  - "Pattern-matched ID extraction: DO-XX [PX], SC-XX, C-XX, HM-XX with regex"

patterns-established:
  - "XML section tags for structured intent parsing"
  - "Separate reference doc (templates/) from code-generated content (helpers.js)"

requirements-completed: [ICAP-01, ICAP-02]

duration: 6min
completed: 2026-02-25
---

# Phase 14 Plan 01: Template + Parser + Create Command Summary

**INTENT.md template reference doc with 6 XML-tagged sections, parseIntentMd/generateIntentMd parser pair, and intent create command with --force protection and auto-commit**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-25T04:18:46Z
- **Completed:** 2026-02-25T04:25:23Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Template reference doc (180 lines) covering all 6 sections, ID formats, revision tracking, gap preservation, and 2 complete examples
- Parser round-trips: parseIntentMd(generateIntentMd(data)) preserves all 18 checked fields
- `intent create` produces valid INTENT.md with all sections, respects --force flag, auto-commits when commit_docs enabled
- 297 existing tests still pass, bundle at 386KB (within 400KB budget)

## Task Commits

Each task was committed atomically:

1. **Task 1: INTENT.md template reference document** - `e4be0a7` (feat)
2. **Task 2: Intent parser and create command** - `88e4d28` (feat)

## Files Created/Modified
- `templates/intent.md` - Reference doc with format definition, ID tables, rules, and 2 complete examples
- `src/commands/intent.js` - Intent command module with cmdIntentCreate()
- `src/lib/helpers.js` - parseIntentMd() and generateIntentMd() functions
- `src/lib/constants.js` - COMMAND_HELP entry for intent command
- `src/router.js` - case 'intent' routing to create subcommand
- `bin/gsd-tools.cjs` - Rebuilt bundle (386KB)

## Decisions Made
- HTML comments as section instructions (matching user decision: no pre-filled example content)
- Graceful degradation in parser: missing sections return null/empty defaults (robustness)
- Regex-based XML extraction: `<tag>([\s\S]*?)</tag>` pattern (simple, reliable for well-formed intent files)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Parser (parseIntentMd/generateIntentMd) ready for Plan 02's show/read and update commands
- Router wired for intent command family — Plan 02 adds show/update subcommands
- Template reference doc available for agents creating INTENT.md files

---
*Phase: 14-intent-capture-foundation*
*Completed: 2026-02-25*
