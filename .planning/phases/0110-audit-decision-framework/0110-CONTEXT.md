# Phase 110: Audit & Decision Framework - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Scan all workflows and agents in the bGSD codebase to identify every logical decision point where an LLM currently does work that deterministic code could handle. Score each candidate against the decision criteria rubric (3 critical + 4 preferred criteria) and produce a prioritized catalog with token savings estimates.

</domain>

<decisions>
## Implementation Decisions

### Candidate Granularity
- Scan at the **logical decision level** — individual decisions within workflow steps (e.g., "classify scope creep", "pick question format"), not at the coarser workflow-step level
- Use **pattern-based scanning** — CLI scans workflow markdown for decision indicators (conditionals, if/then patterns, option lists, "choose"/"decide" language) to identify candidates programmatically
- **Exclude candidates that fail the rubric** — the catalog is an action list of offloadable decisions only, not a comprehensive audit of every decision point

### Agent's Discretion
- Context capture depth per candidate: agent decides how much surrounding context (instructions, inputs, outputs) to capture for each identified decision point, balancing rubric-scoring needs against catalog readability

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0110-audit-decision-framework*
*Context gathered: 2026-03-13*
