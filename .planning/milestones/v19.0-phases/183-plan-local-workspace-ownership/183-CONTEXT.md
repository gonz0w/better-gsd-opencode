# Phase 183: Plan-Local Workspace Ownership - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Define a plan-local workspace execution model where parallel work stays isolated until one explicit finalize path promotes trusted results into shared planning state.
- **Expected User Change:** Before: parallel workspace runs could create ambiguity about whether shared planning artifacts were being updated during execution. After: operators can let workspaces run in parallel, inspect workspace-local summaries/proof, and trust that shared `.planning/STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md` only change through the single finalize path. Examples: (1) a workspace finishes and writes its summary/proof only inside its own workspace; shared planning files remain unchanged, (2) operator reviews workspace summaries before canonical progress is declared complete, (3) routine well-evidenced work auto-finalizes without adding a new manual approval step, but ambiguity/conflict still stops for human review.
- **Non-Goals:**
  - Add a new general task-management or settings surface outside planning-family behavior
  - Allow reconcile or workspace execution to write authoritative shared `.planning/` state directly
  - Optimize for partial per-workspace promotion instead of clean atomic workspace finalize behavior
</phase_intent>

<domain>
## Phase Boundary
This phase delivers ownership rules for parallel workspaces: execution artifacts remain workspace-local, operators inspect results before canonical progress is declared, and one explicit finalize path is the sole writer to shared planning artifacts.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Finalize authority — Locked. Shared planning artifacts update only through one explicit finalize path, and that path auto-runs by default unless ambiguity, conflict, missing proof, or policy violations require human input. Reasoning: preserves single-writer ownership while keeping routine automation friction low.
- Plan-local ownership boundary — Locked. All workspace outputs stay local until finalize; authoritative shared `.planning` artifacts remain untouched. Reasoning: avoids parallel drift/collision and keeps canonical state unambiguous.
- Pre-finalize inspection contract — Locked. Use summary-first by default, but require direct proof review for major completion claims or risky areas. Reasoning: keeps routine flow lightweight while preserving a stronger trust gate where errors would matter most.

### Medium Decisions
- Violation handling — Locked. Auto-repair the first clearly containable direct shared-planning write, but quarantine repeated or serious violations. Reasoning: preserves automation for minor slips without over-trusting a workspace that shows boundary instability.
- Reconcile/finalize granularity — Locked. Finalize promotes each workspace as one atomic unit. Reasoning: keeps promotion semantics simple and avoids ambiguous partial canonical state.

### Low Defaults and Open Questions
- Inspection default — Defaulted. Show a compact per-workspace completion summary first, with links/paths to deeper proof artifacts.
- Shared progress reporting — Defaulted. Do not mark milestone or phase progress complete in shared `.planning` files before finalize.
- Scope boundary — Defaulted. This phase should define ownership/finalize behavior, not add new task-management or settings surfaces.

### Agent's Discretion
- Define the exact proof/risk heuristics for when a result counts as a “major completion claim” or “risky area,” as long as they preserve summary-first inspection by default and require stronger review where the evidence/risk warrants it.
</decisions>

<specifics>
## Specific Ideas
- Favor Unix-style separation of concerns: reconcile determines what happened, inspect shows what completed, and finalize is the only path that promotes trusted results into shared planning state.
- Human review is wanted for real intent or project-direction ambiguity, not as a default extra step for routine promotion.
- Clear contracts, planner requirements, and TDD/proof discipline should make “wrong direction” exceptions rare rather than the default assumption.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Finalize authority held up under stress testing.
  - Original decision: Single explicit finalize path auto-runs by default unless ambiguity, conflict, missing proof, or policy violations require human input.
  - Stress-test result: Held.
  - Follow-on clarification: Human review is for real intent/project-direction ambiguity, not routine well-evidenced completion.
- Plan-local ownership boundary held up under stress testing.
  - Original decision: All workspace outputs stay local until finalize.
  - Stress-test result: Held.
  - Follow-on clarification: Operator visibility comes from agent/workspace summaries and proof artifacts rather than live shared-state updates during the wave.
- Violation handling changed during stress testing.
  - Original decision: Auto-repair/ignore direct shared-planning writes, record the violation, and continue if safe.
  - Stress-test revision: Auto-repair the first clearly containable violation, but quarantine repeated or serious violations.
  - Follow-on clarification from post-stress-test reassessment: When a workspace is quarantined, healthy isolated sibling workspaces may still reconcile/finalize.
- Atomic workspace promotion held up under stress testing.
  - Original decision: Finalize promotes each workspace as one atomic unit.
  - Stress-test result: Held.
  - Follow-on clarification: Waiting for clean workspace completion is preferred over partial promotion.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---
*Phase: 183-plan-local-workspace-ownership*
*Context gathered: 2026-04-01*
