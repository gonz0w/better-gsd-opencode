# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- JavaScript (ES2020+ / CommonJS) — All source code in `src/`, build tooling in `build.js`

**Secondary:**
- Markdown — Workflow definitions (`workflows/*.md`), templates (`templates/*.md`), reference docs (`references/*.md`)
- JSON — Configuration (`templates/config.json`, `.planning/config.json`, `package.json`)
- Shell (Bash) — Deployment script (`deploy.sh`)

## Runtime

**Environment:**
- Node.js >= 18 (specified in `package.json` engines field)
- Current dev environment: Node.js v25.6.1

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present, lockfileVersion 3)

## Frameworks

**Core:**
- None — This is a zero-framework CLI tool. Pure Node.js with standard library only.

**Testing:**
- `node:test` (built-in) — Node's native test runner, used in `bin/gsd-tools.test.cjs`
- `node:assert` (built-in) — Assertion library used alongside `node:test`
- Test count: 348 tests (per `README.md`)

**Build/Dev:**
- esbuild `^0.27.3` (devDependency) — Bundles `src/index.js` into `bin/gsd-tools.cjs`

## Key Dependencies

**Critical (runtime):**
- `tokenx` `^1.3.0` — Fast token estimation (~96% accuracy, 2KB) for context budget calculations. Used in `src/lib/context.js`. Bundled into `bin/gsd-tools.cjs` via esbuild. Falls back to `Math.ceil(text.length / 4)` if tokenx fails to load.

**Infrastructure (devDependency):**
- `esbuild` `^0.27.3` — Build system. Bundles all source + tokenx into a single CJS file. Config in `build.js`.

**Node.js Built-in Modules Used:**
- `fs` — File system operations (read/write planning docs, codebase analysis)
- `path` — Path resolution throughout
- `child_process` (`execFileSync`, `execSync`, `spawn`) — Git operations, test execution, environment detection, worktree management
- `os` — Temp directory paths, homedir for config
- `crypto` — Not directly imported (no crypto operations)

## Build System

**Entry Point:** `src/index.js`
**Output:** `bin/gsd-tools.cjs` (single bundled file, ~657KB, 16,436 lines)
**Bundle Budget:** 1000KB (enforced in `build.js`)

**Build Configuration (`build.js`):**
- Platform: `node`
- Format: `cjs` (CommonJS)
- Target: `node18`
- Minify: `false` (kept readable for debugging)
- Sourcemaps: `false`
- External: All Node.js built-ins (`node:*`, `fs`, `path`, `os`, `child_process`, etc.)
- Bundled: `tokenx` (npm dependency bundled into output)
- Custom plugin: `stripShebangPlugin` — removes shebangs from source files to avoid duplicates
- Banner: `#!/usr/bin/env node` added to output
- Post-build: Smoke test (`current-timestamp --raw`), bundle size tracking to `.planning/baselines/bundle-size.json`

**Build Command:**
```bash
npm run build          # Runs: node build.js
```

**Test Command:**
```bash
npm test               # Runs: node --test bin/gsd-tools.test.cjs
```

## Source Architecture

**Total Source Lines:** ~25,500+ (across `src/` directory)
**Source Modules:** 20 files total:
- `src/index.js` (5 lines) — Entry point
- `src/router.js` (776 lines) — Command dispatch with lazy module loading
- `src/commands/*.js` (13 modules) — Command implementations
- `src/lib/*.js` (9 modules) — Shared libraries

**Key source files by size (descending):**
- `src/commands/verify.js` — 1,984 lines (verification suite)
- `src/commands/features.js` — Large (session-diff, context-budget, codebase-impact, velocity, etc.)
- `src/commands/init.js` — Large (compound initialization for all workflows)
- `src/commands/env.js` — 1,177 lines (environment detection)
- `src/lib/constants.js` — 1,088 lines (model profiles, config schema, command help)
- `src/lib/helpers.js` — 946 lines (file I/O, phase helpers, intent parsing)
- `src/commands/worktree.js` — 791 lines (git worktree management)
- `src/router.js` — 776 lines (command routing)
- `src/lib/deps.js` — 697 lines (import parsing, dependency graphs, cycle detection)
- `src/commands/state.js` — 652 lines (STATE.md management)
- `src/lib/conventions.js` — 644 lines (naming/framework convention detection)
- `src/lib/lifecycle.js` — 569 lines (lifecycle ordering detection)
- `src/lib/codebase-intel.js` — 570 lines (codebase analysis engine)

## Configuration

**Project-Level Config:**
- `.planning/config.json` — Per-project settings (mode, depth, model profiles, gates, parallelization, worktree, etc.)
- Template: `templates/config.json` (default config with all sections)
- Schema: `CONFIG_SCHEMA` in `src/lib/constants.js` — 17 validated keys with types, defaults, aliases, and nested path lookups

**Key config sections:**
- `model_profile` — Agent model selection: `quality` / `balanced` / `budget`
- `mode` — Execution mode: `interactive` / `yolo`
- `depth` — Planning depth: `standard`
- `parallelization` — Parallel plan execution settings
- `gates` — Confirmation gates for workflow steps
- `worktree` — Git worktree isolation settings
- `test_commands` — Custom test commands by framework
- `test_gate` — Block plan completion on test failure
- `context_window` — Token budget (default: 200,000)
- `context_target_percent` — Target utilization (default: 50%)
- `brave_search` — Enable Brave Search API integration

**User-Level Config:**
- `~/.gsd/defaults.json` — User-wide default settings (applied during `config-ensure-section`)
- `~/.gsd/brave_api_key` — Brave Search API key file

**Environment Variables:**
- `BRAVE_API_KEY` — Brave Search API authentication
- `GSD_DEBUG` — Enable debug logging to stderr
- `GSD_NO_TMPFILE` — Disable temp file output for large payloads

**Global CLI Flags:**
- `--raw` — JSON output mode
- `--verbose` — Full output (default is compact)
- `--compact` — Compact output (default, backward-compat)
- `--manifest` — Include context manifest in compact output
- `--fields <f1,f2>` — Filter JSON output to specified fields (dot-notation supported)

## Deployment

**Development:**
```bash
node bin/gsd-tools.cjs <command> [args] --raw    # Run from dev workspace
npm run build                                      # Rebuild bundle
npm test                                           # Run test suite
```

**Production Deployment:**
- Target: `~/.config/opencode/get-shit-done/` (OpenCode plugin directory)
- Script: `deploy.sh` — Builds, backs up existing install, copies `bin/`, `workflows/`, `templates/`, `references/`, `src/`, `VERSION`, runs smoke test, auto-rollback on failure
- Version tracking: `VERSION` file (current: `1.20.5`)

**What Gets Deployed:**
```
~/.config/opencode/get-shit-done/
  bin/gsd-tools.cjs     # Built CLI bundle
  workflows/*.md        # 44 workflow definitions
  templates/*.md        # 28 document templates
  references/*.md       # 13 reference docs
  src/                  # Source code (for build reproducibility)
  VERSION               # Version identifier
```

## Platform Requirements

**Development:**
- Node.js >= 18
- Git (required for git operations, commit tracking, worktree management)
- npm (for dependency management)

**Production (Runtime):**
- Node.js >= 18
- Git (required — execFileSync('git', ...) called in `src/lib/git.js` and `src/lib/config.js`)
- OpenCode CLI (host application that loads GSD as a plugin)
- Standard POSIX tools: `which`, `du`, `df` (used by `src/commands/env.js`, `src/commands/worktree.js`)

---

*Stack analysis: 2026-02-26*
