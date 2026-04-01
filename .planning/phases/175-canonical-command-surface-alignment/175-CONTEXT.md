# Phase 175: Canonical Command Surface Alignment - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Make `/bgsd-plan` the explicit canonical planning-family entrypoint so maintainers can update planning routes, help, and surfaced workflow guidance from one clearer command definition.
- **Expected User Change:** Before: planning-family guidance could drift across standalone wrappers, ambiguous examples, or split surfaces that did not consistently teach the same planning entrypoint. After: users see explicit canonical commands that start with `/bgsd-plan` plus a required sub-action, and maintainers can align routing and surfaced guidance around that one family. Examples: users see `/bgsd-plan phase 175` instead of inferring `/bgsd-plan 175`; surfaced guidance teaches `/bgsd-plan discuss 175` instead of compatibility wrappers like `/bgsd-discuss-phase 175`; plan-scoped actions such as `roadmap add`, `gaps`, and `todo add|check` remain under `/bgsd-plan` with their current workflow-owned operands preserved.
- **Non-Goals:**
  - Creating a new generalized gap product beyond the existing milestone-gap entrypoint owned by `workflows/plan-milestone-gaps.md`
  - Reopening a standalone general task-management surface outside the explicit plan-scoped `todo add|check` flows
  - Pulling settings commands or read-only inspection flows into `/bgsd-plan` instead of keeping those as separate canonical families
</phase_intent>

<domain>
## Phase Boundary
This phase defines the supported planning-family command surface around `/bgsd-plan`, including phase-planning/prep sub-actions, roadmap mutation, milestone-gap planning, and plan-scoped todos. It clarifies how those routes are expressed and taught, but does not add new planning capabilities.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Canonical planning umbrella — Locked. `/bgsd-plan` is the canonical planning-family entrypoint for planning and planning-prep behavior because the phase goal is to replace drift-prone parallel command teaching with one clearer supported family.
- Explicit sub-action-first syntax — Locked. Canonical planning commands must name the sub-action before required operands, such as `/bgsd-plan phase 175`, `/bgsd-plan discuss 175`, `/bgsd-plan research 175`, and `/bgsd-plan assumptions 175`. Do not surface ambiguous shorthand like `/bgsd-plan 175` because it forces users and validators to guess intent.
- Deterministic routing only — Locked. Routing should normalize from the planning-family prefix and explicit sub-action only. Missing or invalid subcommands or required arguments should error with additional help rather than guessing from free text, ambient wording, or inferred intent.
- Legacy wrapper posture — Locked. Older planning wrappers may still exist as compatibility history, but surfaced guidance should teach only the canonical `/bgsd-plan ...` family so validation and user guidance reinforce the same supported command model.

### Medium Decisions
- Prefix normalization plus workflow-owned operand passthrough — Locked. The router should normalize only the planning-family prefix and then pass the remaining workflow-defined operands through unchanged. This preserves existing contracts like `roadmap add <description>`, `roadmap insert <after> <description>`, `gaps [milestone-or-context] [flags]`, and `todo add <description>` without using those tails for routing decisions.
- Planning-family breadth stays, clarified by help — Locked. `phase`, `discuss`, `research`, `assumptions`, `roadmap add|insert|remove`, `gaps`, and `todo add|check` all remain under `/bgsd-plan`; help and examples should make the supported sub-actions obvious rather than splitting them into new top-level families.
- Route, then load one workflow — Locked. After selecting a planning-family route, execution should immediately load only the selected workflow file and continue that workflow rather than preloading sibling planning workflows or stopping at router analysis.

### Low Defaults and Open Questions
- Gap operand wording — Untouched. `gaps [milestone-or-context] [flags]` stays on its existing workflow contract for this phase; any future narrowing of that operand shape would be separate work.
- Alias migration messaging depth — Defaulted. Compatibility-era planning wrappers can be recognized as legacy guidance, but the primary surfaced story should stay focused on the canonical `/bgsd-plan` family first.

### Agent's Discretion
No broad discretion requested. The command shape should stay strict and explicit.
</decisions>

<specifics>
## Specific Ideas
- Keep the normalized contract explicit enough for parity checks across `phase`, `discuss`, `research`, `assumptions`, `roadmap`, `gaps`, and `todo` without restating behavior per route.
- Preserve behavioral equivalence to the underlying workflow contracts by forwarding the remaining arguments after the normalized planning-family prefix.
- Treat strict help/error behavior as part of the product story: subcommand and arguments either match the supported contract or they fail with corrective guidance.
- Close the remaining Phase 174 command-integrity blocker by aligning shipped validation with the canonical planning workflow guidance in `workflows/plan-phase.md` and `workflows/discuss-phase.md`.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Canonical surfaced guidance vs remembered legacy wrappers: all decisions held. Compatibility history may exist, but surfaced guidance should still teach only canonical `/bgsd-plan ...` routes.
- Broad planning family vs command sprawl: all decisions held. The family may stay broad as long as help clearly teaches the supported sub-actions.
- Original decision: if extra routing context were ever needed, something like `--context` could be considered.
  Stress-test revision: do not add extra routing context for this phase; users should not need to pass additional routing data.
  Follow-on clarification: route strictly from the normalized prefix and required workflow contract, then preserve only workflow-owned operands unchanged.
- Ambiguous shorthand risk: all decisions held. Commands must remain explicit about sub-action and required operands; unsupported shorthand should error with additional help.
</stress_tested>

<deferred>
## Deferred Ideas
- Any future explicit routing-context flag such as `--context` if a later phase introduces a concrete need for routing-time payload disambiguation
- Any attempt to turn milestone-gap planning into a broader generalized gap-management product
- Any attempt to reopen a standalone non-plan-scoped todo/task-management command surface
</deferred>

---
*Phase: 175-canonical-command-surface-alignment*
*Context gathered: 2026-03-31*
