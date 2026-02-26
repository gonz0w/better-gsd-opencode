# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**Brave Search API:**
- Purpose: Web search from within GSD workflows (research phases, debugging)
- SDK/Client: Native `fetch()` — direct HTTP call in `src/commands/misc.js` (line 1163)
- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- Auth: `BRAVE_API_KEY` environment variable or `~/.gsd/brave_api_key` file
- Config: `brave_search: true/false` in `.planning/config.json`
- Behavior: Graceful degradation — returns `{ available: false }` when no API key is set. Agent falls back to built-in WebSearch.
- Command: `gsd-tools websearch <query> [--limit N] [--freshness day|week|month]`
- Implementation: `cmdWebsearch()` in `src/commands/misc.js` (lines 1136-1197)

## Data Storage

**Databases:**
- None — GSD uses no databases. All data is stored as flat files.

**File Storage (Local Filesystem Only):**
- `.planning/` directory tree — All project planning state
  - `STATE.md` — Current project state (position, blockers, metrics, decisions)
  - `ROADMAP.md` — Milestone/phase definitions and progress
  - `INTENT.md` — Project intent, outcomes, success criteria
  - `REQUIREMENTS.md` — Structured requirements with traceability
  - `ASSERTIONS.md` — Acceptance criteria per requirement
  - `PROJECT.md` — Project metadata
  - `MILESTONES.md` — Completed milestone archive
  - `config.json` — Project configuration
  - `env-manifest.json` — Machine-specific environment detection (gitignored)
  - `project-profile.json` — Team-visible project profile (committed)
  - `baselines/bundle-size.json` — Bundle size tracking
  - `memory/` — Persistent session memory (JSON files)
    - `bookmarks.json` — File bookmarks
    - `decisions.json` — Decision log (sacred, never pruned)
    - `lessons.json` — Lessons learned (sacred, never pruned)
    - `todos.json` — Task tracking
    - `quality-scores.json` — Quality score history
    - `test-baseline.json` — Test regression baseline
  - `phases/NN-name/` — Phase directories containing PLAN.md, SUMMARY.md, RESEARCH.md, CONTEXT.md, VERIFICATION.md
  - `codebase/codebase-intel.json` — Automated codebase analysis results
  - `milestones/` — Archived milestone phase directories
  - `quick/` — Quick task summaries
  - `research/` — Research outputs

**File Formats:**
- Markdown with YAML frontmatter — All planning documents (parsed by `src/lib/frontmatter.js`)
- JSON — Config, memory stores, codebase intel, env manifest
- No binary data generated

**Caching:**
- In-memory per-invocation caches (no external cache service):
  - File cache: `fileCache` Map in `src/lib/helpers.js` — Avoids redundant `fs.readFileSync` calls
  - Directory cache: `dirCache` Map in `src/lib/helpers.js` — Avoids redundant `readdirSync` calls
  - Phase tree cache: `_phaseTreeCache` in `src/lib/helpers.js` — Single scan of phases directory
  - Config cache: `_configCache` Map in `src/lib/config.js` — One parse per cwd
  - Frontmatter cache: `_fmCache` Map in `src/lib/frontmatter.js` — LRU (max 100 entries)
  - Regex cache: `_dynamicRegexCache` Map in `src/lib/regex-cache.js` — LRU (max 200 entries)
  - Milestone cache: `_milestoneCache` in `src/lib/helpers.js` — One parse per cwd
  - Tokenizer cache: `_estimateTokenCount` lazy singleton in `src/lib/context.js`

## Git Integration

**Direct Git Operations (core integration):**
- Implementation: `execGit()` in `src/lib/git.js` — Uses `execFileSync('git', args)` (no shell)
- Also: `execFileSync('git', ...)` in `src/lib/config.js` for `git check-ignore`

**Git Operations Used:**
- `git rev-parse HEAD` — Get current commit hash (`src/lib/codebase-intel.js`)
- `git rev-parse --abbrev-ref HEAD` — Get current branch name
- `git diff --name-only` — Changed files since commit (incremental analysis)
- `git rev-list --count` — Count commits between hashes (staleness detection)
- `git check-ignore -q` — Check if paths are gitignored (`src/lib/config.js`, `src/lib/codebase-intel.js`)
- `git log` — Session diffs, commit history, velocity metrics (`src/commands/features.js`)
- `git add` / `git commit` — Auto-commit planning docs (`src/commands/misc.js`)
- `git worktree add/list/remove/prune` — Worktree management (`src/commands/worktree.js`)
- `git branch -D` — Branch cleanup during worktree removal
- `git merge --no-ff` — Worktree merge back to main branch

**Git Worktree System (`src/commands/worktree.js`):**
- Purpose: Isolate parallel plan execution in separate working directories
- Commands: `create`, `list`, `remove`, `cleanup`, `merge`, `check-overlap`
- Config: `worktree` section in `.planning/config.json`
- Default base path: `/tmp/gsd-worktrees`
- File sync: `.env`, `.env.local`, `.planning/config.json` copied to worktrees
- Setup hooks: Optional shell commands run after worktree creation
- Lock file: `.planning/.analysis-lock` prevents concurrent background analyses

## OpenCode Integration

**Host Application:**
- GSD is a plugin for [OpenCode](https://github.com/opencode-ai/opencode)
- Deployed to: `~/.config/opencode/get-shit-done/`
- OpenCode invokes GSD via slash commands that call workflow `.md` files
- Workflow files reference `gsd-tools` CLI commands for data operations

**MCP Server Discovery (`src/commands/mcp.js`):**
- Purpose: Profile MCP servers to estimate context budget impact
- Sources scanned:
  - `.mcp.json` (project-level MCP config)
  - `opencode.json` (project-level OpenCode config)
  - `~/.config/opencode/opencode.json` (user-level OpenCode config)
- Known server database: 20 servers with token cost estimates (postgres, github, brave-search, context7, terraform, docker, podman, filesystem, puppeteer, sqlite, redis, rabbitmq, pulsar, consul, vault, slack, linear, notion, sentry, datadog)
- Actions: `--apply` disables recommended servers in `opencode.json`, `--restore` reverts from backup
- Command: `gsd-tools mcp-profile [--apply] [--restore] [--dry-run]`

## Authentication & Identity

**Auth Provider:**
- None — GSD has no authentication system. It operates as a local CLI tool.
- Brave Search API key is the only credential: `BRAVE_API_KEY` env var or `~/.gsd/brave_api_key` file

## Monitoring & Observability

**Error Tracking:**
- None — No external error tracking service

**Logs:**
- Debug logging via `debugLog()` in `src/lib/output.js`
- Enabled by `GSD_DEBUG` environment variable
- Output to stderr (never contaminates JSON stdout)
- Format: `[GSD_DEBUG] context: message | error_message`

**Performance Tracking:**
- Bundle size: Tracked in `.planning/baselines/bundle-size.json` (updated on each build)
- Execution metrics: Stored in `STATE.md` performance table (plan duration, tasks, files)
- Quality scores: Tracked in `.planning/memory/quality-scores.json` with trend analysis
- Context budget: Measured via `context-budget baseline/compare` commands

## CI/CD & Deployment

**Hosting:**
- Local filesystem only — No cloud deployment
- Plugin installed at `~/.config/opencode/get-shit-done/`

**CI Pipeline:**
- None detected — No `.github/workflows/`, `.gitlab-ci.yml`, or similar CI config in the repo

**Deployment Script (`deploy.sh`):**
1. Build from source (`npm run build`)
2. Backup current installation (`$DEST.bak-YYYYMMDD-HHMMSS`)
3. Copy `bin/`, `workflows/`, `templates/`, `references/`, `src/`, `VERSION`
4. Smoke test deployed artifact
5. Auto-rollback on failure

## Environment Detection

**Built-In Environment Scanner (`src/commands/env.js`):**
- Purpose: Detect project languages, tools, runtimes for target codebases GSD manages
- 26 language manifest patterns (Node, Go, Elixir, Rust, Python, Ruby, PHP, Java, Kotlin, Swift, C++, Docker, Nix, Deno, Bun, etc.)
- Package manager detection with lockfile precedence (bun > pnpm > yarn > npm, mix, go-modules, cargo, bundler, poetry, pipenv)
- Version manager detection (asdf, mise, nvm, pyenv, rbenv, goenv)
- CI platform detection (GitHub Actions, GitLab CI, CircleCI, Jenkins, Travis)
- Test framework detection (jest, vitest, mocha, ExUnit, go test, pytest, rspec, phpunit)
- Linter/formatter detection (eslint, prettier, biome, credo, golangci-lint, ruff, rubocop)
- Docker service parsing from `docker-compose.yml`
- MCP server detection from config files
- Monorepo detection (pnpm workspaces, npm workspaces, Cargo workspace, Go workspace)
- Outputs:
  - `.planning/env-manifest.json` — Machine-specific (gitignored)
  - `.planning/project-profile.json` — Team-visible (committed)

## Codebase Intelligence

**Analysis Engine (`src/lib/codebase-intel.js`):**
- Full codebase file walking with language detection (50+ file extensions)
- Incremental analysis via git diff (only re-analyzes changed files)
- Staleness detection: git-based (commit hash), mtime-based (fallback), time-based (1hr max age)
- Background analysis: `src/commands/codebase.js` spawns detached child process for non-blocking updates
- Output: `.planning/codebase/codebase-intel.json`

**Import Parsing (`src/lib/deps.js`):**
- Multi-language import parsers: JavaScript/TypeScript, Python, Go, Elixir, Rust
- Dependency graph building (forward + reverse edges)
- Cycle detection (Tarjan's SCC algorithm)
- Transitive impact analysis (BFS on reverse edges)

**Convention Detection (`src/lib/conventions.js`):**
- File naming pattern classification (camelCase, PascalCase, snake_case, kebab-case)
- File organization analysis (flat vs nested, test placement, config placement)
- Framework-specific convention extraction (currently: Elixir/Phoenix)

**Lifecycle Detection (`src/lib/lifecycle.js`):**
- Migration ordering (generic: timestamp/sequence, Elixir/Phoenix: config→boot→seed→router)
- DAG construction with cycle detection and topological sort

## Webhooks & Callbacks

**Incoming:**
- None — GSD is a CLI tool, not a web service

**Outgoing:**
- Brave Search API only (when configured)

## Environment Configuration

**Required env vars:**
- None — GSD works with zero environment variables

**Optional env vars:**
- `BRAVE_API_KEY` — Brave Search API authentication
- `GSD_DEBUG` — Enable debug logging
- `GSD_NO_TMPFILE` — Disable temp file output for large payloads

**Required tools:**
- `node` >= 18 — Runtime
- `git` — All git operations (commit tracking, worktree, diffing)

**Optional tools:**
- `which` — Binary detection in `src/commands/env.js`
- `du` — Disk usage in `src/commands/worktree.js`
- `df` — Available space check in `src/commands/worktree.js`

## Test Framework Detection (for Target Projects)

GSD can detect and run tests for projects it manages. Auto-detection in `src/commands/verify.js`:
- `package.json` present → `npm test`
- `mix.exs` present → `mix test`
- `go.mod` present → `go test ./...`
- Override via `test_commands` in `.planning/config.json`

Test output parsers support:
- ExUnit format
- Go test format
- pytest format

---

*Integration audit: 2026-02-26*
