# Research Summary: v5.0 Codebase Intelligence

**Synthesized:** 2026-02-25
**Sources:** Stack, Features, Architecture, Pitfalls research (4 parallel agents)

## Key Findings

### Convention Extraction
- **#1 gap in AI coding tools.** Every tool (Cursor, Aider, Continue, Claude Code) requires humans to manually write convention docs. Auto-extracting conventions from code is a genuine differentiator.
- 72.6% of CLAUDE.md files specify architecture conventions — proving the demand.
- Over-extraction actively hurts: agents ignore rules when >15-20 are provided. Extract by counter-example ("what would an AI get wrong?"), not comprehensively.
- Semi-automated with human curation works; fully automatic does not.

### Dependency Graph
- Foundation for all other features. Aider's repo map uses PageRank on file dependency graph.
- Regex-based import parsing covers 80-90% of cases without tree-sitter.
- `Map<string, Set<string>>` adjacency list, Kahn's topological sort, Tarjan's SCC for cycles. ~200 lines pure JS.
- 6 language patterns needed: JavaScript/TypeScript, Python, Go, Elixir, Rust, Ruby.

### Lifecycle Awareness
- **Novel feature** — no mainstream tool explicitly models boot sequences, seed dependencies, middleware chains.
- This is where agents make subtle mistakes (wrong execution order, missing seed updates after migrations).
- Framework-specific by nature — needs pluggable detection per framework.
- Start with Elixir (target use case), expand incrementally.

### Task-Scoped Context Injection
- ON-DEMAND, not pre-computed. Executor calls `codebase context --files X Y Z` at execution time.
- Init commands provide summary-level context only (<500 tokens).
- Heuristic scoring (graph distance + plan frontmatter + git recency) replaces embedding-based retrieval.
- Hard token budget: never inject >5K tokens of codebase context.

### Technical Approach
- **Regex over Tree-sitter:** Tree-sitter WASM is 616KB per language + 252KB runtime. Regex provides 85-90% accuracy for structural metadata at zero cost.
- **Git-first staleness:** `git diff --name-only <cached-commit>..HEAD` returns changed files in ~5ms. Sub-100ms incremental updates.
- **JSON cache:** `.planning/codebase-intel.json` (gitignored). ~50-100KB for 500-file project.
- **Follow env.js pattern:** `autoTriggerCodebaseAnalysis → readCodebaseIntel → formatConventionSummary` mirrors existing `autoTriggerEnvScan` pipeline.

## Architecture

- **3 new modules:** `src/lib/analyzers.js` (analysis engine), `src/lib/codebase-intel.js` (storage/cache), `src/commands/codebase.js` (CLI commands)
- **4 modified files:** `router.js`, `init.js`, `constants.js`, `execute-plan.md` workflow
- **Storage:** `.planning/codebase-intel.json` (gitignored, machine-generated)

## Watch Out For
- **Context overload:** Models degrade past ~25-30K tokens. Hard token budgets essential.
- **Stale analysis:** Every artifact needs git hash watermarks and <50ms freshness checking.
- **Regex accuracy:** ~70% on Elixir deps, ~85-90% with framework heuristics. Validate against `mix xref`.
- **Convention over-extraction:** Cap at 10-15 rules. Quality > quantity.
- **Init command bloat:** Summary injection must stay <500 tokens. Full context on-demand only.

## Suggested Build Order

1. **Infrastructure** — Cache system, staleness detection, JSON storage format
2. **Convention Extraction** — Pattern detection, naming rules, file organization conventions
3. **Dependency Graph** — Import parsing, module relationships, impact analysis
4. **Init Integration** — Summary injection into init commands (milestone integration point)
5. **Task-Scoped Context** — On-demand context injection for executors (capstone feature)
6. **Lifecycle Analysis** — Execution order, seed dependencies, boot sequences
7. **Workflow Integration** — Wire into execute-phase, plan-phase, verify workflows
