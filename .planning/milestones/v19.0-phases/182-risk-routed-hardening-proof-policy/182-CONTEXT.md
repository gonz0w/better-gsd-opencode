# Phase 182: Risk-Routed Hardening Proof Policy - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Define one explicit `verification_route` policy that routes runtime-hardening proof by risk across planning, execution, and verification artifacts.
- **Expected User Change:** Before: teams had to infer when a slice needed only structural proof, focused checks, or a broad regression run, and verifier output could blur what proof was actually missing. After: each implementation slice carries an explicit `verification_route`, high-risk hardening work defaults to heavier proof, lighter slices stay proportionate, and verifier output makes required vs non-required proof obvious. Examples: runtime, shared-state, and plugin changes default to `full`; docs, workflow, template, and guidance-only slices can complete without an automatic broad regression run; verifier can show regression proof as `not required` for a `skip` route instead of presenting it like a failure.
- **Non-Goals:**
  - Redesigning the broader verification system beyond this milestone's hardening-route policy
  - Inventing new route names or a second parallel proof taxonomy beyond `skip`, `light`, and `full`
  - Forcing every generated-artifact change into `full` without planner judgment about actual risk
</phase_intent>

<domain>
## Phase Boundary
Establish one explicit verification-route contract that planners, executors, and verifiers all use so proof expectations scale with change risk, especially for this milestone's runtime-hardening work.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Default classification — Locked. Runtime, shared-state, and plugin changes default to `full`; lower-risk docs, workflow, template, and guidance-only slices may use lighter routes; generated-artifact changes require planner judgment instead of automatic escalation. Reasoning: the policy needs predictable safety for the riskiest hardening work without forcing every artifact-adjacent change into the broadest proof path.
- Proof bundle by route — Locked. `skip` requires structural proof only, `light` requires focused behavior checks plus smoke regression, and `full` requires focused behavior checks plus broad regression. Reasoning: this keeps the route contract explicit enough for planning and verification while preserving meaningful cost differences between the three levels.

### Medium Decisions
- Verifier reporting — Locked. Verifier output always separates missing behavior proof, missing regression proof, and missing human verification into distinct buckets, while marking route-exempt buckets as `not required`. Reasoning: the roadmap explicitly calls for separation, and the route-aware annotation avoids false alarm noise on lighter paths.
- Override policy — Locked. Planners and executors may freely elevate a slice to a stricter route, but lowering a route from its default expectation requires explicit written justification. Reasoning: upward overrides are cheap safety, while downward overrides need auditability to prevent policy drift.
- Light-route enforcement — Locked. Verifier is responsible for rejecting vague or untargeted focused proof submitted for `light`. Reasoning: this keeps `light` from becoming a loophole while preserving the intended focused-plus-smoke contract.

### Low Defaults and Open Questions
- Artifact surface — Defaulted. Surface `verification_route` explicitly and consistently in planner, execution, and verifier artifacts rather than renaming or hiding it across stages.

### Agent's Discretion
- Choose the smallest implementation shape that preserves one shared route contract across planning, execution, and verification without adding a second policy layer.
</decisions>

<specifics>
## Specific Ideas
- Keep route vocabulary fixed as `skip`, `light`, and `full` everywhere this policy appears.
- Treat docs-, workflow-, template-, and guidance-only slices as eligible for structural or focused proof without defaulting to broad-suite reruns.
- When a generated-artifact slice stays below `full`, the planner should write why the artifact change is low-risk enough to avoid automatic escalation.
- Verifier output should preserve the three-bucket shape even on lighter routes, but non-required buckets must read as `not required`, not as failures.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Default classification changed during stress testing.
  - Original decision: any slice touching runtime, shared state, plugin behavior, or generated artifacts defaulted to the highest-risk route.
  - Stress-test revision: generated-artifact changes no longer auto-escalate to `full`; planner judgment decides their route.
  - Follow-on clarification: if a generated-artifact change stays below `full`, the planner must write the low-risk rationale explicitly.
- Light-route enforcement changed during stress testing.
  - Original decision: `light` required focused behavior checks plus smoke regression.
  - Stress-test revision: keep that proof bundle, but require verifier enforcement against vague or untargeted focused proof.
  - Follow-on clarification: verifier should reject `light` evidence that does not name and prove the touched behavior or risk precisely enough.
- Verifier reporting changed during stress testing.
  - Original decision: always show three explicit proof buckets.
  - Stress-test revision: keep the three-bucket shape, but mark route-exempt categories as `not required` instead of making them read like failures.
  - Follow-on clarification: route expectations must be visible directly in verifier output so power users can tell omission from exemption.
</stress_tested>

<deferred>
## Deferred Ideas
None - discussion stayed within phase scope.
</deferred>

---
*Phase: 182-risk-routed-hardening-proof-policy*
*Context gathered: 2026-04-01*
