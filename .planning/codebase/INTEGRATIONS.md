# External Integrations

**Analysis Date:** 2026-03-07

## System Dependencies

**Required:**
- `node` >= 18 — Runtime for all CLI operations. v22.5+ recommended for SQLite cache.
- `git` — Primary external binary. Used for commits, diffs, logs, worktrees, branch management, file history, staleness detection. Invoked via `execFileSync('git', args)` in `src/lib/git.js` (no shell spawning for security/performance).

**Optional CLI tools:**
- `yt-dlp` — YouTube search and transcript extraction for research pipeline. Detected via `checkBinary()` in `src/commands/env.js`. Configurable path via `ytdlp_path` in config.
- `notebooklm-py` (or `nlm`) — NotebookLM RAG synthesis. Browser-based tool requiring Playwright + Chromium. Detected with fallback from `notebooklm-py` to `nlm` binary name. Configurable via `nlm_path` in config.

**Optional platform tools (detected by env scanner for target projects):**
- Docker/Podman, Terraform, Make, Just
- Language-specific: cargo, mix, go, python3, ruby, php, java, swift, cc
- Version managers: asdf, mise, nvm, pyenv, rbenv, goenv

## APIs & External Services

**Brave Search API (optional):**
- Purpose: Web search during research phases
- SDK/Client: Node.js native `fetch()` (built-in since Node 18)
- Auth: `BRAVE_API_KEY` environment variable
- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- Implementation: `src/commands/misc.js` (`cmdWebsearch`)
- Config toggle: `brave_search` in `.planning/config.json` (default: `false`)
- Graceful degradation: If no API key, returns `{ available: false }` — agent falls back to built-in WebSearch MCP tool
- Parameters: query, count, country, search_lang, freshness

**No other external APIs.** This is a local-only CLI tool. All other operations use the local filesystem and git.

## MCP Server Integrations

**Discovery (src/commands/mcp.js):**
- Reads MCP server configs from multiple sources:
  - `.mcp.json` in project root (standard MCP config)
  - `opencode.json` in project root
  - `~/.config/opencode/opencode.json` (user-level)
- Deduplicates by server name (project-level takes priority)

**Known Server Database (19 servers profiled):**
- `postgres` — 12 tools, ~4,500 tokens
- `github` — 30 tools, ~46,000 tokens
- `brave-search` — 3 tools, ~2,500 tokens
- `context7` — 2 tools, ~1,500 tokens
- `terraform` — 8 tools, ~6,000 tokens
- `docker` / `podman` — 10 tools, ~5,000 tokens each
- `filesystem` — 8 tools, ~3,000 tokens
- `puppeteer` — 12 tools, ~8,000 tokens
- `sqlite` — 6 tools, ~3,000 tokens
- `redis` — 8 tools, ~3,500 tokens
- `rabbitmq` — 6 tools, ~3,000 tokens
- `pulsar` — 8 tools, ~4,000 tokens
- `consul` — 5 tools, ~2,500 tokens
- `vault` — 8 tools, ~4,000 tokens
- `slack` — 15 tools, ~12,000 tokens
- `linear` — 20 tools, ~15,000 tokens
- `notion` — 12 tools, ~6,000 tokens
- `sentry` — 8 tools, ~4,000 tokens
- `datadog` — 10 tools, ~5,000 tokens

**Relevance Scoring:**
- Matches server names against project file indicators (e.g., `prisma/schema.prisma` → postgres)
- Checks env hints in `.env*` files (e.g., `REDIS_URL` → redis)
- Some servers always relevant: `brave-search`, `context7`, `filesystem`
- Low-cost servers (<1,000 tokens) always recommended to keep

**MCP Research Servers (src/commands/research.js):**
- Three specific servers detected for the research pipeline:
  - `brave-search` — Web search
  - `context7` — Library documentation lookup
  - `exa` — Semantic code search
- Detection reads editor MCP config from `~/.config/oc/opencode.json` or configurable path
- Config key: `mcp_config_path` in `.planning/config.json`

## Research Pipeline (RAG)

**Implementation:** `src/commands/research.js` (~2,002 lines)

**Tiered degradation system:**
- Tier 1 (Full RAG): YouTube + MCP + NotebookLM synthesis
- Tier 2 (Sources without synthesis): YouTube + MCP sources, LLM synthesizes
- Tier 3 (Brave/Context7 only): Web search sources only
- Tier 4 (Pure LLM): No external sources, LLM knowledge only

**Config:** `rag_enabled` (default: `true`), `rag_timeout` (default: 30s per tool)

**Research commands:**
- `research:capabilities` — Report available tools and current tier
- `research:yt-search` — YouTube search with quality scoring (recency + views + duration)
- `research:yt-transcript` — Extract video transcripts via yt-dlp subtitle download
- `research:collect` — Full pipeline: YouTube → MCP → NotebookLM, with session resumption
- `research:nlm-create` — Create NotebookLM notebook
- `research:nlm-add-source` — Add source to notebook
- `research:nlm-ask` — Ask question to notebook
- `research:nlm-report` — Generate research report

**Research caching:** Results cached in SQLite (same `CacheEngine` as file cache) with TTL-based expiration. Session state persisted to `.planning/.research-session.json` for pipeline resumption.

## Git Integration

**Git is the primary external dependency** — used pervasively across the codebase:

- **Client:** `execFileSync('git', args)` via `src/lib/git.js` (`execGit` wrapper)
- **No shell spawning:** Uses `execFileSync` directly, bypassing shell interpretation for security and ~2ms performance gain per call
- **Structured operations in `src/lib/git.js`:**
  - `structuredLog()` — Parsed commit log with file stats
  - `diffSummary()` — Diff summary between refs
  - `blame()` — File blame with structured output
  - `branchInfo()` — Current branch, remote tracking status
  - `selectiveRewind()` — Safe revert with dry-run support
  - `trajectoryBranch()` — Create trajectory exploration branches
- **Operations across other modules:**
  - Commit creation with agent type tagging (`src/commands/misc.js` — `cmdCommit`)
  - Diff and log queries for session tracking (`src/commands/features.js`)
  - Worktree create/list/remove/merge/cleanup/overlap-check (`src/commands/worktree.js`)
  - Branch management for phase/milestone branching strategies
  - `git check-ignore` for respecting `.gitignore` during file scanning (`src/lib/config.js`)
  - `git rev-parse`, `git rev-list` for staleness detection
  - `git diff --name-only` for incremental codebase analysis

## File System Contracts

**Planning directory (`.planning/`):**
- `.planning/STATE.md` — Project state (current phase, progress, decisions, blockers)
- `.planning/ROADMAP.md` — Phase definitions and milestone tracking
- `.planning/config.json` — Per-project configuration (schema in `src/lib/constants.js`)
- `.planning/phases/` — Phase directories containing `PLAN.md`, `SUMMARY.md`, `RESEARCH.md`
- `.planning/phases/{N}/plans/` — Execution plan files per phase
- `.planning/codebase/codebase-intel.json` — Codebase analysis cache (auto-generated)
- `.planning/codebase/*.md` — Codebase mapping documents (ARCHITECTURE, STACK, etc.)
- `.planning/env-manifest.json` — Environment scan cache (gitignored, machine-specific)
- `.planning/project-profile.json` — Committed project structure profile
- `.planning/memory/` — Persistent memory stores (JSON-per-store):
  - `bookmarks.json`, `decisions.json`, `lessons.json`, `test-baselines.json`, `quality-scores.json`
- `.planning/milestones/` — Archived milestone phase directories
- `.planning/baselines/` — Performance baselines and build analysis
  - `bundle-size.json`, `build-analysis.json`, `performance.json`
  - Per-command timing baselines: `{command}-{timestamp}.json`
- `.planning/intents/` — Intent documents for project goals
- `.planning/trajectories/` — Trajectory exploration checkpoints
- `.planning/.research-session.json` — Research pipeline session state (transient)

**Temporary files:**
- Large JSON payloads (>50KB) written to `os.tmpdir()` as `gsd-*.json`
- Cleaned up on process exit via `process.on('exit')` handler in `src/lib/output.js`

**Persistent cache:**
- SQLite database at `~/.config/oc/get-shit-done/cache.db`
- Two tables: `file_cache` (file content with mtime staleness), `research_cache` (TTL-based research results)
- LRU eviction at 1,000 entries (configurable)
- Falls back to in-memory Map when `node:sqlite` unavailable

**In-memory caches (per CLI invocation, not persisted):**
- `_configCache` — Config.json parse cache (`src/lib/config.js`)
- `_fmCache` — Frontmatter parse cache, LRU at 100 entries (`src/lib/frontmatter.js`)
- `_dynamicRegexCache` — Regex compilation cache, LRU at 200 entries (`src/lib/regex-cache.js`)
- `dirCache` — Directory listing cache (`src/lib/helpers.js`)
- `_phaseTreeCache` — Phase directory tree (`src/lib/helpers.js`)
- `_milestoneCache` — Milestone info cache (`src/lib/helpers.js`)

## CLI Interface

**Command namespaces (7):**
- `init:` — Workflow initialization (execute-phase, plan-phase, new-project, new-milestone, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase, progress, memory)
- `plan:` — Planning operations (intent, requirements, roadmap, phases, find-phase, milestone, phase)
- `execute:` — Execution operations (commit, rollback-info, session-diff, session-summary, velocity, worktree, tdd, test-run, trajectory)
- `verify:` — Verification operations (state, verify, assertions, search-decisions, search-lessons, review, context-budget, token-budget, summary, validate, validate-dependencies, validate-config, test-coverage)
- `util:` — Utility operations (config-get, config-set, env, current-timestamp, list-todos, todo, memory, mcp, classify, frontmatter, progress, websearch, history-digest, trace-requirement, codebase, cache, agent, resolve-model, template, generate-slug, verify-path-exists, config-ensure-section, config-migrate, scaffold, phase-plan-index, state-snapshot, summary-extract, quick-summary, extract-sections, git, profiler)
- `research:` — Research pipeline (capabilities, yt-search, yt-transcript, collect, nlm-create, nlm-add-source, nlm-ask, nlm-report)
- `cache:` — Cache management (research-stats, research-clear, status, clear, warm)

**Global flags:**
- `--pretty` — Force formatted output even when piped
- `--raw` — Legacy flag (no-op, auto-detection handles it)
- `--fields <field1,field2>` — Filter JSON output to specific fields (dot-notation supported)
- `--verbose` — Disable compact mode
- `--compact` — Force compact mode (default, no-op)
- `--manifest` — Enable context manifest in compact output
- `--no-cache` — Force Map fallback for cache
- `--help` / `-h` — Print command help to stderr

**Output formats:**
- JSON to stdout (when piped) — consumed by AI agents
- Formatted text with ANSI colors (when TTY) — human-readable
- Large payloads (>50KB) redirected to tmp file with path printed to stdout
- Status/debug messages always to stderr (never contaminates JSON)

## AI Agent Integration

**Host editor environment:**
- gsd-tools runs as a plugin inside the host AI coding assistant
- Communication: CLI invocation (`node bin/gsd-tools.cjs <namespace:command>`) from agent workflows
- All output designed for agent consumption (JSON when piped, structured data)

**Deployed artifacts:**
- Workflow definitions: `workflows/*.md` — Agent workflow prompts
- Command wrappers: `commands/bgsd-*.md` — Slash command definitions deployed to host editor
- Agent system prompts: `agents/gsd-*.md` — Deployed to host editor agents directory
- Reference docs: `references/*.md` — Reference documents loaded by agents
- Templates: `templates/*.md` — Document templates for plans, state, summaries

**Model Profile System:**
- Manages AI model selection across 9 agent types
- Profiles: `quality`, `balanced`, `budget` — defined in `src/lib/constants.js` (`MODEL_PROFILES`)
- Agent types: `gsd-planner`, `gsd-roadmapper`, `gsd-executor`, `gsd-phase-researcher`, `gsd-project-researcher`, `gsd-debugger`, `gsd-codebase-mapper`, `gsd-verifier`, `gsd-plan-checker`
- Model tiers: `opus`, `sonnet`, `haiku`
- Resolution: `src/lib/helpers.js` (`resolveModelInternal`)

## Environment Detection Engine

**Auto-detects target project environments** (for the projects gsd-tools manages):
- Implementation: `src/commands/env.js` (~1,175 lines)
- Scans for 26 language manifest patterns (package.json, go.mod, mix.exs, Cargo.toml, pyproject.toml, etc.)
- Detects package managers from 12 lockfile patterns (npm, pnpm, yarn, bun, mix, cargo, poetry, pipenv, bundler, go-modules)
- Detects version managers (asdf, mise, nvm, pyenv, rbenv, goenv)
- Detects CI platforms (GitHub Actions, GitLab CI, CircleCI, Jenkins, Travis)
- Detects test frameworks, linters, formatters
- Detects Docker/infrastructure services from compose files
- Detects MCP servers from `.mcp.json`
- Detects monorepo/workspace configurations
- Output: `.planning/env-manifest.json` (gitignored) and `.planning/project-profile.json` (committed)
- Staleness detection via watched file mtimes — auto-rescans when manifests change

## Codebase Analysis Engine

**Auto-analyzes target project codebases:**
- Implementation: `src/lib/codebase-intel.js` (591 lines), `src/commands/codebase.js`
- Walks source directories, analyzes files (language, lines, size, mtime)
- Supports 60+ file extensions across 30+ languages (defined in `LANGUAGE_MAP`)
- Incremental analysis via git diff (only re-analyzes changed files)
- Staleness detection: git commit hash comparison, mtime fallback
- Convention detection: naming patterns, file organization, framework patterns (`src/lib/conventions.js`)
- Dependency graph: multi-language import parsing (JS/TS, Python, Go, Elixir, Rust, Ruby, Java, PHP, C/C++) via `src/lib/deps.js`
- AST analysis: function/class/method signature extraction via acorn (JS/TS) or regex (other languages) via `src/lib/ast.js`
- Lifecycle detection: migration ordering, config/boot chains (`src/lib/lifecycle.js`)
- Impact analysis: transitive dependents via BFS on reverse dependency edges
- Cycle detection: Tarjan's SCC algorithm
- Complexity metrics: cyclomatic complexity estimation
- Output: `.planning/codebase/codebase-intel.json`

## Monitoring & Observability

**Error Tracking:**
- None (no external error tracking service)

**Logging:**
- Debug logging to stderr via `debugLog()` in `src/lib/output.js`
- Enabled by `GSD_DEBUG` environment variable
- Format: `[GSD_DEBUG] context: message | error`
- Status messages via `status()` to stderr (visible even when stdout is piped)

**Performance Profiling:**
- Opt-in via `GSD_PROFILE=1`
- Uses `node:perf_hooks` for high-resolution timing
- Zero overhead when disabled (all timer functions return null/no-op)
- Writes timing baselines to `.planning/baselines/{command}-{timestamp}.json`
- Profiler commands: `util:profiler compare`, `util:profiler cache-speedup`
- Implementation: `src/lib/profiler.js` (116 lines), `src/commands/profiler.js`

**Metrics:**
- Execution velocity tracking: `src/commands/features.js` (`cmdVelocity`)
- Quality scores with trend tracking: stored in `.planning/memory/quality-scores.json`
- Bundle size tracking: `.planning/baselines/bundle-size.json`
- Build module analysis: `.planning/baselines/build-analysis.json`
- Build timing: logged to stdout during `npm run build`

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None (except the optional Brave Search API call)

---

*Integration audit: 2026-03-07*
