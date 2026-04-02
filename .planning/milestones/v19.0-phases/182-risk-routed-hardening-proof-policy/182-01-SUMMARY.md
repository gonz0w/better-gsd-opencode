---
phase: 182-risk-routed-hardening-proof-policy
plan: 01
subsystem: runtime
tags: [verification-routing, policy, plugin, workflow]
requires:
  - phase: 181-workspace-root-truth-safe-fallback
    provides: proof-first execution contract that phase 182 now routes by risk
provides:
  - policy-first verification-route normalization in `src/lib/decision-rules.js`
  - plugin enrichment that carries explicit route and proof-bundle metadata forward
  - execute-phase guidance aligned to the normalized `skip` / `light` / `full` contract
affects: [execute-phase, execute-plan, planner-verifier-contract]
tech-stack:
  added: []
  patterns: [policy-first verification routing, explicit downgrade rationale, proof-bundle metadata]
key-files:
  created: []
  modified:
    - src/lib/decision-rules.js
    - src/plugin/command-enricher.js
    - workflows/execute-phase.md
    - tests/decisions.test.cjs
    - tests/enricher-decisions.test.cjs
    - tests/workflow.test.cjs
key-decisions:
  - "Verification routing now resolves from touched-surface risk first and only falls back to size heuristics when richer metadata is absent."
  - "Lowering a route below its default risk expectation requires explicit written justification; otherwise runtime falls back to the safer default."
patterns-established:
  - "Route decisions should expose both the selected route and a required-proof bundle for behavior, regression, and human verification buckets."
  - "Plugin enrichment should carry normalized route metadata forward instead of recomputing proof scope from plan size."
requirements-completed: [TEST-01, TEST-02]
one-liner: "Policy-first verification routing now normalizes explicit proof buckets for risky runtime and plugin work"
duration: 1 run
completed: 2026-04-01
---

# Phase 182 Plan 01: Risk-Routed Hardening Proof Policy Summary

**Policy-first verification routing now normalizes explicit proof buckets for risky runtime and plugin work**

## Performance

- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Replaced the old plan-size verification heuristic with a shared risk-based resolver that emits route metadata and required proof buckets.
- Updated plugin enrichment so execution context carries explicit route, default-reason, and downgrade metadata from plan inputs.
- Tightened execute-phase guidance and route regression tests around `skip`, `light`, and `full` proof expectations.

## Task Commits

No git commits were created during this execution run.

## Verification

- **Focused verification:** `npm run build && node --test tests/decisions.test.cjs tests/enricher-decisions.test.cjs tests/verify.test.cjs tests/workflow.test.cjs`
- **Requirement Coverage:** TEST-01 and TEST-02 are covered by the shared resolver, plugin enrichment path, and execution-contract wording.
- **Intent Alignment:** aligned — risky runtime and plugin slices now default to heavier proof while lighter slices can remain proportionate with explicit route policy.

## Files Created/Modified
- `src/lib/decision-rules.js` - adds the policy-first verification-route resolver, downgrade handling, and required-proof metadata.
- `src/plugin/command-enricher.js` - forwards explicit route inputs from plan frontmatter and exposes normalized route metadata in enriched context.
- `workflows/execute-phase.md` - teaches executors the normalized structural, focused-plus-smoke, and full broad-regression proof contract.
- `tests/decisions.test.cjs` - locks risk-based routing defaults, downgrade justification, and proof-bundle metadata.
- `tests/enricher-decisions.test.cjs` - locks decision aggregation around explicit route policy inputs.
- `tests/workflow.test.cjs` - locks the route-aware workflow/report wording contract.

## Decisions Made
- Runtime, shared-state, and plugin-facing changes now default to `full` through one shared resolver.
- Docs-only slices default to `skip`, workflow/template slices default to `light`, and generated runtime artifacts follow surrounding source risk.
- Unjustified downward overrides no longer silently reduce proof scope.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Planner and verifier surfaces can now consume one normalized route contract instead of re-deriving proof scope independently.
- Plan 02 can enforce explicit route metadata and render route-exempt proof buckets honestly in verification artifacts.

## Self-Check

PASSED

- FOUND: `.planning/phases/182-risk-routed-hardening-proof-policy/182-01-SUMMARY.md`
- VERIFIED: focused phase 182 test suite and build passed

---
*Phase: 182-risk-routed-hardening-proof-policy*
*Completed: 2026-04-01*
