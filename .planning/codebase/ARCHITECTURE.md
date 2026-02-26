# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** CLI Tool + Markdown Workflow Engine

The GSD plugin is a **two-layer architecture**: a deterministic Node.js CLI tool (`gsd-tools`) that handles all data operations (parsing, validation, git, file I/O), and a set of **markdown workflow definitions** that LLM agents follow as step-by-step instructions, calling gsd-tools for structured data.

**Key Characteristics:**
- **Single-bundle CLI**: Source in `src/` is bundled by esbuild into `bin/gsd-tools.cjs` — one file, zero runtime npm dependencies (tokenx bundled in)
- **Workflow-as-prompt**: Markdown files in `workflows/` define agent behavior — they are system prompts, not code
- **JSON-over-stdout**: All CLI commands output structured JSON to stdout; workflows parse it
- **Lazy module loading**: Router loads command modules on-demand to minimize startup time
- **File-based state**: All project state lives in `.planning/` directory as markdown + JSON files
- **Deployed as plugin**: `deploy.sh` copies artifacts to `~/.config/opencode/get-shit-done/`

## Layers

**Entry Layer (Router):**
- Purpose: Parse CLI arguments, dispatch to command handlers
- Location: `src/index.js` → `src/router.js`
- Contains: Global flag parsing (`--raw`, `--fields`, `--verbose`, `--compact`, `--manifest`), command routing via switch/case, lazy module imports
- Depends on: `src/lib/constants.js` (COMMAND_HELP), `src/lib/output.js` (error)
- Used by: The bundled `bin/gsd-tools.cjs` binary (invoked by workflows and hooks)

**Command Layer:**
- Purpose: Implement CLI command logic — compose library functions, format output
- Location: `src/commands/*.js` (13 modules)
- Contains: Command handler functions (e.g., `cmdInitExecutePhase`, `cmdStateUpdate`, `cmdVerifyPlanStructure`)
- Depends on: Library layer (`src/lib/*`), each other (e.g., `init.js` imports from `intent.js`, `env.js`, `codebase.js`, `worktree.js`)
- Used by: Router (`src/router.js`) via lazy-loaded module references

  **Command modules by size and responsibility:**
  | Module | Lines | Responsibility |
  |--------|-------|---------------|
  | `src/commands/verify.js` | 1984 | Plan structure, phase completeness, references, artifacts, quality gates, regression detection |
  | `src/commands/features.js` | 1945 | Session diff, context budget, test run, search, velocity, token budget, extract-sections |
  | `src/commands/init.js` | 1668 | Compound init commands (execute-phase, plan-phase, new-project, resume, progress, memory) |
  | `src/commands/intent.js` | 1592 | INTENT.md CRUD, validation, traceability, drift analysis |
  | `src/commands/misc.js` | 1431 | Utility commands (commit, template, frontmatter, scaffold, config, progress rendering) |
  | `src/commands/env.js` | 1177 | Environment scanning (languages, tools, runtimes, CI, MCP servers) |
  | `src/commands/codebase.js` | 1146 | Codebase intelligence (analysis, conventions, deps, impact, lifecycle) |
  | `src/commands/phase.js` | 901 | Phase lifecycle (add, insert, remove, complete, milestone complete) |
  | `src/commands/worktree.js` | 791 | Git worktree management (create, list, remove, merge, overlap check) |
  | `src/commands/state.js` | 652 | STATE.md read/write (update, patch, validate, metrics, decisions, blockers, sessions) |
  | `src/commands/mcp.js` | 405 | MCP server profiling (discover, score, apply/restore) |
  | `src/commands/memory.js` | 307 | Memory stores (write, read, list, compact — decisions, bookmarks, lessons, todos) |
  | `src/commands/roadmap.js` | 295 | ROADMAP.md operations (get-phase, analyze, update-plan-progress) |

**Library Layer:**
- Purpose: Shared utilities, parsers, caches, and core abstractions
- Location: `src/lib/*.js` (11 modules)
- Contains: File I/O, config loading, git operations, frontmatter parsing, regex caching, token estimation, codebase analysis, convention detection, dependency parsing, lifecycle detection
- Depends on: Node.js built-ins (fs, path, child_process), tokenx (bundled)
- Used by: Command layer

  **Library modules:**
  | Module | Lines | Purpose |
  |--------|-------|---------|
  | `src/lib/constants.js` | 1088 | MODEL_PROFILES table, CONFIG_SCHEMA definitions, COMMAND_HELP strings |
  | `src/lib/helpers.js` | 946 | Phase tree scanning, file caching, milestone detection, intent parsing, slug generation |
  | `src/lib/deps.js` | 697 | Multi-language import parsing (JS/TS, Python, Go, Elixir, Rust, Ruby, Java), dependency graph building |
  | `src/lib/conventions.js` | 644 | Naming pattern classification, file organization analysis, framework detection |
  | `src/lib/codebase-intel.js` | 570 | Source directory detection, file traversal, language detection, analysis orchestration |
  | `src/lib/lifecycle.js` | 569 | Lifecycle detection registry (migrations, seeds, config, boot sequences) |
  | `src/lib/frontmatter.js` | 166 | Custom YAML frontmatter parser (extract, reconstruct, splice) |
  | `src/lib/output.js` | 113 | JSON output with field filtering, tmp-file fallback for >50KB, error/debug logging |
  | `src/lib/context.js` | 97 | Token estimation via tokenx, budget checking |
  | `src/lib/regex-cache.js` | 83 | LRU regex cache (max 200), pre-compiled patterns for phases/milestones/commits |
  | `src/lib/config.js` | 76 | Config loading with schema defaults, nested key resolution, gitignore checking |
  | `src/lib/git.js` | 29 | Shell-free git execution via `execFileSync('git', args)` |

**Workflow Layer:**
- Purpose: Define agent behavior as step-by-step markdown instructions
- Location: `workflows/*.md` (44 files, ~8,500 lines total)
- Contains: XML-structured steps, bash commands calling gsd-tools, decision logic, subagent spawn instructions
- Depends on: `bin/gsd-tools.cjs` (invoked via `node` commands), `references/*.md` (loaded on-demand), `templates/*.md` (used for scaffolding)
- Used by: LLM agents (the agents read these as system prompts)

**Template Layer:**
- Purpose: Provide document scaffolds for planning artifacts
- Location: `templates/*.md`, `templates/codebase/*.md`, `templates/plans/*.md`, `templates/research-project/*.md`
- Contains: Pre-formatted markdown templates for PLAN.md, SUMMARY.md, STATE.md, ROADMAP.md, codebase analysis docs, etc.
- Depends on: Nothing
- Used by: Workflows (via `gsd-tools template fill`), agents (direct reading)

**Reference Layer:**
- Purpose: Detailed domain knowledge docs loaded by agents on-demand
- Location: `references/*.md` (13 files)
- Contains: Checkpoint types, git integration patterns, model profiles, TDD patterns, verification patterns, UI branding
- Depends on: Nothing
- Used by: Workflows (via `gsd-tools extract-sections` or direct `@reference` reading)

**Build Layer:**
- Purpose: Bundle source into deployable artifact
- Location: `build.js`
- Contains: esbuild config (CJS bundle, Node 18 target, externalize built-ins, bundle npm deps), smoke test, bundle budget enforcement (1000KB limit)
- Depends on: esbuild (devDependency)
- Used by: `deploy.sh`, `npm run build`

## Data Flow

**Workflow Execution (primary flow):**

1. User invokes `/gsd-execute-phase 03` (OpenCode slash command)
2. OpenCode loads `workflows/execute-phase.md` as agent prompt
3. Workflow calls `gsd-tools init execute-phase 03 --compact` → JSON with all context
4. Workflow parses JSON, determines wave execution plan
5. Workflow spawns subagent Tasks with `workflows/execute-plan.md`
6. Each subagent calls `gsd-tools` for data operations (frontmatter, state, commit)
7. Subagents write code + SUMMARY.md, call `gsd-tools commit`
8. Orchestrator calls `gsd-tools state update-progress` to finalize

**Init Command Pattern (data aggregation):**

1. `gsd-tools init <workflow> <phase>` is called by a workflow's first step
2. Init command reads multiple planning files (ROADMAP.md, STATE.md, config.json, phase directories)
3. Aggregates into a single JSON payload containing all context the workflow needs
4. Compact mode (`--compact`) strips non-essential fields for ~40% smaller output
5. Manifest mode (`--manifest`) adds guidance about which files to load for detail

**State Management:**
- All state is file-based in `.planning/` directory
- `STATE.md` tracks current position, blockers, decisions, session info
- `ROADMAP.md` tracks phases, milestones, progress
- `config.json` stores user preferences and workflow toggles
- `.planning/memory/` stores persistent JSON stores (decisions, bookmarks, lessons, todos)
- `.planning/codebase/codebase-intel.json` caches codebase analysis results

**Build & Deploy:**

1. `build.js` runs esbuild: `src/index.js` → `bin/gsd-tools.cjs` (single CJS bundle)
2. Smoke test verifies built artifact works (`current-timestamp --raw`)
3. Bundle size tracked in `.planning/baselines/bundle-size.json` (budget: 1000KB)
4. `deploy.sh`: build → backup existing → copy bin/, workflows/, templates/, references/, src/, VERSION → smoke test → rollback on failure

## Key Abstractions

**Phase Tree (`getPhaseTree`):**
- Purpose: Cached scan of entire `.planning/phases/` directory, built once per CLI invocation
- Location: `src/lib/helpers.js` (lines 93-150)
- Pattern: Map<normalizedPhaseNum, phaseEntry> with all file metadata (plans, summaries, status)
- Used by: `findPhaseInternal()`, `cmdInitExecutePhase()`, `cmdPhasesList()`, and many others

**Config Schema (`CONFIG_SCHEMA`):**
- Purpose: Single source of truth for all configuration keys, types, defaults, aliases, nested paths
- Location: `src/lib/constants.js` (lines 19-38)
- Pattern: Schema-driven config loading with flat/nested/alias lookup priority
- Used by: `loadConfig()`, `cmdValidateConfig()`, `cmdConfigMigrate()`

**Frontmatter Parser:**
- Purpose: Custom YAML frontmatter CRUD optimized for GSD planning file subset
- Location: `src/lib/frontmatter.js`
- Pattern: Stack-based parser with LRU cache (max 100 entries), supports nested objects and arrays
- Used by: Every command that reads planning documents

**Output System:**
- Purpose: Unified JSON output with field filtering and large-payload handling
- Location: `src/lib/output.js`
- Pattern: `output(result, raw)` → JSON to stdout; payloads >50KB written to tmpfile with `@file:` prefix
- Used by: Every command handler

**Lazy Module Loading:**
- Purpose: Avoid parsing all 13 command modules when only one runs per invocation
- Location: `src/router.js` (lines 10-24)
- Pattern: `function lazyX() { return _modules.x || (_modules.x = require('./commands/x')); }`
- Saves: ~20-30ms startup time per invocation

**File Cache (`cachedReadFile`):**
- Purpose: Avoid redundant disk reads within single CLI invocation
- Location: `src/lib/helpers.js` (lines 30-40)
- Pattern: Module-level Map, lives for single process lifetime, invalidatable per-path

## Entry Points

**CLI Entry (`bin/gsd-tools.cjs`):**
- Location: Built from `src/index.js` → `src/router.js`
- Triggers: Workflow markdown files via `node /path/to/gsd-tools.cjs <command> [args] [--raw]`
- Responsibilities: Parse args → route to command → output JSON or error

**Build Entry (`build.js`):**
- Location: `build.js` (project root)
- Triggers: `npm run build` or `deploy.sh`
- Responsibilities: esbuild bundle → smoke test → size tracking

**Deploy Entry (`deploy.sh`):**
- Location: `deploy.sh` (project root)
- Triggers: Manual developer action
- Responsibilities: Build → backup → copy to `~/.config/opencode/get-shit-done/` → smoke test → rollback on failure

**Workflow Entry (per-workflow):**
- Location: `workflows/*.md` (44 files)
- Triggers: OpenCode slash commands (e.g., `/gsd-execute-phase`, `/gsd-plan-phase`)
- Responsibilities: Orchestrate agent behavior by calling gsd-tools and spawning subagents

## Error Handling

**Strategy:** Fail-fast with structured error messages to stderr

**Patterns:**
- CLI errors: `output.error(message)` → writes to stderr → `process.exit(1)`
- File read failures: `safeReadFile()` returns `null` (graceful degradation) or `cachedReadFile()` with null caching
- Git failures: `execGit()` returns `{ exitCode, stdout, stderr }` — callers check exitCode
- Config parse failures: Falls back to `CONFIG_SCHEMA` defaults (never crashes)
- Large output: JSON >50KB automatically written to tmpfile, stdout gets `@file:/path` reference
- Debug mode: `GSD_DEBUG=1` env var enables `debugLog()` to stderr for troubleshooting
- Frontmatter parse failures: Returns empty `{}` (never crashes on malformed YAML)

## Cross-Cutting Concerns

**Caching:**
- File cache: `cachedReadFile()` in `src/lib/helpers.js` (module-level Map, per-invocation)
- Directory cache: `cachedReaddirSync()` in `src/lib/helpers.js`
- Phase tree cache: `getPhaseTree()` in `src/lib/helpers.js` (single scan, per-invocation)
- Config cache: `_configCache` in `src/lib/config.js` (keyed by cwd)
- Milestone cache: `_milestoneCache` in `src/lib/helpers.js`
- Frontmatter cache: `_fmCache` in `src/lib/frontmatter.js` (LRU, max 100)
- Regex cache: `_dynamicRegexCache` in `src/lib/regex-cache.js` (LRU, max 200)
- Token estimator cache: Lazy singleton in `src/lib/context.js`

**Logging:** Debug-only via `debugLog(context, message, err)` in `src/lib/output.js` — gated by `GSD_DEBUG` env var, writes to stderr

**Validation:** Schema-driven config validation (`CONFIG_SCHEMA`), frontmatter schema validation (`cmdFrontmatterValidate`), state consistency checks (`cmdStateValidate`), plan structure verification (`cmdVerifyPlanStructure`)

**Authentication:** None — pure CLI tool, no auth layer. Secrets managed via env vars (e.g., `BRAVE_API_KEY` for web search)

**Token Awareness:** Token estimation via `tokenx` library (bundled), with `Math.ceil(text.length / 4)` fallback. Budget checking against configurable `context_window` and `context_target_percent`

---

*Architecture analysis: 2026-02-26*
