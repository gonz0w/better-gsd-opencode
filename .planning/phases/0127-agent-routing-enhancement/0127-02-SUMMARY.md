---
phase: 127-agent-routing-enhancement
plan: 02
status: complete
completed: 2026-03-15
commit: 05c021e
---

# Plan 02 Summary: Contract Tests for Tool Routing Decision Functions

## What Was Built

**Task 1: Contract tests for tool routing decision functions (~38 tests)**

In `tests/decisions.test.cjs`:
- Added `Phase 127: Tool routing decision functions` describe block with three nested suites:
  - `resolveFileDiscoveryMode` — 12 tests covering all scope/availability combos, graceful defaults, HIGH confidence
  - `resolveSearchMode` — 13 tests covering ripgrep→fd→node fallback chain, gitignore logic, defaults
  - `resolveJsonTransformMode` — 10 tests covering simple/complex complexity, fallback chain, defaults
  - `DECISION_REGISTRY integration` — 4 tests confirming all three rules registered, evaluateDecisions fires correctly

**Task 2: Enricher integration tests for tool_availability (~17 tests)**

In `tests/enricher-decisions.test.cjs`:
- Added `Phase 127: tool_availability enrichment` describe block with two nested suites:
  - `tool_availability shape tests` — 8 tests confirming object type, 6 keys, boolean values, no version/path info, keys match TOOLS constant
  - `decision evaluation with tool_availability` — 4 tests confirming tool-routing rules fire, HIGH confidence, correct rule_ids, string values

## Verification

- `npm test` — all 1501 tests pass (55 new tests above 1446 baseline)
- Contract tests cover all input combinations for all three resolve functions
- DECISION_REGISTRY integration confirms proper registration and category
- evaluateDecisions aggregator fires all three rules when inputs present
- Enricher tests verify tool_availability is boolean-only (no version/path per CONTEXT.md)

## Self-Check: PASSED

All success criteria met:
- [x] Contract tests exist for all three resolve functions covering all input combinations
- [x] DECISION_REGISTRY integration tests confirm all three rules registered
- [x] Enricher tests confirm tool_availability shape with correct structure
- [x] Total test count increased by 55 from 1446 baseline (plan expected ~50)
- [x] All tests pass (zero failures)
- [x] SC-69 satisfied: new decision functions have comprehensive contract tests
