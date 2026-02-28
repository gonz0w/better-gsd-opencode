# Phase 27: Task-Scoped Context - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

On-demand per-file architectural context for executor agents. Given a set of file paths, return imports, dependents, conventions, and risk level for each — with heuristic relevance scoring to keep total injection under 5K tokens. Response time <100ms from cached intel.

</domain>

<decisions>
## Implementation Decisions

### Context density per file
- Show direct imports (1-hop) and direct dependents (1-hop) — not full transitive trees
- Top-N cap: max 8 imports and 8 dependents per file (sorted by fan-in/fan-out count)
- Risk level is a composite: high fan-in (>10 dependents) = "high risk" (changes break many modules), has cycles = "caution", otherwise "normal"
- Convention info per file: applicable naming pattern + any framework-specific patterns detected for that file type
- If a file has no intel data (not in graph), return minimal stub: `{ file, status: "no-data", conventions: null }` — never crash

### Relevance scoring heuristics
- Three signals weighted: graph distance (50%), plan scope (30%), git recency (20%)
- Graph distance: files directly imported by or depending on target files score highest; 2-hop scores half; 3+ hop excluded
- Plan scope: files listed in the current plan's `files_modified` frontmatter get a boost — they're what the agent is actively changing
- Git recency: files modified in last 10 commits get a recency boost (recently active = more relevant context)
- Hard cutoff: after scoring, take top results that fit within token budget — no partial entries, each file context is atomic (include fully or drop)

### Output shape for agents
- Structured JSON object, not prose — agents parse it programmatically
- Grouped by file path (each file is a key with its context object)
- Fields per file: `imports[]`, `dependents[]`, `conventions{}`, `risk_level`, `relevance_score`
- Plain text mode (`--raw` outputs JSON, without flag outputs human-readable table) following existing CLI patterns
- Designed for prompt injection: agents read the JSON and understand what they're working with

### Token budget tradeoffs
- 5K token cap is hard — never exceed regardless of file count
- Allocation: divide budget equally across requested files, then let scoring trim
- Graceful degradation order: drop dependents first → drop imports to top-3 → drop conventions → drop to file+risk only
- When budget forces trimming, add a `truncated: true` flag and `omitted_files: N` count so agents know context is incomplete
- Single file requests get full budget (richest context); 10+ files get sparse summaries

### Agent's Discretion
- Exact JSON field names and nesting structure
- How to format the human-readable table output
- Whether to cache scored results or recompute per invocation
- Internal implementation of the scoring algorithm (as long as weights are respected)

</decisions>

<specifics>
## Specific Ideas

- Follow existing CLI pattern: `codebase context --files src/foo.js src/bar.js` mirrors how `codebase impact` and `codebase rules` work
- Keep output terse and agent-facing — this is consumed by executor agents mid-task, not read by humans
- The 5K budget is per-invocation, not per-file — important distinction for the implementation
- Reuse existing dependency graph data from Phase 25 (`intel.dependencies`) and conventions from Phase 24 (`intel.conventions`) — no new analysis, just reshaping cached data

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-task-scoped-context*
*Context gathered: 2026-02-26*
