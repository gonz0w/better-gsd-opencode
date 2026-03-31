# Phase 170: cmux Workspace Detection & Safe Targeting - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Add the first plugin-side `cmux` detection and targeting layer so bGSD only writes ambient workspace updates when it can prove the correct reachable workspace.
- **Expected User Change:** Before: bGSD had no trusted `cmux` targeting contract, so ambient integration either did not exist or could not be safely introduced. After: users who start OpenCode inside the managed `cmux` terminal get workspace-scoped integration only when exact workspace proof and a reachable write path exist; when proof is missing, conflicting, or unreachable, bGSD stays on normal behavior without guessing. Examples: starting inside the managed terminal enables Phase 170 targeting checks; a multi-workspace ambiguity suppresses writes instead of picking one; non-`cmux` or unreachable `cmux` sessions continue unchanged while logs explain suppression during testing.
- **Non-Goals:**
  - Building rich per-agent `cmux` panes or agent-level identity views.
  - Shipping sidebar status, progress, log, or notification UX beyond the safe targeting foundation needed by later phases.
  - Optimizing adjacent-shell or "alongside" startup paths as a primary experience in this phase.
</phase_intent>

<domain>
## Phase Boundary
Phase 170 delivers detection, proof, and safe workspace targeting for `cmux` at the workspace level. It decides when integration is allowed to turn on, how to avoid cross-workspace leakage, and how to fail open when targeting is unsafe or unavailable. It does not broaden into later ambient UX surfaces or deeper orchestration visuals.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Safe targeting gate - Locked. Enable `cmux` integration only when bGSD has strict proof of the exact target workspace and a verified reachable write path for that workspace. Reasoning: trust matters more than coverage in the first slice, and wrong-target writes would be worse than missing integration.
- Multi-workspace ambiguity - Locked. If multiple reachable workspaces exist and exact targeting proof is missing or conflicting, suppress updates instead of choosing a best guess. Reasoning: this directly satisfies the no-leak/no-overwrite requirement.
- Managed-terminal-first path - Locked. The expected primary path for Phase 170 is starting OpenCode inside the managed `cmux` terminal. Reasoning: this gives the safest and most repeatable identity signal for the first slice.

### Medium Decisions
- Alongside `cmux` support - Defaulted. Treat adjacent or alongside usage as compatibility-only: it may work when exact workspace proof still exists, but Phase 170 should not optimize or rely on it. Reasoning: keeps roadmap wording compatible without making fragile adjacent detection a first-slice success condition.
- Fallback visibility - Locked. Normal user-facing behavior stays quiet fail-open, while logs carry the explanation when integration is suppressed during testing or debugging. Reasoning: avoids noisy UX but still supports operator diagnosis.

### Low Defaults and Open Questions
- Workspace scope - Defaulted. Keep the first slice workspace-scoped only, with no per-agent detail.
- Suppression preference - Defaulted. When safety checks are inconclusive, suppress writes rather than degrade into heuristic targeting.

### Agent's Discretion
- The planner and researcher can choose the safest proof sources and adapter shape, but they must preserve the strict-proof gate, managed-terminal-first expectation, compatibility-only adjacent support, and quiet fail-open contract.
</decisions>

<specifics>
## Specific Ideas
- Use existing plugin lifecycle and persisted state as the source of truth instead of inventing a separate orchestration layer.
- Center validation on real multi-workspace `cmux` sessions because cross-workspace leakage is the main failure to avoid.
- Treat logs as the testing-time explanation surface when integration stays quiet.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Original decision: support alongside `cmux` usage in the first slice whenever adjacent context can prove the exact workspace.
- Stress-test revision: treat starting OpenCode inside the managed terminal as the expected primary path for Phase 170.
- Follow-on clarification: keep alongside usage as compatibility-only when exact proof exists, but do not optimize or rely on it for first-slice success.
- Original decision: quiet fail-open fallback with minimal breadcrumbs.
- Stress-test revision: keep the quiet fail-open UX, but rely on logs to explain why attachment did not happen during testing.
</stress_tested>

<deferred>
## Deferred Ideas
- Rich per-agent `cmux` visualization once child-agent identity proves reliable.
- Later-phase status, progress, log, and notification presentation policy beyond the targeting foundation.
</deferred>

---
*Phase: 170-cmux-workspace-detection-safe-targeting*
*Context gathered: 2026-03-31*
