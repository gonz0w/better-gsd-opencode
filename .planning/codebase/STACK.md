# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- JavaScript (CommonJS) — All source code in `src/`, build tooling, tests

**Secondary:**
- Bash — `deploy.sh` deployment script
- Markdown — 44 workflow files in `workflows/`, 28 template files in `templates/`, 13 reference files in `references/`

## Runtime

**Environment:**
- Node.js >= 18 (specified in `package.json` `engines` field)
- Uses `node:test` built-in test runner (no external test framework)
- Uses `fetch()` global (available in Node 18+) for HTTP requests

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- None — This is a zero-framework CLI tool. Pure Node.js with only built-in modules for core functionality.

**Build:**
- esbuild ^0.27.3 (devDependency) — Bundles `src/index.js` → `bin/gsd-tools.cjs`
  - Config: `build.js` (94 lines)
  - Target: `node18`, format: `cjs`, platform: `node`
  - Externalizes all Node.js built-ins, bundles npm dependencies (tokenx)
  - Bundle budget: 700KB enforced in `build.js` (line 60)
  - Outputs size record to `.planning/baselines/bundle-size.json`
  - Smoke test runs `current-timestamp --raw` after each build

**Testing:**
- `node:test` (Node.js built-in test runner)
  - Test file: `bin/gsd-tools.test.cjs` (13,040 lines)
  - Run: `node --test bin/gsd-tools.test.cjs` or `npm test`
  - Assertions: `node:assert` built-in
  - Pattern: `describe()` / `test()` blocks, temp directory fixtures

## Key Dependencies

**Runtime (Production):**
- `tokenx` ^1.3.0 — Token count estimation for LLM context budget analysis
  - Used in: `src/lib/context.js` (lazy-loaded)
  - Fallback: `Math.ceil(text.length / 4)` if tokenx fails to load
  - Bundled into `bin/gsd-tools.cjs` by esbuild

**Development:**
- `esbuild` ^0.27.3 — JavaScript bundler (build tool only, not shipped)

**Node.js Built-in Modules Used:**
- `fs` — File system operations (read/write planning docs, config)
- `path` — Path resolution and manipulation
- `child_process` (`execSync`, `execFileSync`) — Git commands, test execution, binary version detection
- `os` — Home directory (`~/.gsd/`), temp directories
- `crypto` — (externalized but available)
- `node:test` — Test runner
- `node:assert` — Test assertions

## Source Code Metrics

**Source files:** 24 JavaScript files in `src/`
- `src/index.js` — Entry point (5 lines)
- `src/router.js` — Command routing with lazy-loaded modules (772 lines)
- `src/commands/` — 13 command modules
- `src/lib/` — 11 library modules

**Total source lines:** ~23,134 lines across all `.js` files

**Built bundle:** `bin/gsd-tools.cjs` — ~614KB, 15,348 lines (gitignored, regenerated on build)

## Configuration

**Project-level (per-project):**
- `.planning/config.json` — Project settings with schema validation
  - Schema defined in: `src/lib/constants.js` (`CONFIG_SCHEMA`)
  - Template: `templates/config.json`
  - Key settings: `model_profile`, `commit_docs`, `research`, `parallelization`, `brave_search`, `test_commands`, `context_window`

**User-level (global):**
- `~/.gsd/defaults.json` — User-level config overrides (optional)
- `~/.gsd/brave_api_key` — Brave Search API key file (optional)

**Environment Variables:**
- `BRAVE_API_KEY` — Brave Search API authentication (optional)
- `GSD_DEBUG` — Enable debug logging to stderr
- `GSD_NO_TMPFILE` — Skip file redirect for large JSON output

**Build Configuration:**
- `build.js` — esbuild config (entry: `src/index.js`, output: `bin/gsd-tools.cjs`)
- `package.json` — npm scripts: `build`, `test`

## Architecture: Single-File CLI Bundle

The source is developed as modular files in `src/` but built into a single CJS bundle:

```
src/index.js          → entry point
src/router.js         → command dispatch (lazy-loading)
src/commands/*.js     → 13 command modules
src/lib/*.js          → 11 shared libraries
        ↓ (esbuild)
bin/gsd-tools.cjs     → single executable (gitignored)
```

**Lazy loading:** All 13 command modules are lazy-loaded in `src/router.js` (lines 10-24). Only the module needed for the invoked command is loaded per execution.

**Caching layers:**
- File content cache: `src/lib/helpers.js` (`fileCache` Map)
- Directory listing cache: `src/lib/helpers.js` (`dirCache` Map)
- Phase tree cache: `src/lib/helpers.js` (`_phaseTreeCache`)
- Frontmatter parse cache: `src/lib/frontmatter.js` (`_fmCache` Map, LRU, max 100)
- Regex cache: `src/lib/regex-cache.js` (`_dynamicRegexCache` Map, LRU, max 200)
- Config cache: `src/lib/config.js` (`_configCache` Map)
- Milestone cache: `src/lib/helpers.js` (`_milestoneCache`)
- Token estimator: `src/lib/context.js` (`_estimateTokenCount` singleton)

All caches live for a single CLI invocation (no TTL needed since the process exits).

## Deployment

**Development → Production pipeline:**
1. Edit source in `src/`
2. `npm run build` (esbuild bundles → `bin/gsd-tools.cjs`, runs smoke test, checks bundle budget)
3. `./deploy.sh` copies `bin/`, `workflows/`, `templates/`, `references/`, `src/`, `VERSION` to `~/.config/opencode/get-shit-done/`
4. Deploy includes backup + smoke test + rollback on failure

**Target installation:**
- `~/.config/opencode/get-shit-done/` — OpenCode plugin directory
- Invoked by OpenCode (AI coding assistant) via workflow markdown files that call `gsd-tools` commands

**Versioning:**
- `VERSION` file contains version string: `1.20.5`

## Platform Requirements

**Development:**
- Node.js >= 18
- npm
- Git (for git operations, tests)

**Production (runtime):**
- Node.js >= 18
- Git (CLI tool heavily uses `git` commands via `execFileSync`)
- No network access required (Brave Search is optional)
- File system access to `.planning/` directory in target projects

---

*Stack analysis: 2026-02-26*
