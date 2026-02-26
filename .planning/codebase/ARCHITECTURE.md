# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** CLI-driven workflow orchestration with prompt-based agent delegation

**Key Characteristics:**
- Monolithic CLI tool (`bin/gsd-tools.cjs`) built from modular source (`src/`) via esbuild bundling
- Prompt-as-code workflows: markdown files define step-by-step agent instructions, calling the CLI for data
- Three-tier architecture: CLI commands (data layer) → workflow prompts (orchestration layer) → AI agents (execution layer)
- All persistent state lives in `.planning/` directory as markdown and JSON files — no database, no server
- Single-invocation lifecycle: each CLI call loads config, executes one command, exits. Caching is per-invocation only.

## Layers

**Entry Point Layer:**
- Purpose: Bootstrap and route CLI arguments to command handlers
- Location: `src/index.js`, `src/router.js`
- Contains: Argument parsing, global flag extraction (`--raw`, `--compact`, `--verbose`, `--fields`, `--manifest`), lazy module loading, command dispatch via switch/case
- Depends on: `src/lib/constants.js` (for `COMMAND_HELP`), `src/lib/output.js` (for `error()`)
- Used by: `bin/gsd-tools.cjs` (the bundled artifact)

**Command Layer:**
- Purpose: Implement CLI commands — each function gathers data, transforms it, and outputs JSON
- Location: `src/commands/*.js` (13 modules)
- Contains: Command handler functions prefixed with `cmd` (e.g., `cmdInitExecutePhase`, `cmdStateLoad`, `cmdCodebaseAnalyze`)
- Depends on: `src/lib/` modules for parsing, config, git, output
- Used by: `src/router.js` via lazy-loading functions

**Command Modules:**
| Module | Lines | Responsibility |
|--------|-------|----------------|
| `src/commands/verify.js` | 1984 | Plan structure, artifacts, requirements, quality gates, regression |
| `src/commands/features.js` | 1904 | Session diff, context budget, test run, velocity, search, extract sections |
| `src/commands/intent.js` | 1592 | INTENT.md CRUD: create, show, update, validate, trace, drift |
| `src/commands/init.js` | 1493 | Compound initialization for workflows (execute-phase, plan-phase, etc.) |
| `src/commands/misc.js` | 1431 | Utility commands: commit, scaffold, template, config, progress, todos |
| `src/commands/env.js` | 1177 | Environment detection: languages, tools, runtimes, CI, Docker |
| `src/commands/phase.js` | 901 | Phase lifecycle: add, insert, remove, complete, milestone complete |
| `src/commands/worktree.js` | 791 | Git worktree management for parallel plan execution |
| `src/commands/state.js` | 652 | STATE.md CRUD: load, update, patch, validate, decisions, blockers |
| `src/commands/codebase.js` | 489 | Codebase analysis: analyze, status, conventions, rules, deps, impact |
| `src/commands/mcp.js` | 405 | MCP server profiling and optimization |
| `src/commands/memory.js` | 307 | Persistent memory stores: decisions, bookmarks, lessons, todos |
| `src/commands/roadmap.js` | 295 | ROADMAP.md parsing: get-phase, analyze, update-plan-progress |

**Library Layer:**
- Purpose: Shared utilities, parsers, and infrastructure used across commands
- Location: `src/lib/*.js` (10 modules)
- Contains: File I/O, config loading, git operations, frontmatter parsing, token estimation, regex caching, codebase intelligence, convention detection, dependency graph analysis
- Depends on: Node.js built-ins (`fs`, `path`, `child_process`), one npm dependency (`tokenx`)
- Used by: All command modules

**Library Modules:**
| Module | Lines | Responsibility |
|--------|-------|----------------|
| `src/lib/constants.js` | 1088 | Model profiles, config schema, command help text |
| `src/lib/helpers.js` | 946 | File caching, phase tree, milestone detection, intent parsing, slug generation |
| `src/lib/deps.js` | 697 | Multi-language import parsing (JS/TS/Python/Go/Elixir/Rust), dependency graph, cycle detection |
| `src/lib/conventions.js` | 644 | Naming pattern detection, file organization analysis, framework-specific convention extraction |
| `src/lib/codebase-intel.js` | 529 | Source dir detection, file walking, analysis, staleness detection, intel read/write |
| `src/lib/frontmatter.js` | 166 | YAML frontmatter parser/serializer (custom, no YAML dependency) |
| `src/lib/output.js` | 113 | JSON output, field filtering, tmpfile overflow, error handling, debug logging |
| `src/lib/context.js` | 97 | Token estimation (via `tokenx`), budget checking |
| `src/lib/regex-cache.js` | 83 | LRU regex cache, pre-compiled patterns for phases, milestones, commits |
| `src/lib/config.js` | 76 | Config loading with schema defaults, alias resolution, nested key lookup |
| `src/lib/git.js` | 29 | Shell-free git execution via `execFileSync('git', args)` |

**Workflow Layer:**
- Purpose: Define agent instructions as structured markdown prompts
- Location: `workflows/*.md` (44 files, ~8,400 lines total)
- Contains: XML-tagged process steps, bash command snippets calling `gsd-tools.cjs`, subagent spawn instructions
- Depends on: `bin/gsd-tools.cjs` (invoked via bash), `references/*.md` (loaded for context), `templates/*.md` (used as scaffolds)
- Used by: OpenCode commands → load workflow → agent follows instructions

**Template Layer:**
- Purpose: Document scaffolds for planning artifacts
- Location: `templates/*.md`, `templates/codebase/*.md`, `templates/plans/*.md`, `templates/research-project/*.md`
- Contains: Markdown templates with placeholders for STATE.md, ROADMAP.md, PLAN.md, SUMMARY.md, INTENT.md, codebase analysis docs, etc.
- Depends on: Nothing
- Used by: `src/commands/misc.js` (`cmdTemplateFill`, `cmdScaffold`), workflow agents

**Reference Layer:**
- Purpose: Shared knowledge documents loaded by agents for consistent behavior
- Location: `references/*.md` (13 files, ~2,960 lines total)
- Contains: Guidelines for checkpoints, git integration, verification patterns, TDD, model profiles, UI branding
- Depends on: Nothing
- Used by: Workflow markdown files via `@references/` paths, agents via `extract-sections` command

## Data Flow

**Command Execution Flow (CLI → JSON):**

1. User/agent invokes: `node bin/gsd-tools.cjs <command> [args] --raw`
2. `src/index.js` calls `main()` from `src/router.js`
3. Router parses global flags (`--raw`, `--compact`, `--fields`, `--verbose`, `--manifest`)
4. Switch/case dispatches to lazy-loaded command module
5. Command function reads `.planning/` files, runs git commands, computes result
6. `output(result, raw)` writes JSON to stdout (or `@file:/tmp/gsd-*.json` if >50KB)
7. Process exits with code 0 (success) or 1 (error via `error()`)

**Workflow Execution Flow (Agent-driven):**

1. OpenCode slash command triggers workflow markdown (e.g., `/gsd-execute-phase 03`)
2. Workflow's first step runs `init` command to gather all context:
   ```bash
   INIT=$(node .../gsd-tools.cjs init execute-phase "03" --compact)
   ```
3. Agent parses JSON response, extracts configuration flags and phase data
4. Workflow steps call additional CLI commands as needed (validate, scaffold, commit)
5. For complex work, workflow spawns subagents with `Task(prompt="...", model="...")`:
   - Each subagent gets fresh context (200k tokens)
   - Subagent reads agent definition from `agents/` directory
   - Subagent executes the plan, writes code/docs, returns results
6. Orchestrator collects subagent results, updates state, commits planning docs

**Init Command Pattern (Context Aggregation):**

The `init` commands in `src/commands/init.js` are the critical bridge between CLI and workflows. Each `cmdInit*` function pre-aggregates all context a workflow needs into a single JSON payload:

1. Loads `.planning/config.json` via `loadConfig()`
2. Resolves model assignments via `resolveModelInternal()`
3. Finds phase directory via `findPhaseInternal()`
4. Reads milestone info via `getMilestoneInfo()`
5. Optionally triggers auto-scans (env scan, codebase intel)
6. Reads STATE.md, ROADMAP.md, INTENT.md as needed
7. Assembles everything into one JSON object
8. Applies compact mode filtering if `--compact` flag present

This eliminates multiple sequential CLI calls — one `init` call replaces 5-10 individual reads.

**State Management:**
- All state is file-based in `.planning/` directory
- `STATE.md` is the primary mutable state (position, decisions, blockers, metrics, session info)
- `ROADMAP.md` tracks phase status (checkboxes, plan counts)
- `config.json` stores project configuration
- `memory/` directory has JSON stores for decisions, bookmarks, lessons, todos
- `codebase/codebase-intel.json` caches source analysis (staleness-checked via git commit hash)
- `env-manifest.json` caches environment detection (machine-specific, gitignored)
- `project-profile.json` stores team-visible project profile (committed)

## Key Abstractions

**Phase Tree (`getPhaseTree`):**
- Purpose: Single scan of all `.planning/phases/` directories, cached for the invocation
- Location: `src/lib/helpers.js`
- Returns: `Map<normalizedPhaseNum, phaseEntry>` with plans, summaries, metadata
- Pattern: Replaces 100+ individual `readdirSync` calls with one tree scan

**Config Schema (`CONFIG_SCHEMA`):**
- Purpose: Define all config keys with types, defaults, aliases, and nested path lookups
- Location: `src/lib/constants.js`
- Pattern: Schema-driven config — `loadConfig()` resolves flat keys, nested paths, and aliases against this schema
- Examples: `model_profile`, `commit_docs`, `parallelization`, `context_window`

**Frontmatter Parser:**
- Purpose: Extract/modify YAML frontmatter from markdown files without a YAML library dependency
- Location: `src/lib/frontmatter.js`
- Pattern: Custom stack-based parser handling nested objects, arrays, inline arrays. LRU cache (max 100 entries)
- Functions: `extractFrontmatter(content)`, `reconstructFrontmatter(obj)`, `spliceFrontmatter(content, newObj)`

**Output Abstraction:**
- Purpose: Unified JSON output with field filtering, tmpfile overflow, and raw mode
- Location: `src/lib/output.js`
- Pattern: `output(result, raw, rawValue)` → writes to stdout. If JSON >50KB, writes to tmpfile and outputs `@file:/tmp/gsd-*.json`. Global `_gsdRequestedFields` enables `--fields` filtering.

**Lazy Module Loading:**
- Purpose: Only load command modules when their commands are invoked
- Location: `src/router.js`
- Pattern: `lazyState()`, `lazyInit()`, etc. return cached module on first call. Avoids parsing all 13 command modules on startup.

**Codebase Intel:**
- Purpose: Full or incremental source analysis with git-based staleness detection
- Location: `src/lib/codebase-intel.js`
- Pattern: `checkStaleness()` compares stored git hash vs HEAD. If stale, `performAnalysis()` runs full or incremental scan. Results cached in `.planning/codebase/codebase-intel.json`.

## Entry Points

**CLI Entry (`bin/gsd-tools.cjs`):**
- Location: `bin/gsd-tools.cjs` (15,348 lines — esbuild bundle of `src/`)
- Triggers: Direct invocation by agents, workflows, tests, deploy script
- Responsibilities: All CLI operations — the single executable artifact

**Source Entry (`src/index.js`):**
- Location: `src/index.js` (5 lines)
- Triggers: esbuild build process entry point
- Responsibilities: `require('./router').main()` — minimal bootstrap

**Build Entry (`build.js`):**
- Location: `build.js` (94 lines)
- Triggers: `npm run build`
- Responsibilities: esbuild bundling `src/index.js` → `bin/gsd-tools.cjs`, smoke test, bundle size tracking (700KB budget)

**Deploy Entry (`deploy.sh`):**
- Location: `deploy.sh` (50 lines)
- Triggers: Manual deployment to `~/.config/opencode/get-shit-done/`
- Responsibilities: Build, backup, copy artifacts, smoke test, rollback on failure

**Test Entry (`bin/gsd-tools.test.cjs`):**
- Location: `bin/gsd-tools.test.cjs` (13,040 lines)
- Triggers: `npm test` → `node --test bin/gsd-tools.test.cjs`
- Responsibilities: Integration tests via subprocess spawning of the built bundle

## Error Handling

**Strategy:** Fail-fast with descriptive stderr messages and exit code 1

**Patterns:**
- `error(message)` in `src/lib/output.js`: writes to stderr, calls `process.exit(1)` — used for argument validation and missing data
- `debugLog(context, message, err)` in `src/lib/output.js`: conditional debug output when `GSD_DEBUG` env var is set — never visible in production
- `safeReadFile(path)` returns `null` on error rather than throwing — commands check for null and handle gracefully
- `execGit(cwd, args)` returns `{ exitCode, stdout, stderr }` object — callers check exitCode rather than catching exceptions
- Try/catch blocks wrap git, file, and JSON operations throughout command modules — failures degrade gracefully with `debugLog`

## Cross-Cutting Concerns

**Logging:** `debugLog()` to stderr, gated by `GSD_DEBUG` environment variable. No production logging framework — tool is silent unless errors occur.

**Validation:** Schema-driven via `CONFIG_SCHEMA` for config, `cmdStateValidate()` for state consistency, `cmdVerify*()` family for planning document structure, `cmdIntentValidate()` for intent format.

**Authentication:** Not applicable — CLI tool runs locally with filesystem permissions. Git operations use existing git credentials.

**Caching:** Per-invocation caching at multiple levels:
- `fileCache` (Map) in `src/lib/helpers.js` — file content by path
- `dirCache` (Map) in `src/lib/helpers.js` — directory listings
- `_phaseTreeCache` in `src/lib/helpers.js` — entire phase directory tree
- `_milestoneCache` in `src/lib/helpers.js` — milestone info from ROADMAP.md
- `_configCache` (Map) in `src/lib/config.js` — parsed config by cwd
- `_fmCache` (Map) in `src/lib/frontmatter.js` — parsed frontmatter (LRU, max 100)
- `_dynamicRegexCache` (Map) in `src/lib/regex-cache.js` — compiled regexes (LRU, max 200)

**Token Budget Awareness:** `src/lib/context.js` provides `estimateTokens()` via `tokenx` library. Used by `--compact` mode and `context-budget` commands to keep workflow payloads within context window limits.

---

*Architecture analysis: 2026-02-26*
