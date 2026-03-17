# Phase 139: End-to-End Validation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary
Automated test coverage proving the full tool detection → context enrichment → workflow behavior chain works correctly. Two test types: an E2E test proving decision rule outputs differ based on tool availability, and a contract test proving every Chain B decision rule has at least one workflow or agent consumer.
</domain>

<decisions>
## Implementation Decisions

### E2E Test Design
- Test through the built CLI (`bgsd-tools.cjs`) using `decisions:evaluate` with `--state` JSON — avoids ES module import issues, tests the actual built artifact
- Call each Chain B decision rule with tools-present state and tools-absent state, assert the `.value` fields differ (e.g., `file-discovery-mode` returns `fd` vs `node`)
- Direct value comparison on decision outputs — no snapshot diffing, no workflow file parsing in E2E
- Existing `cli-tools-integration.test.cjs` already covers detector → enricher wiring; E2E adds the decision rule evaluation layer

### Contract Test Design
- Prove every Chain B decision rule has at least one consumer in `workflows/` or `agents/` directories
- Consumer detection via decision pattern match: look for `decisions.{rule-id}` or `decisions.{rule-id}.value` in `.md` files
- Also search for `tool_availability` direct references as an alternative consumption pattern (some agents like debugger read tool_availability directly rather than through decisions)
- Scan scope: `workflows/` and `agents/` directories only — planning docs are documentation, not consumers
- Identify Chain B rules dynamically by filtering the decision registry for rules whose `inputs` array contains `tool_availability` — automatically catches new tool-routing rules added in the future

### Test File Organization
- E2E test: add to existing `tests/cli-tools-integration.test.cjs` (extends existing detection test patterns)
- Contract test: new file `tests/tool-routing-contract.test.cjs` (fundamentally different concern — static file analysis vs runtime behavior)
- Split rationale: E2E extends detection testing patterns; contract test is static analysis of file contents — different test categories

### Mock Strategy
- E2E: no mocking needed — `decisions:evaluate --state '{...}'` accepts tool_availability directly via CLI flag
- Contract: no mocking needed — pure static analysis reading real source files from repo (`workflows/`, `agents/`)
- Read from repo source files (not deploy path) — works in CI, no deployment dependency

### Agent's Discretion
- Exact assertion count and test naming within the describe blocks
- Whether to use helper functions for repeated CLI invocations
- Selection of specific tool combinations for edge case testing (e.g., partial availability scenarios)
</decisions>

<specifics>
## Specific Ideas
- Use `decisions:evaluate file-discovery-mode --state '{"tool_availability":{"fd":true},"scope":"project-wide"}'` pattern for E2E assertions
- Filter registry by `inputs.includes('tool_availability')` to identify Chain B rules dynamically
- Pattern for consumer detection: regex like `decisions\.{rule-id}` and `tool_availability` in workflow/agent .md files
</specifics>

<stress_tested>
## Stress-Tested Decisions
- **Consumer pattern scope expanded:** Originally planned to only search for `decisions.{rule-id}` patterns. Stress test revealed some consumers (debugger agent) reference `tool_availability` directly. Decision updated to search for both patterns.
- **Dynamic rule filtering confirmed:** Stress test validated that filtering by `tool_availability` in inputs (rather than hardcoding 4 rule IDs) automatically catches future tool-routing rules.
- **Repo source files over deploy path:** Stress test confirmed reading from repo `workflows/` and `agents/` rather than deployed files — works in CI, no stale deploy risk.
- **E2E gap accepted:** Enricher wiring (command-enricher.js calling evaluateDecisions) is covered by existing integration tests, not duplicated in the new E2E test.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope
</deferred>

---
*Phase: 139-end-to-end-validation*
*Context gathered: 2026-03-17*
