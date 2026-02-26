# Phase 28: Lifecycle Analysis - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect execution order relationships in codebases — seeds after migrations, config at boot, framework-specific initialization patterns. Output lifecycle chains as dependency graphs (what must run before what). This is a `codebase lifecycle` command, not a runtime tool.

</domain>

<decisions>
## Implementation Decisions

### Framework detection scope
- Start with patterns detectable via filename/path conventions and simple content scanning — no AST parsing
- Support generic patterns that work across languages: migration ordering (numbered files), seed dependencies, config/env loading
- Framework-specific: detect from existing `intel.conventions.framework_patterns` (Phase 24) — if Elixir/Phoenix detected, apply Phoenix-specific rules; if Next.js detected, apply Next.js rules; etc.
- Ship with 2-3 framework detectors (generic + the frameworks most likely encountered), make it extensible via detector registry pattern (same as Phase 24 framework detector)
- Don't try to be exhaustive — better to be accurate for common patterns than broad with false positives

### Lifecycle chain representation
- DAG (directed acyclic graph) — same adjacency list pattern used in Phase 25 dependency graph
- Each node: `{ id, file_or_step, type, must_run_before[], must_run_after[], framework, confidence }`
- Types: `migration`, `seed`, `config`, `boot`, `compilation`, `initialization`
- Confidence score per relationship (high for numbered migrations, medium for convention-based detection)
- Cycles are errors — detect and report them (reuse Tarjan's SCC from Phase 25)

### Output format and consumption
- JSON output via `--raw`, human-readable table/tree by default — consistent with all other codebase commands
- Keep output terse and agent-facing — lifecycle context is consumed alongside task-scoped context
- Include a `chains[]` array showing linear execution sequences (flattened from DAG for easy reading)
- Token budget: same philosophy as Phase 27 — keep it compact, agents don't need verbose explanations

### Detection heuristics
- Filename conventions first: numbered prefixes (001_, 002_), timestamp prefixes, alphabetical ordering in specific directories
- Directory conventions: `migrations/`, `seeds/`, `priv/repo/`, `db/migrate/`, `config/`, `initializers/`
- Content scanning (regex, not AST): `require`, `import`, `use`, `Application.start`, `Repo.migrate`, framework-specific function calls
- Priority: filesystem ordering signals > content-based signals > convention-based guesses
- Cache results in `codebase-intel.json` alongside existing intel data — reuse staleness infrastructure from Phase 23/26

### Agent's Discretion
- Exact detector implementations and which specific frameworks to ship with
- Internal data structures for chain building
- How to handle ambiguous ordering (when confidence is low)
- Human-readable output formatting (tree vs table vs flat list)

</decisions>

<specifics>
## Specific Ideas

- Reuse as much Phase 23-27 infrastructure as possible — staleness, caching, graph algorithms, output patterns
- The detector registry pattern from Phase 24 (`framework_detectors` array) is the right model for lifecycle detectors
- Performance matters — this should be <200ms from cached intel like everything else
- The success criteria mention Elixir/Phoenix specifically, but the implementation should be generic with Phoenix as one detector

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-lifecycle-analysis*
*Context gathered: 2026-02-26*
