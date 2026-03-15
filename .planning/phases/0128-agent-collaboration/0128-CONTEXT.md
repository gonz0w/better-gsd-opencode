# Phase 128: Agent Collaboration - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve inter-agent handoffs with shared context patterns and multi-phase coordination via new decision functions. This phase delivers tool-aware handoff context, capability scoring (`resolveAgentCapabilityLevel()`), phase dependency sequencing (`resolvePhaseDependencies()`), and capability-aware context filtering.

</domain>

<decisions>
## Implementation Decisions

### Handoff Context Richness
- Pass **tool names only** between agents — no descriptions, no parameter schemas
- Only pass **available** tools, not usage history (which tools were used during the task)
- Handoff format should **vary by pair** — critical pairs get richer context, others get minimal
- **Critical pairs** that get richer context: Planner → Executor and Researcher → Planner
- All other pairs (7 remaining) use minimal handoff format

### Low-Capability Behavior
- LOW capability (0-1 tools) triggers a **warn and continue** — agent proceeds but a warning is logged
- Warnings are **internal only** — visible to agents in context but not surfaced to users
- Capability score has **no connection** to model profile selection — they solve different problems
- **Only LOW triggers warnings** — MEDIUM (2-4 tools) is considered normal operation, no behavior change

### Context Filtering Strategy
- Strip **tool details only** from context — tool names/descriptions removed, but tool-specific instructions in prose are kept
- 25% context reduction is a **soft goal** — aim for it but don't enforce or gate on it
- Filtering is **automatic** — system detects tool-independent tasks and applies filtering without opt-in
- Tool-dependency classification uses a **spectrum** (not binary) — tasks scored on dependency level, filtering scales proportionally
- Primary signal for the spectrum is **agent type** — e.g., verifier is less tool-dependent than executor
- Filtering rules are **fixed for known agent types** — hardcoded per agent, not extensible config
- **Silent filtering** — agents don't know what was removed, they work with what they get
- Filter scope includes **tools + noise** — also trim irrelevant decisions and history that don't apply to the current task

### Dependency Sequencing
- **Declared dependencies always win** — tool capabilities only break ties between independent phases
- **Built-in heuristic** for discovery-before-analysis — automatically detect and prioritize discovery phases before complex analysis phases
- **Include tool availability** as a sequencing input — if a phase needs MCP tools that may not be installed, factor that in
- On conflicts (dependency order vs tool readiness): **honor dependencies, emit a warning** about suboptimal tool readiness

### Agent's Discretion
- No areas explicitly deferred to agent discretion in this phase

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

*Phase: 0128-agent-collaboration*
*Context gathered: 2026-03-15*
