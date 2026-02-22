# Project Research Summary

**Project:** GSD Plugin CLI (gsd-tools.cjs) — Build, Test & Quality Improvement
**Domain:** Node.js CLI tool refactoring — single-file monolith to bundled, tested, observable system
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

This project improves a 6,495-line single-file Node.js CLI tool (`gsd-tools.cjs`) that serves as the backend for an AI planning plugin. The tool is working and deployed, but has accumulated significant quality debt: 55 silent catch blocks, 309+ regex patterns with no backward-compatibility tests, a 3-way split config schema, and only 24% test coverage (19/79 commands). The research confirms that the right approach is **incremental improvement within the existing architecture** — not a rewrite. The tool's single-file CJS design, synchronous I/O, and manual arg routing are all correct choices for a short-lived CLI invoked by AI agents. What's needed is observability (logging), safety nets (tests), and optional developer ergonomics (module splitting via esbuild bundling).

The recommended stack is minimal: **esbuild** for bundling split source files back into the single-file deployment artifact, and **lru-cache v10** for bounded in-memory file caching. These are the only two dependencies to add — esbuild as a dev dependency, lru-cache as a bundled runtime dependency. The architecture follows a strict `router → commands → lib` dependency direction, with esbuild producing the same zero-runtime-dependency single-file artifact that exists today. The key insight from research: deploy.sh, workflows, agents, and slash commands **see no change** — the bundled output drops into the exact same `bin/gsd-tools.cjs` path.

The top risks are: (1) the bundler breaking `deploy.sh` if they aren't updated together, (2) replacing silent catches with logging that corrupts the stdout JSON data channel, (3) regex "cleanups" during refactoring that break backward compatibility with real `.planning/` files, and (4) the config schema extraction silently dropping field aliases. Every one of these has a concrete prevention strategy documented in PITFALLS.md, and the phase ordering below is designed to build safety nets (tests, golden fixtures) before touching anything risky.

## Key Findings

### Recommended Stack

The stack is intentionally minimal — two additions to a currently zero-dependency tool.

**Core technologies:**
- **esbuild 0.27.3**: Bundler (dev dependency) — bundles split `src/` modules into single `bin/gsd-tools.cjs`. Sub-100ms builds, native CJS→CJS support, shebang via `banner` option. Critical config: must set `packages: 'bundle'` (esbuild 0.22+ defaults to external for `--platform=node`).
- **lru-cache 10.4.3**: In-memory file cache (bundled runtime dependency) — bounded LRU with max entries and TTL safety. Zero dependencies in v10. Must pin v10, not v11 (v11 requires Node 20+, project targets Node 18+).
- **Node.js >=18**: Runtime — already the project minimum. Provides `node:test`, global `fetch`. No change needed.

**What NOT to add:** TypeScript (rewrite, not improvement), Rollup/webpack (wrong tool for CJS→CJS CLI), commander/yargs (manual router is better for 79 subcommands), unified/remark (heavy AST parser replaces working regexes), node-cache (unmaintained since 2020).

### Expected Features

**Must have (table stakes — P0):**
- **Debug logging via `GSD_DEBUG` env var** — replaces 55 silent catch blocks with gated stderr logging. ~10 lines for the helper.
- **Single `CONFIG_SCHEMA` constant** — eliminates 3-way config definition drift between `loadConfig()`, `cmdConfigEnsureSection()`, `cmdValidateConfig()`. Highest-leverage single refactor.
- **State mutation test coverage** — 8 commands modify STATE.md with zero tests. Highest data-corruption risk.
- **package.json** — formalizes Node 18+ requirement, enables `npm test`/`npm run build`.

**Should have (differentiators — P1):**
- Per-command `--help` support
- Wire 11 existing but unreachable slash commands
- Frontmatter round-trip tests
- Shell interpolation sanitization (5 unguarded `execSync` sites)
- Replace all 55 silent catches with debug logging
- Temp file cleanup (`process.on('exit')`)

**Defer (P2/P3):**
- Snapshot testing (requires Node 22+)
- Plan templates (needs usage patterns to emerge)
- Parallel execution visualization
- Module source splitting via esbuild (nice-to-have, not blocking)

### Architecture Approach

The architecture is a **build-time split, deploy-time monolith**. Source code lives in `src/` as ~15 modules organized by domain (`src/commands/state.js`, `src/lib/config.js`, etc.). esbuild bundles them into the single `bin/gsd-tools.cjs` file. The dependency direction is strict: `router → commands → lib` — command modules never import from each other. The deployed artifact, deploy.sh workflow, and all downstream consumers (workflows, agents, slash commands) are unchanged.

**Major components:**
1. **`src/router.js`** — CLI argv parsing + command dispatch (extracted from current lines 6022–6492)
2. **`src/commands/`** — 12 command modules grouped by domain (state, roadmap, phase, init, features, etc.)
3. **`src/lib/`** — 7 shared internal modules (config, frontmatter, git, markdown, output, cache, constants)
4. **`build.js`** — esbuild build script producing `bin/gsd-tools.cjs` with shebang banner
5. **`bin/gsd-tools.cjs`** — Build output (committed, deployed) — identical role to today's single file

### Critical Pitfalls

1. **deploy.sh breaks after bundler introduction** — The build step creates a new artifact path but deploy.sh still copies the old one. **Prevention:** Update deploy.sh in the same phase as bundler setup. Add smoke test: `./deploy.sh && node ~/.config/opencode/get-shit-done/bin/gsd-tools.cjs current-timestamp --raw`.

2. **Silent catch → logging corrupts stdout JSON** — Adding `console.log()` in catch blocks contaminates the JSON data channel that agents parse. **Prevention:** Only use `process.stderr.write()` gated behind `GSD_DEBUG`. Never log to stdout. Test: `node gsd-tools.cjs state load --raw 2>/dev/null | python3 -c "import json,sys; json.load(sys.stdin)"`.

3. **Regex "cleanups" break backward compatibility** — 309+ patterns include accumulated compat quirks (e.g., `**Goal:?**:?` accepting 4 variants). Simplifying a regex drops a variant used by real files. **Prevention:** Copy real `.planning/` fixtures from event-pipeline as golden test files BEFORE any regex work.

4. **Config schema extraction drops field aliases** — The three config sources use different names (`plan_checker` vs `workflow.plan_check` vs `research_enabled`). A single schema must handle aliases. **Prevention:** Map all three schemas into a comparison table. Write round-trip tests before changing code.

5. **esbuild CJS bundling misconfiguration** — Missing `--platform=node` bundles Node builtins; missing `banner` drops shebang; missing `packages: 'bundle'` leaves npm packages external. **Prevention:** Validate built artifact with smoke test after every config change.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Safety Nets
**Rationale:** Everything else depends on having tests, a package.json, and debug observability. PITFALLS.md is emphatic: tests must exist BEFORE any refactoring. The config schema is a prerequisite for clean testing of config-related functions.
**Delivers:** `package.json`, `GSD_DEBUG` logging helper, `CONFIG_SCHEMA` constant extraction, state mutation tests, frontmatter round-trip tests.
**Addresses:** P0 table stakes (debug logging, config schema, state tests, package.json) + P1 frontmatter tests
**Avoids:** Pitfall 4 (test-induced refactoring) — uses CLI invocation testing pattern, no code exports needed. Pitfall 6 (config schema compat) — maps all three sources before extracting.

### Phase 2: Error Handling & Hardening
**Rationale:** With debug logging helper and tests in place, it's now safe to replace the 55 silent catches. Also addresses shell sanitization and temp file cleanup — small, independent hardening tasks.
**Delivers:** All 55 silent catches replaced with gated debug logging, shell interpolation sanitization, temp file cleanup.
**Addresses:** P1 features (replace silent catches, shell sanitization, temp cleanup)
**Avoids:** Pitfall 2 (logging breaks callers) — debug logging is gated, only writes to stderr, verified by tests from Phase 1.

### Phase 3: Developer Experience & Discoverability
**Rationale:** With the tool stable and observable, improve the surface area. Wire the 11 existing but unreachable commands into slash commands. Add `--help` support. Wire `validate-dependencies`, `search-lessons`, and `context-budget` into their respective workflows.
**Delivers:** 11 slash command files, per-command `--help`, workflow integrations (3 commands wired into execute-phase, plan-phase, execute-plan).
**Addresses:** P1 features (wire commands, --help, workflow integration)
**Avoids:** No significant pitfalls — these are additive changes (new files, not modifying existing logic).

### Phase 4: Build System & Module Split
**Rationale:** This is a developer ergonomics improvement, not a functional requirement. It should come AFTER the tool is well-tested and observable, so that the build system introduction has a full safety net. The PITFALLS.md is clearest here: deploy.sh must be updated in the same phase.
**Delivers:** esbuild build pipeline, `src/` module structure, `build.js`, updated `deploy.sh` with build step + smoke test.
**Addresses:** Stack (esbuild), Architecture (module split), P3 feature (bundle-based build)
**Avoids:** Pitfall 1 (deploy.sh break) — updated simultaneously. Pitfall 5 (esbuild CJS issues) — smoke test validates built artifact.

### Phase 5: Performance & Polish
**Rationale:** With the module structure in place, add lru-cache for bounded file caching. Also address remaining quality-of-life improvements.
**Delivers:** In-memory file cache (lru-cache), batch grep optimization, configurable context window size, config migration command.
**Addresses:** Stack (lru-cache), P2 features (cache, batch grep, config migration)
**Avoids:** Pitfall performance traps — cache invalidation on write is built into the architecture from ARCHITECTURE.md.

### Phase Ordering Rationale

- **Tests before refactoring** (Phase 1 → Phase 4): PITFALLS.md's strongest recommendation. Golden file fixtures and state mutation tests must exist before any code reorganization.
- **Logging before catch replacement** (Phase 1 → Phase 2): The debug helper must exist before replacing silent catches, or the replacements have nowhere to log.
- **Config schema before testing** (Phase 1 early): CONFIG_SCHEMA is a prerequisite for testing config-related functions correctly. Do it first within Phase 1.
- **Additive changes before structural changes** (Phase 3 → Phase 4): Slash commands and --help are new files, not code modifications. They're safe to add before the disruptive module split.
- **Build system last among structural changes** (Phase 4): The module split is the highest-risk change. Having maximum test coverage and observability before attempting it minimizes risk.
- **Performance after correctness** (Phase 5): Caching is an optimization. Get the code correct and well-tested first.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Config Schema):** The 3-way schema mapping requires careful field-by-field analysis of `loadConfig()`, `cmdConfigEnsureSection()`, and `cmdValidateConfig()`. Needs a dedicated research step to produce the alias mapping table.
- **Phase 4 (Build System):** esbuild config for CJS→CJS CLI bundling is non-standard. The `packages: 'bundle'` gotcha and shebang handling need verification against the actual source.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Error Handling):** Well-established pattern — `GSD_DEBUG` env var + `process.stderr.write()`. No novel decisions.
- **Phase 3 (DX & Discoverability):** Slash commands are markdown files. `--help` is a string map. Standard patterns throughout.
- **Phase 5 (Performance):** lru-cache usage is well-documented via Context7. Cache-on-read, invalidate-on-write pattern is standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | esbuild API verified via official docs + Context7. lru-cache API verified via Context7. Version compatibility confirmed via npm registry. |
| Features | HIGH | Feature priorities derived from CONCERNS.md codebase analysis (project-specific, high confidence) + comparable tool patterns (eslint, prettier). |
| Architecture | HIGH | Module structure follows existing section markers in the file. esbuild bundling pattern verified via docs. Build/deploy flow is a direct extension of current workflow. |
| Pitfalls | HIGH | Every pitfall is grounded in specific code locations (line numbers) and verified against esbuild documentation, Node.js error handling patterns, and the project's own CONCERNS.md. |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact config field alias mapping:** Research identified that three config definitions use different field names, but didn't produce the complete mapping table. Phase 1 planning should start with this mapping exercise.
- **Node 18 EOL planning:** Node 18 reached EOL in April 2025 but the project still targets it. lru-cache v11 and snapshot testing (Node 22+) are blocked by this. A decision on when to bump `engines` is needed, though it's not blocking any phase.
- **Golden fixture selection:** PITFALLS.md recommends copying real `.planning/` files from event-pipeline as test fixtures, but doesn't specify which files or at what point in time. Phase 1 planning should select a stable set of fixtures.
- **Test coverage target:** Current coverage is 24% (19/79 commands). Research recommends testing the 8 state mutation commands first but doesn't set an overall target. A practical target for this improvement pass would be ~40% (covering all P0 + P1 commands).

## Sources

### Primary (HIGH confidence)
- Context7 `/evanw/esbuild` — CJS bundling, `packages` option, banner syntax, platform:node behavior
- Context7 `/isaacs/node-lru-cache` — TTL config, cache bounds, CJS import pattern, v10 vs v11 compatibility
- Context7 `/nodejs/node` — `util.parseArgs()` stability, `node:test` snapshot testing availability
- esbuild official API docs (https://esbuild.github.io/api/) — All build configuration options
- npm registry (esbuild, lru-cache, node-cache) — Version verification, publish dates, engine requirements

### Secondary (MEDIUM confidence)
- npm-compare.com — Caching library comparison (lru-cache vs node-cache vs memory-cache)
- Better Stack Node.js logging best practices — Debug logging patterns
- Liran Tal CLI apps guide — `util.parseArgs()` as commander/yargs alternative
- Context7 `/websites/tsup_egoist_dev` — tsup format options (used to confirm tsup is unnecessary for this project)

### Project-Specific (HIGH confidence)
- `.planning/codebase/CONCERNS.md` — 55 silent catches, 309 regex patterns, config drift, test gaps
- `.planning/PROJECT.md` — Constraints, key decisions, scope boundaries
- `bin/gsd-tools.cjs` (6,495 lines) — Direct code inspection for line references and section markers
- `bin/gsd-tools.test.cjs` (2,302 lines) — Existing test patterns and coverage analysis
- `deploy.sh` — Current deployment workflow

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
