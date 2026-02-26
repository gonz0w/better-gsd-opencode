# Phase 23: Infrastructure & Storage - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the codebase intelligence foundation: JSON storage format, git-based staleness detection with file timestamp fallback, incremental analysis of changed files, and auto-trigger integration with init commands. This phase delivers the storage layer and change detection that all subsequent codebase intelligence phases (conventions, dependencies, lifecycle) build upon.

</domain>

<decisions>
## Implementation Decisions

### Storage format & structure
- Agent's discretion on single file vs split files — pick what works best technically
- Data lives in `.planning/codebase/` directory, alongside other GSD artifacts
- Files are committed to git (not gitignored) — useful for CI, team sharing, history tracking
- No size cap — let it grow, trust that JSON compresses well as a dev artifact

### Staleness & refresh policy
- Primary detection via git diff (store last-analyzed commit hash, compare with HEAD)
- Fallback to file timestamps for non-git repos
- Auto-refresh with notice when stale data detected ("Updating codebase intel...")
- Always re-analyze on any change — even 1 changed file triggers incremental update
- `codebase status` shows changed files grouped by type (added/modified/deleted) with reason

### Analysis scope & targeting
- Auto-detect source directories from project structure, respect .gitignore, user can override
- Analyze source code + config files (package.json, mix.exs, etc.) for dependency/framework info
- Incremental mode re-analyzes only changed files (not their dependents) — fast, simple
- Language-aware from the start — detect project languages and use appropriate parsers

### Init integration behavior
- Background async: return init data immediately with stale flag, trigger analysis in background
- First run requires explicit `codebase analyze` — no auto-trigger on virgin projects
- Only relevant init commands include codebase context (phase-op, etc. — not todos)
- No timeout on large codebases — run to completion with progress indication (analyzing file X of Y)

### Agent's Discretion
- Single file vs split files for storage format
- Exact module structure within gsd-tools.cjs
- Language parser implementation details
- Progress output formatting
- Exact git diff strategy and performance optimizations

</decisions>

<specifics>
## Specific Ideas

- Follow the existing env.js pattern for init command integration
- Success criteria from roadmap: cached reads <10ms, staleness detection <50ms
- New modules: `src/lib/codebase-intel.js` and `src/commands/codebase.js` (or equivalent sections in gsd-tools.cjs)

</specifics>

<deferred>
## Deferred Ideas

- Slash command timing/recommendation UX across the full GSD workflow — belongs in a workflow-polish phase, not infrastructure
- Dependent cascade re-analysis (re-analyze files that import changed files) — future optimization after dependency graph exists (Phase 25)

</deferred>

---

*Phase: 23-infrastructure-storage*
*Context gathered: 2026-02-26*
