# Feature Research

**Domain:** Node.js CLI tool quality & developer experience improvements
**Researched:** 2026-02-22
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any 6,500-line CLI tool should have. Missing these = unreliable tool that's hard to maintain and debug.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Debug logging via env var** | 55 silent catch blocks make debugging impossible. Every mature CLI tool uses `DEBUG=*` or equivalent env-var-gated stderr logging. The `debug` npm package popularized this; Node.js core tools use `NODE_DEBUG`. For a zero-dependency tool, `GSD_DEBUG=1` gating `console.error()` is the standard approach. | LOW | A single `debugLog(context, message)` helper function, ~10 lines. Replace 55 `catch {}` blocks with `catch (e) { debugLog('state', e.message) }`. No behavioral change when env var is unset. |
| **Single CONFIG_SCHEMA constant** | Three independent config definition sites (loadConfig line 158, cmdConfigEnsureSection line 616, cmdValidateConfig line 5932) have already drifted. This is a ticking time bomb — adding a config key requires updating 3 places. Every well-designed CLI with config has one canonical schema. | MEDIUM | Extract one `CONFIG_SCHEMA` object defining key, type, default, description, nested-path aliases. `loadConfig()`, `cmdConfigEnsureSection()`, and `cmdValidateConfig()` all derive from it. ~150 lines of refactoring. |
| **State mutation test coverage** | 8 commands modify STATE.md in-place with regex replacement. Zero test coverage. Any regression silently corrupts project state with no detection. This is the highest-risk gap in the codebase. | MEDIUM | Round-trip tests: create temp STATE.md → run mutation command → verify output. Follow existing test pattern in `gsd-tools.test.cjs`. ~300 lines of tests covering `state update`, `state patch`, `state add-decision`, `state add-blocker`, `state resolve-blocker`, `state record-session`, `state advance-plan`, `state record-metric`. |
| **Frontmatter round-trip tests** | `extractFrontmatter()` → `reconstructFrontmatter()` cycle is untested. If reconstruction loses data, frontmatter CRUD commands silently corrupt files. | LOW | ~100 lines: parse sample frontmatter, reconstruct, assert equality. Test edge cases: nested objects, arrays, quoted strings with colons. |
| **package.json with engines field** | No declared Node.js version requirement. `fetch()` requires Node 18+. Without `package.json`, there's no `npm test` script, no `engines` field, no formal declaration of what this project is. Every Node.js project has a package.json. | LOW | Create minimal `package.json` with `name`, `version`, `engines: { node: ">=18" }`, `scripts: { test: "node --test bin/gsd-tools.test.cjs" }`. No dependencies in production. |
| **Shell interpolation sanitization** | `git log --since="${since}"` where `since` comes from STATE.md parsing. `grep -rl "${pattern}"` where pattern is derived from file content. The `execGit()` helper already escapes properly — but 5+ call sites bypass it with raw `execSync()`. | LOW | Centralize a `sanitizeShellArg()` function. Validate date strings with strict regex. Use `--fixed-strings` for grep patterns. ~30 lines. |
| **Temp file cleanup** | `output()` creates temp files at `os.tmpdir()/gsd-{timestamp}.json` that accumulate forever. Every CLI tool cleans up after itself. | LOW | Use `process.on('exit', ...)` to clean up, or use a fixed filename like `gsd-output.json` that gets overwritten. ~10 lines. |

### Differentiators (Competitive Advantage)

Features that improve the tool significantly but aren't blocking. These make the difference between a working tool and a polished one.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Per-command `--help` support** | Currently `state patch --help` tries to use `--help` as a field name. A `--help` intercept in the router would provide usage info for every command. Node.js 18+ has `util.parseArgs()` built-in which supports typed option definitions — but the current manual router is actually fine for this tool's subcommand-heavy pattern. The simpler approach: check `args.includes('--help')` early in each switch case and print usage. | LOW | Add a `COMMAND_HELP` map at module level with usage strings for each command. Check for `--help` in the router before dispatching. ~200 lines of help text definitions, ~20 lines of router changes. |
| **In-memory file cache** | Commands like `cmdInitProgress()` call multiple internal functions that each re-read ROADMAP.md, STATE.md, and phase directories. A simple `Map`-based cache that lives for the duration of one CLI invocation would eliminate redundant reads. | MEDIUM | Add a `const FILE_CACHE = new Map()` at module level. Wrap `safeRead()` to check cache first. Invalidate on write. ~40 lines. Short-lived process means no stale cache concerns. |
| **Wire unwired commands into slash commands** | 11+ feature commands (`session-diff`, `context-budget`, `test-run`, `search-decisions`, `validate-dependencies`, `search-lessons`, `codebase-impact`, `rollback-info`, `velocity`, `trace-requirement`, `validate-config`) exist but are unreachable via Claude Code slash commands. Features that can't be discovered don't exist to users. | LOW | Create `.md` command files in the plugin's `command/` directory. Each is ~10 lines of markdown invoking `node gsd-tools.cjs <command>`. ~110 lines total across 11 files. |
| **Wire validate-dependencies into execute-phase** | `validate-dependencies` exists but isn't called as a pre-flight check before phase execution. This would catch dependency issues before work begins rather than during execution. | LOW | Add a call to `validate-dependencies` in the `execute-phase.md` workflow. ~5 lines of workflow change. |
| **Wire search-lessons into plan-phase** | `search-lessons` exists but isn't called during planning. Auto-surfacing relevant lessons from completed phases would prevent repeating mistakes. | LOW | Add a call to `search-lessons` in the `plan-phase.md` workflow. ~5 lines of workflow change. |
| **Wire context-budget into execute-plan** | `context-budget` exists but isn't called when loading plans. This would warn agents when a plan is too large for the context window. | LOW | Add a call to `context-budget` in the `execute-plan.md` workflow. ~5 lines of workflow change. |
| **Snapshot testing for regex parsers** | Node.js `node:test` now supports snapshot testing (v22.3.0+, stable in v23.7.0). For 309+ regex patterns parsing markdown, snapshot tests would catch regressions by comparing parsed output against known-good snapshots. Much less effort than writing assertion-based tests for every format variation. | MEDIUM | Requires Node.js 22+. Create snapshot fixtures for each parser function. `t.assert.snapshot(parsePhaseSection(input))`. ~200 lines of test setup plus snapshot files. |
| **Batch grep in cmdCodebaseImpact()** | Currently runs separate `grep -rl` for each search pattern, spawning multiple child processes. Batching into one call would be significantly faster on large codebases. | LOW | Combine patterns with `grep -rl -e pattern1 -e pattern2 ...` or use a single regex alternation. ~20 lines of refactoring. |
| **Configurable context window size** | `cmdContextBudget()` hardcodes 200K context window and 50% target. Different models have different sizes (Claude Opus: 200K, Sonnet: 200K, Haiku: 200K but you may want different targets). | LOW | Read `context_window` and `context_target_percent` from config.json with current values as defaults. ~10 lines. |
| **Plan templates** | Create actual template files in `templates/plans/` (e.g., `ash-resource.md`, `pulsar-function.md`, `go-service.md`). The `plan-templates` infrastructure exists in gsd-tools.cjs but no templates exist yet. | MEDIUM | Create 3-5 template markdown files. Each is ~50-100 lines of structured plan skeleton. Need to understand target project types well enough to be useful. |
| **Config migration for new keys** | When new config keys are added, existing config.json files don't get updated. A `config migrate` command would add new keys with defaults without overwriting existing values. | LOW | Add `cmdConfigMigrate()` that reads existing config, merges with CONFIG_SCHEMA defaults for missing keys, writes back. ~40 lines. |
| **Parallel execution visualization** | Add ASCII dependency/wave visualization to `execute-phase.md` showing which tasks can run in parallel. | MEDIUM | Parse PLAN.md task dependencies, build DAG, render ASCII wave diagram. ~150 lines. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific tool.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full module split of gsd-tools.cjs** | 6,495 lines in one file seems unwieldy | Intentional design choice. Deploy.sh copies bin/ wholesale. Splitting requires build tooling. The file is navigable with search. Splitting adds complexity without proportional benefit for a CLI tool. | If source splitting is desired, use a bundler (esbuild/rollup) to produce single-file output. Dev dependencies are now allowed per PROJECT.md. But this is a "nice to have" not a "must have" — the single file works. |
| **Async I/O rewrite** | "Synchronous I/O is bad practice" | This is a short-lived CLI process, not a server. Sync I/O is simpler, easier to reason about, and has negligible performance impact for file reads. The async rewrite would touch every function for zero user-visible benefit. | Keep sync. The in-memory cache (differentiator above) addresses the only real perf concern (redundant reads). |
| **npm package publishing** | "Make it installable via npm" | This is a plugin deployed via file copy to `~/.config/opencode/`. Publishing to npm adds maintenance burden (versioning, publish workflows, npm auth) for a tool that has exactly one deployment mechanism. | Keep deploy.sh. If broader distribution is needed later, that's a v2 concern. |
| **Markdown AST parser (unified/remark)** | "Regex parsing is fragile, use a proper parser" | Would add heavy dependencies (~20+ packages in the unified ecosystem). The zero-dependency constraint exists for good reason — supply chain simplicity. The 309 regex patterns work today and are tested against real projects. | Improve regex resilience with better test coverage (snapshot tests). Move structured data to YAML frontmatter where possible (already has a parser). |
| **Full argument parsing library (commander/yargs)** | "Proper CLI should use a real arg parser" | The tool has 79 commands with a subcommand-heavy pattern (`state update`, `roadmap analyze`). These libraries optimize for flat flag-based CLIs. The manual router is actually well-suited to this tool's structure. `util.parseArgs()` (built-in to Node 18+) could help for flag parsing within commands but doesn't solve subcommand routing. | Add `--help` interception at the router level. Use `util.parseArgs()` for complex flag-heavy commands if needed. Keep the switch/case router. |
| **Real-time file watching** | "Watch .planning/ for changes and auto-update" | Adds complexity (fs.watch is unreliable, chokidar is a dependency). The tool runs on-demand from agent invocations, not as a daemon. Watching serves no purpose. | Keep on-demand invocation pattern. |
| **Multi-process file locking** | "Prevent concurrent writes to STATE.md" | Only one AI session runs per project at a time. Race conditions are theoretical, not practical. Locking adds complexity and potential deadlocks for a problem that doesn't exist. | Document the single-writer assumption. If it ever becomes a real problem, use atomic writes (write to temp, rename). |
| **Interactive prompts (inquirer/prompts)** | "CLI should be interactive" | This tool is invoked by AI agents programmatically, not by humans interactively. Adding interactive prompts would break the JSON-over-stdout interface. | Keep non-interactive. The `--raw` flag and JSON output is the correct interface for agent consumption. |

## Feature Dependencies

```
[CONFIG_SCHEMA constant]
    └──enables──> [Config migration command]
    └──enables──> [Accurate --help for config commands]
    └──fixes──> [cmdValidateConfig false positives]

[Debug logging (GSD_DEBUG)]
    └──enables──> [Replacing 55 silent catches]
    └──enables──> [Better error reporting in tests]

[package.json]
    └──enables──> [npm test script]
    └──enables──> [engines field for Node 18+ check]
    └──enables──> [Snapshot testing setup (needs --test-update-snapshots)]

[State mutation tests]
    └──requires──> [Test infrastructure (existing)]
    └──enables──> [Safe refactoring of state commands]

[Frontmatter round-trip tests]
    └──requires──> [Test infrastructure (existing)]
    └──enables──> [Safe improvement of YAML parser]

[In-memory file cache]
    └──independent──> (no dependencies, no dependents)

[Per-command --help]
    └──enhanced-by──> [CONFIG_SCHEMA constant] (for config command help)

[Snapshot testing]
    └──requires──> [package.json] (for test scripts)
    └──requires──> [Node.js 22+] (snapshot testing stable)
    └──enhances──> [Regex parser resilience]

[Wire slash commands]
    └──requires──> [Commands already exist in gsd-tools.cjs] (satisfied)
    └──independent of all other features]

[Wire workflow integrations]
    └──requires──> [Commands already exist in gsd-tools.cjs] (satisfied)
    └──independent of all other features]
```

### Dependency Notes

- **CONFIG_SCHEMA enables 3 things:** Once a single schema exists, config migration, help text, and validation all derive from it. This is the highest-leverage single change.
- **Debug logging is a prerequisite for silent catch replacement:** Don't just remove the empty catches — replace them with debug-gated logging first, then the catches have a purpose.
- **Snapshot testing requires Node.js 22+:** The project currently targets Node 18+. If the engines field stays at 18, snapshot testing via `node:test` isn't available. Alternative: use assertion-based tests (works on Node 18+).
- **Wiring commands is independent:** Slash command creation and workflow integration have no code dependencies — they're markdown files that invoke existing CLI commands.

## MVP Recommendation

### Immediate Priority (P0 — Do First)

These address the highest-risk gaps and have the highest leverage.

- [x] **Debug logging helper + GSD_DEBUG env var** — Unblocks all 55 silent catch replacements. ~10 lines for the helper, then incremental catch replacement.
- [x] **CONFIG_SCHEMA constant extraction** — Eliminates 3-way config drift. Highest-leverage refactor.
- [x] **State mutation test coverage** — Highest-risk gap. Data loss without detection.
- [x] **package.json creation** — Formalizes Node 18+ requirement, enables `npm test`.

### Add After Foundation (P1 — High Value, Low Risk)

- [ ] **Frontmatter round-trip tests** — Second-highest data corruption risk.
- [ ] **Shell interpolation sanitization** — Low effort, addresses known injection surface.
- [ ] **Temp file cleanup** — Low effort, fixes resource leak.
- [ ] **Replace 55 silent catches with debug logging** — Now possible after debug helper exists.
- [ ] **Per-command --help** — Improves discoverability, low complexity.
- [ ] **Wire 11 slash commands** — Makes existing features reachable.

### Add When Stable (P2 — Quality of Life)

- [ ] **In-memory file cache** — Performance improvement for init commands.
- [ ] **Wire workflow integrations** (validate-deps → execute-phase, search-lessons → plan-phase, context-budget → execute-plan).
- [ ] **Batch grep in cmdCodebaseImpact()** — Performance improvement for large codebases.
- [ ] **Configurable context window size** — Minor config addition.
- [ ] **Config migration command** — Smooth upgrades between versions.

### Future Consideration (P3 — When Needed)

- [ ] **Snapshot testing** — Requires Node 22+. Defer until engines field is updated.
- [ ] **Plan templates** — Requires understanding target project types. Create when patterns emerge.
- [ ] **Parallel execution visualization** — Nice-to-have, not blocking any workflow.
- [ ] **Bundle-based build system** — Only needed if source splitting becomes desirable.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Debug logging (GSD_DEBUG) | HIGH | LOW | P0 |
| CONFIG_SCHEMA constant | HIGH | MEDIUM | P0 |
| State mutation tests | HIGH | MEDIUM | P0 |
| package.json | MEDIUM | LOW | P0 |
| Frontmatter round-trip tests | HIGH | LOW | P1 |
| Shell sanitization | MEDIUM | LOW | P1 |
| Temp file cleanup | LOW | LOW | P1 |
| Replace 55 silent catches | HIGH | MEDIUM | P1 |
| Per-command --help | MEDIUM | LOW | P1 |
| Wire 11 slash commands | MEDIUM | LOW | P1 |
| In-memory file cache | MEDIUM | MEDIUM | P2 |
| Wire workflow integrations | MEDIUM | LOW | P2 |
| Batch grep optimization | LOW | LOW | P2 |
| Configurable context window | LOW | LOW | P2 |
| Config migration command | LOW | LOW | P2 |
| Snapshot testing | MEDIUM | MEDIUM | P3 |
| Plan templates | LOW | MEDIUM | P3 |
| Parallel execution viz | LOW | MEDIUM | P3 |

**Priority key:**
- P0: Foundation — do before anything else
- P1: High value, add immediately after P0
- P2: Quality of life, add when time permits
- P3: Future consideration

## Comparable Tool Analysis

| Feature | eslint (single-bin) | prettier (single-bin) | gsd-tools.cjs (current) | Recommendation |
|---------|---------------------|----------------------|--------------------------|----------------|
| Debug logging | `DEBUG=eslint:*` env var | `--loglevel` flag | None (55 silent catches) | Add `GSD_DEBUG` env var |
| Config schema | Centralized schema with validation | Config file with schema | 3-way drift between definitions | Single CONFIG_SCHEMA constant |
| --help per command | Auto-generated from optionator | Built-in via commander | No per-command help | Add COMMAND_HELP map |
| Test coverage | >95% with snapshot tests | >90% with snapshot tests | ~24% (19/79 commands) | Prioritize mutation command tests |
| Error handling | Custom error classes, exit codes | Structured errors | `process.exit(1)` with message | Good enough for CLI; add debug logging |
| Arg parsing | optionator (dependency) | Built-in + commander | Manual index-based | Keep manual; add --help intercept |
| Config migration | Via eslintrc → flat config | N/A | None | Add config migrate command |
| Temp cleanup | N/A | cleanup via tmp library | Temp files accumulate | Add process.on('exit') cleanup |

## Implementation Patterns

### Debug Logging Pattern (Recommended)

```javascript
// At module level, ~line 10
const DEBUG = process.env.GSD_DEBUG === '1' || process.env.GSD_DEBUG === 'true';
function debugLog(context, ...args) {
  if (DEBUG) console.error(`[gsd:${context}]`, ...args);
}

// Usage in catch blocks (replacing empty catches)
} catch (e) {
  debugLog('state', 'Failed to read STATE.md:', e.message);
}
```

This pattern is used by `npm` (via `npmlog`), `debug` package (used by express, mocha, etc.), and Node.js core (`NODE_DEBUG`). The key properties: off by default, writes to stderr (not stdout — preserves JSON output), includes context prefix for filtering.

### CONFIG_SCHEMA Pattern (Recommended)

```javascript
const CONFIG_SCHEMA = {
  model_profile:    { type: 'string',  default: 'balanced', nested: null, description: 'Active model profile' },
  commit_docs:      { type: 'boolean', default: true,       nested: { section: 'planning', field: 'commit_docs' }, description: 'Auto-commit docs' },
  // ... all keys
};

// loadConfig() derives defaults from CONFIG_SCHEMA
// cmdConfigEnsureSection() derives initial config from CONFIG_SCHEMA
// cmdValidateConfig() derives known keys + types from CONFIG_SCHEMA
```

### --help Pattern (Recommended)

```javascript
const COMMAND_HELP = {
  'state update': 'Usage: gsd-tools state update <field> <value>\n  Update a STATE.md field',
  'state patch':  'Usage: gsd-tools state patch --field1 val1 --field2 val2\n  Batch update STATE.md fields',
  // ...
};

// In router, before dispatch:
if (args.includes('--help')) {
  const cmdKey = [args[0], args[1]].filter(Boolean).join(' ');
  const help = COMMAND_HELP[cmdKey] || COMMAND_HELP[args[0]] || 'No help available';
  process.stdout.write(help + '\n');
  process.exit(0);
}
```

## Sources

- **Node.js util.parseArgs documentation** — Context7 /nodejs/node, HIGH confidence. Confirms `util.parseArgs()` is stable in Node 18+, supports typed options, but doesn't solve subcommand routing.
- **Node.js node:test snapshot testing** — Context7 /nodejs/node, HIGH confidence. `t.assert.snapshot()` available from v22.3.0, stable in v23.7.0. Requires `--test-update-snapshots` flag for initial generation.
- **Better Stack "11 Best Practices for Logging in Node.js"** — https://betterstack.com/community/guides/logging/nodejs-logging-best-practices/ — MEDIUM confidence. Recommends structured logging, log levels, and env-var-gated debug output.
- **Liran Tal "Dependency-free CLI Apps with Node.js Core"** — https://lirantal.com/blog/dependency-free-command-line-apps-powered-by-node-js-core-modules — MEDIUM confidence. Confirms `util.parseArgs()` as the built-in alternative to commander/yargs.
- **CONCERNS.md codebase analysis** — Project-specific, HIGH confidence. Documents 55 silent catches, 309 regex patterns, config schema drift, test coverage gaps.
- **PROJECT.md requirements** — Project-specific, HIGH confidence. Defines scope, constraints, and key decisions.

---
*Feature research for: GSD Plugin CLI quality improvements*
*Researched: 2026-02-22*
