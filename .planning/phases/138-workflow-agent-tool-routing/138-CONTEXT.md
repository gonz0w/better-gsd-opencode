# Phase 138: Workflow & Agent Tool Routing - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary
Wire existing tool detection decisions (file-discovery-mode, search-mode, json-transform-mode, agent-capability-level) into 5 workflows and 3 agent system prompts so behavior adapts to available CLI tools. No new detection, no new decision rules — purely consumption of what v12.1 built.
</domain>

<decisions>
## Implementation Decisions

### Tool Guidance Format in Agent Prompts
- Use a **"Preferred Commands" preamble** at the top of each agent prompt (executor, debugger, mapper) listing resolved concrete commands
- Preamble uses **concrete resolved commands**, not abstract variables — e.g., "File discovery: `fd -e ts -e tsx`" not "FILE_FIND: fd"
- Body references match the preamble commands literally
- Show **resolved commands only** — no fallback alternatives, no if/else conditionals
- Agents are expected to handle tool failures through normal reasoning if a resolved tool is unexpectedly broken at runtime

### Handoff to Spawned Agents
- execute-phase.md Task() prompt gets a **minimal one-line hint**: "Tool capability: HIGH — see bgsd-context for details"
- **No duplication** — spawned executors receive full tool decisions via their own bgsd-context injection; the Task() prompt is a pointer, not a copy
- The executor agent's system prompt (with its preamble) is the authority for which commands to use

### Mapper Command Replacement
- **Preamble + body references** pattern for bgsd-codebase-mapper.md
- Single "Preferred Commands" section at top with resolved commands for file discovery, content search, file reading
- Body references these commands instead of hardcoding find/grep/cat
- Driven by both maintainability (one place to change for new tools) and readability (body stays clean)

### gh-preflight Error UX
- Replace raw `gh auth status` in github-ci.md with `detect:gh-preflight` JSON output
- On failure: **error + actionable fix** format — "gh CLI not usable: [reason]. Run `[fix command]` to resolve."
- **Specific version warnings** for known-bad versions — "gh 2.88.0 has a known bug, upgrade to 2.89+"
- Not a generic "not usable" — surface the exact problem and exact fix

### Agent's Discretion
- **Which preamble approach for executor/debugger**: Planner should use the resolved-command-table style (consistent with mapper decision), adapting the exact commands per agent's domain
- **How much tool context in Task() prompt**: One-line capability hint is the contract; planner decides exact wording
- **Handoff depth**: Capability level pointer only; bgsd-context is the single source of truth
</decisions>

<specifics>
## Specific Ideas
- The existing "Pre-computed decision" pattern (used by 8 workflows) is the established way to consume enricher decisions — follow this pattern for tool routing decisions
- `handoff_tool_context` enrichment field already computes `available_tools`, `tool_count`, `capability_level` — use `capability_level` for the Task() hint
- Codebase mapper agent has `tool_dependency_level: 'high'` in context.js so it already receives full tool data — the prompt just needs to act on it
</specifics>

<stress_tested>
## Stress-Tested Decisions
- **Stale-at-spawn is acceptable**: Tool installs mid-session are rare; next command invocation re-enriches. No runtime tool verification needed.
- **Concrete commands in preamble** (refined during stress test): Originally "preamble + body references" — stress test surfaced the risk that abstract variable names (FILE_FIND) would be ignored by LLMs. Decision refined to use concrete resolved commands that match training data.
- **No duplication between Task() and bgsd-context**: Minimal pointer in Task() prompt, full details in bgsd-context. Single source of truth.
- **Resolved-only without fallbacks**: Agents can reason through tool failures without explicit fallback instructions. Edge case not worth prompt clutter.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope
</deferred>

---
*Phase: 138-workflow-agent-tool-routing*
*Context gathered: 2026-03-17*
