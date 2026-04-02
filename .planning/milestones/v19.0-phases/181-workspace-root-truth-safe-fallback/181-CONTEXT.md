# Phase 181: Workspace Root Truth & Safe Fallback - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Runtime-prove that workspace-targeted execution is pinned to the intended JJ workspace before parallel work can begin, and fall back safely when that proof is missing.
- **Expected User Change:** Before: operators could trust workspace targeting only from prompt guidance and surrounding behavior. After: operators get an explicit pre-work proof gate for workspace-targeted runs, and any run that cannot prove the intended workspace downgrades before plan work starts. Examples: a parallel run proceeds only when the intended workspace path, executor realpath, and `jj workspace root` all agree; a run started from a subdirectory downgrades to sequential instead of claiming parallel pinning was proven; repo-relative reads, writes, and plan-local artifacts resolve inside the assigned workspace while workspace mode is active.
- **Non-Goals:**
  - Defining the later risk-based verification routing for this milestone's runtime hardening work
  - Designing a broader JJ workspace UX beyond proof, containment, and safe fallback before work starts
  - Reopening roadmap or command-surface scope unrelated to workspace-root truth and fallback behavior
</phase_intent>

<domain>
## Phase Boundary
Prove that a workspace-targeted executor is actually operating in the intended JJ workspace before parallel execution is allowed, keep workspace-mode repo-relative operations contained inside that workspace, and downgrade safely to the supported sequential path before work begins when proof is missing.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Proof contract — Locked. Parallel execution unlocks only when the intended workspace path, the executor `cwd` realpath, and `jj workspace root` all match. Reasoning: Phase 181 is about runtime proof before work begins, so weaker checks leave too much ambiguity about actual workspace targeting.
- Fallback behavior — Locked. If that strict proof is not established, the run downgrades to the supported sequential path before any plan work begins and shows an explicit reason to the operator. Reasoning: this preserves the roadmap's fail-safe fallback without blocking supported sequential execution.

### Medium Decisions
- Containment boundary — Locked. While workspace mode is active, all repo-relative reads, writes, and plan-local artifact output resolve through the assigned workspace root. Reasoning: the success criteria explicitly include reads, writes, and artifact output, so partial routing would leave containment under-specified.
- Failure classification — Defaulted. Treat all pre-work workspace proof and availability problems as one generic fallback case everywhere. Reasoning: the supported outcome is the same either way, and the extra distinction did not justify added complexity after stress testing.

### Low Defaults and Open Questions
- Operator visibility — Defaulted. Surface the intended workspace, observed executor `cwd`, observed `jj workspace root`, and the fallback reason in the pre-work message.

### Agent's Discretion
- Choose the least invasive implementation shape that enforces full workspace-rooted containment without weakening the locked safety boundary.
</decisions>

<specifics>
## Specific Ideas
- Strict triple match is the unlock condition for parallel execution, not a reason to abort supported sequential work.
- A subdirectory start inside the correct workspace should downgrade to sequential with an explicit reason rather than claiming full workspace proof.
- Existing helpers that assume one global repo root should adapt to the workspace-root truth requirement rather than creating holes in containment.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Proof contract held under stress testing.
  - Original decision: strict triple match required for parallel execution.
  - Stress-test revision: none.
  - Follow-on clarification: strict triple match is only the unlock condition for parallel execution; otherwise the run safely downgrades to sequential with an explicit reason.
- Containment boundary held under stress testing.
  - Original decision: all repo-relative operations stay workspace-rooted while workspace mode is active.
  - Stress-test revision: none.
  - Follow-on clarification: helpers that assume a global repo root should be adapted rather than weakening containment.
- Failure classification changed during stress testing.
  - Original decision: distinguish `workspace unavailable` from `proof mismatch`, but downgrade both to sequential.
  - Stress-test revision: collapse all pre-work workspace proof and availability problems into one generic fallback case everywhere.
  - Follow-on clarification: remove the distinction completely rather than keeping an internal-only split.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---
*Phase: 181-workspace-root-truth-safe-fallback*
*Context gathered: 2026-04-01*
