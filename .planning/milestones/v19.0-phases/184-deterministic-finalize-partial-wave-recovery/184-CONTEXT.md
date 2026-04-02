# Phase 184: Deterministic Finalize & Partial-Wave Recovery - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Make shared planning promotion deterministic across sibling workspaces while preserving inspectable recovery for stale, divergent, or partially failed siblings.
- **Expected User Change:** Before: shared finalize behavior could depend on sibling timing and operators had to infer how partial-wave failures affected healthy work. After: healthy siblings complete into a deterministic staged/finalize flow, shared state stays explicitly recovery-needed when a sibling blocks promotion, and operators can inspect one canonical recovery summary that names the gating sibling, blocking reason, next command, and links to deeper proof artifacts. Examples: a later healthy sibling can finish without being promoted past an earlier unhealthy sibling; rerunning finalize from trusted main-checkout preserves already-healthy staged work instead of requiring re-execution; the operator can open one summary artifact and immediately see which earlier sibling is blocking wave progress.
- **Non-Goals:**
  - Build a new generalized task or incident management system beyond finalize/recovery artifacts for this phase.
  - Add new `cmux` lifecycle signaling or UI polish beyond the recovery/finalize state contract needed here.
  - Reopen workspace-local execution isolation or shared-planning ownership rules already established in Phase 183.
</phase_intent>

<domain>
## Phase Boundary
This phase delivers deterministic sibling finalize behavior plus durable partial-wave recovery metadata, so healthy workspace results stay usable without falsely marking the whole wave complete.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Finalize ordering — Defaulted, then revised during stress test. Original planned wave order remains the canonical deterministic ordering rule, but later healthy siblings stop at a staged-ready state instead of promoting shared state past the first earlier unhealthy sibling. This preserves deterministic promotion order without requiring later healthy work to be re-executed.
- Partial-wave completion policy — Locked. Finalize healthy siblings in canonical order when possible, but shared state must remain explicitly marked recovery-needed until unhealthy siblings are resolved. This preserves earned progress without implying the full wave completed cleanly.
- Recovery metadata contract — Locked. Use one canonical recovery summary per wave/workspace for fast inspection, and that summary must include current status, blocking reason, next command, links to deeper proof artifacts, and the exact earlier sibling currently gating wave progress. This keeps recovery inspectable without forcing operators to reconstruct the story from raw manifests.

### Medium Decisions
- Idempotent rerun behavior — Delegated. Planner/implementation should prefer rerun/recovery behavior that preserves already-healthy staged work and avoids unnecessary re-execution, as long as shared-state promotion still recomputes deterministically from trusted main-checkout state.
- Failure classification surface — Delegated. Operator-facing output should distinguish stale, divergent, proof-missing, quarantine, and finalize-failed states clearly enough that recovery summaries and follow-up commands are unambiguous.

### Low Defaults and Open Questions
- Recovery entrypoint — Defaulted. Recovery and finalize reruns happen from trusted main-checkout state, not from inside a target workspace.
- Default inspect path — Defaulted. Summary-first inspection is the default, with direct proof review required for risky or shared-state completion claims.
- Recovery artifact retention — Untouched. Retention/cleanup policy can follow existing project patterns unless planning reveals a concrete conflict.

### Agent's Discretion
- Exact staged-ready status naming and any minimal manifest fields beyond the locked recovery summary contract.
- The concrete shape of the deterministic rerun algorithm, provided it does not promote later siblings ahead of an earlier blocking sibling.
</decisions>

<specifics>
## Specific Ideas
- Recovery-needed is considered a strong enough signal for downstream agents that a wave is not done.
- Strict wave order was stress-tested and narrowed into a staged-not-promoted rule for later healthy siblings blocked by an earlier unhealthy sibling.
- Operators should not need to inspect multiple low-level artifacts just to learn what blocked finalize.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Finalize ordering
  - Original decision: finalize healthy siblings strictly in planned wave order, even if a later sibling finished first.
  - Stress-test revision: later healthy siblings may still finish, but they stop at staged-ready and do not promote shared state past the first earlier unhealthy sibling.
  - Follow-on clarification: the canonical recovery summary must name the exact earlier sibling gating wave progress so strict ordering remains inspectable.
- Partial-wave state marker
  - Original decision: healthy progress can be preserved while shared state remains recovery-needed.
  - Stress-test result: held. Recovery-needed remains the explicit signal that the wave is not done.
- Recovery inspection surface
  - Original decision: use one canonical summary for fast inspection.
  - Stress-test result: refined. The summary must surface the gating sibling and blocking reason directly instead of making operators infer them from plan order.
</stress_tested>

<deferred>
## Deferred Ideas
None - discussion stayed within phase scope.
</deferred>

---
*Phase: 184-deterministic-finalize-partial-wave-recovery*
*Context gathered: 2026-04-01*
