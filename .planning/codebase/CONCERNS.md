# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

### Duplicate module.exports in router.js

- Issue: `src/router.js` has `module.exports = { main };` on both line 770 and line 772. Harmless (second overwrites first) but indicates copy-paste artifact.
- Files: `src/router.js:770-772`
- Impact: None (no bug). Signals sloppy editing that could compound.
- Fix approach: Delete the duplicate line.

### Global State for CLI Flags

- Issue: CLI flags (`_gsdCompactMode`, `_gsdRequestedFields`, `_gsdManifestMode`) are stored on `global`, creating implicit coupling between `src/router.js` and 13+ consumer sites across `src/commands/init.js`, `src/commands/features.js`, `src/commands/env.js`, and `src/lib/output.js`. The `cmdContextBudgetMeasure` function in `src/commands/features.js:1550-1598` directly mutates `global._gsdCompactMode` to swap modes mid-execution, then restores — a fragile save/restore pattern.
- Files: `src/router.js:40-65`, `src/commands/init.js` (30+ references), `src/commands/features.js:1550-1598`, `src/lib/output.js:82-83`
- Impact: Makes functions impure and hard to test. The save/restore pattern in `cmdContextBudgetMeasure` is error-prone if any called function throws before restore.
- Fix approach: Create a `RunContext` object in `src/lib/context.js` that holds flags, pass it through the call chain, or use a thread-local-like pattern (module-level singleton with getter/setter). At minimum, wrap the save/restore in try/finally (already partially done in `features.js` but the finally blocks could still fail since `output()` calls `process.exit(0)`).

### process.stdout.write Monkeypatching

- Issue: `cmdContextBudgetMeasure` in `src/commands/features.js:1479-1484` temporarily replaces `process.stdout.write` to capture JSON output from functions that were designed to write to stdout and exit. This is a hack to reuse command functions as in-process measurement targets.
- Files: `src/commands/features.js:1470-1493`
- Impact: Brittle — if the measured function throws, stdout stays patched. The `finally` block restores it, but the measured functions call `output()` which calls `process.exit(0)` at `src/lib/output.js:98`, so the measurement actually catches the exit exception.
- Fix approach: Refactor command functions to return data objects, with the output/exit handling as a thin wrapper. This would eliminate the need for stdout monkeypatching.

### output() Always Calls process.exit(0)

- Issue: The central `output()` function at `src/lib/output.js:98` calls `process.exit(0)` unconditionally. Every command that calls `output()` terminates the process. This makes it impossible to compose commands, run multiple commands in sequence, or use command logic in tests without subprocess spawning.
- Files: `src/lib/output.js:77-99`
- Impact: Forces test suite (`bin/gsd-tools.test.cjs`) to spawn subprocesses for every test (13,040 lines of tests, all using `execSync`). Slows tests significantly. Also forces the stdout monkeypatching hack in `features.js`.
- Fix approach: Split into `output()` (return data) and `outputAndExit()` (write + exit). Have the router call `outputAndExit()` while internal callers use `output()` to get data back.

### Cross-Module Command Dependencies

- Issue: Command modules import from sibling command modules, creating a web of cross-dependencies:
  - `src/commands/init.js` imports from `intent.js`, `env.js`, `codebase.js`, `worktree.js`
  - `src/commands/features.js` imports from `verify.js`, `misc.js`, `init.js`
- Files: `src/commands/init.js:10-13`, `src/commands/features.js:9,1496-1497`
- Impact: Lazy-loading in `src/router.js` becomes less effective when loading one command transitively loads others. `init.js` eager-loads 4 other command modules at require time, meaning `init` commands load ~6 of 13 modules.
- Fix approach: Extract shared helper functions (like `parseAssertionsMd`, `getIntentDriftData`, `formatEnvSummary`) into `src/lib/` modules instead of importing between command files. This preserves lazy-loading isolation.

### Custom YAML Frontmatter Parser

- Issue: `src/lib/frontmatter.js` implements a custom YAML parser (166 lines) that handles only a subset of YAML. It works for the project's frontmatter format but silently produces incorrect results for valid YAML features like multi-line strings, anchors/aliases, or complex nesting beyond 3 levels.
- Files: `src/lib/frontmatter.js:15-91`
- Impact: Low immediate risk since the project controls the YAML it generates. However, if users edit frontmatter with YAML features the parser doesn't support, data is silently lost or corrupted. The `reconstructFrontmatter()` function at lines 93-154 has deeply nested if/else chains (4+ levels) for serialization.
- Fix approach: Acceptable trade-off for zero-dependency design. Document the supported YAML subset. Consider adding warnings when parsing encounters unsupported constructs.

### Constants File is 1,088 Lines

- Issue: `src/lib/constants.js` contains both machine data (MODEL_PROFILES, CONFIG_SCHEMA) and human-readable help text (COMMAND_HELP at ~1,000 lines). The help text is static content that dominates the file.
- Files: `src/lib/constants.js`
- Impact: Makes the constants file hard to navigate. Help text changes (common) require editing a file shared with critical schema definitions.
- Fix approach: Split into `src/lib/constants.js` (machine data) and `src/lib/help.js` (COMMAND_HELP text).

## Known Bugs

### Frontmatter Cache Key Collision Risk

- Issue: The frontmatter parse cache in `src/lib/frontmatter.js:20` uses `content.length + ':' + content.slice(0, 200)` as its cache key. Two files with the same length and identical first 200 characters but different frontmatter after that would produce a cache collision, returning wrong frontmatter.
- Symptoms: Silent wrong data returned from `extractFrontmatter()` for the second file.
- Files: `src/lib/frontmatter.js:20-23`
- Trigger: Two different frontmatter files with identical first 200 characters (unlikely but possible, especially with generated files that share a common header template).
- Workaround: The cache only lives for one CLI invocation and is bounded to 100 entries, so the window for collision is small.

## Security Considerations

### execSync with User-Provided Commands

- Risk: Four call sites use `execSync()` with commands sourced from user configuration (`config.json`):
  1. `src/commands/features.js:206` — `test_commands` values from config
  2. `src/commands/verify.js:862` — auto-detected test commands
  3. `src/commands/verify.js:1532` — auto-detected test commands
  4. `src/commands/worktree.js:284` — `setup_hooks` values from config
- Files: `src/commands/features.js:206`, `src/commands/verify.js:862,1532`, `src/commands/worktree.js:284`
- Current mitigation: Config files are local to the project (`.planning/config.json`), so an attacker would need write access to the project to inject malicious commands. Commands have timeouts (5min for tests, 2min for hooks). However, there is NO sanitization or validation of the command strings.
- Recommendations: Add a config schema validation that rejects `test_commands` and `setup_hooks` values containing shell metacharacters like `$()`, backticks, or pipes. Alternatively, document that these config values are treated as trusted shell commands (which is the current implicit contract).

### Worktree Setup Hooks Execute Arbitrary Shell Commands

- Risk: `src/commands/worktree.js:282-295` iterates `config.setup_hooks` (an array of strings from config.json) and passes each to `execSync()` directly. These execute in the worktree directory with the user's full permissions.
- Files: `src/commands/worktree.js:282-295`
- Current mitigation: Worktree feature is off by default (`enabled: false` in `WORKTREE_DEFAULTS`). Must be explicitly opted in via config.
- Recommendations: Log which hooks are about to execute before running them. Consider requiring explicit user confirmation for first-time hook execution.

### Brave Search API Key in Environment

- Risk: `process.env.BRAVE_API_KEY` is read directly at `src/commands/misc.js:1137` and passed as an HTTP header. If the key leaks into error messages or logs, it could be exposed.
- Files: `src/commands/misc.js:1137,1166`, `src/commands/misc.js:127`, `src/commands/init.js:422`
- Current mitigation: The key is only sent to the Brave API endpoint. Error handling returns generic messages. The key file path (`~/.gsd/brave_api_key`) is not logged.
- Recommendations: Acceptable for a local CLI tool. No changes needed.

### Path Traversal via CLI Arguments

- Risk: Many commands accept file paths from CLI arguments (e.g., `verify-path-exists`, `frontmatter get`, `context-budget`) and join them with `cwd` using `path.join()`. A malicious argument like `../../etc/passwd` would resolve outside the project.
- Files: `src/commands/misc.js:89`, `src/commands/verify.js:12,166`, `src/commands/features.js:79`
- Current mitigation: This is a local CLI tool invoked by the user (or by AI agents under user supervision). The tool runs with the user's permissions, so path traversal doesn't grant additional access. `execGit()` in `src/lib/git.js` uses `execFileSync` (no shell injection) and passes `cwd` correctly.
- Recommendations: For read-only operations, this is acceptable. For write operations (commit, scaffold, config-set), consider validating that resolved paths stay within the project root.

## Performance Bottlenecks

### Large File Reads Without Streaming

- Problem: Many functions read entire files into memory using `fs.readFileSync`. For large STATE.md, ROADMAP.md, or SUMMARY.md files, this is fine (typically <100KB). However, `cmdCodebaseAnalyze` in `src/lib/codebase-intel.js` can scan thousands of source files.
- Files: `src/lib/codebase-intel.js`, `src/lib/helpers.js:16-22`
- Cause: Synchronous file I/O is used throughout. File cache (`src/lib/helpers.js:12`) helps but only within a single invocation.
- Improvement path: Current approach is acceptable for typical project sizes. The file cache and directory cache (`dirCache` in helpers.js) already prevent redundant reads. The `getPhaseTree()` function at `src/lib/helpers.js:93-150` replaces 100+ individual readdirSync calls with a single tree scan — good optimization already in place.

### Test Suite Uses Subprocess Spawning

- Problem: The 13,040-line test file `bin/gsd-tools.test.cjs` runs every test by spawning `node bin/gsd-tools.cjs` via `execSync`. Each test creates a new Node.js process.
- Files: `bin/gsd-tools.test.cjs:14-29`
- Cause: The `output()` function calls `process.exit(0)`, making it impossible to call commands in-process during tests.
- Improvement path: Refactor `output()` to separate data return from process exit (see Tech Debt section). Then tests can import and call command functions directly, dramatically reducing test execution time.

### Regex Compilation in Hot Paths

- Problem: Most dynamic regex patterns are now cached via `src/lib/regex-cache.js:21-40` (LRU-bounded, 200 entries). However, `src/commands/state.js:12-27` maintains its own separate regex cache (`_fieldRegexCache`), and some functions still create `new RegExp()` inline — e.g., `src/commands/state.js:99` creates a section-matching regex each time `cmdStateGet` is called.
- Files: `src/lib/regex-cache.js`, `src/commands/state.js:10-27,99`
- Cause: The regex-cache module was added after some patterns were already cached locally.
- Improvement path: Low priority. The state.js local cache works fine. Consolidating to use `cachedRegex()` everywhere would be a cleanup but not a performance win.

## Fragile Areas

### Markdown Structure Parsing

- Files: `src/lib/helpers.js:466-535` (milestone detection), `src/commands/features.js:16-76` (session diff), `src/commands/state.js:77-100` (state field extraction), `src/commands/features.js:247-268` (test output parsing)
- Why fragile: Multiple functions parse markdown using regex patterns that depend on specific formatting conventions (e.g., `**Field:** value`, `## Section`, `- 🔵 **vX.Y Name**`). If users manually edit STATE.md or ROADMAP.md in ways that break these patterns, data extraction silently fails and returns null/empty.
- Safe modification: Always test regex changes against the actual markdown files in `.planning/`. The milestone detection in `src/lib/helpers.js:466-535` has a 5-strategy fallback chain specifically because markdown format varies.
- Test coverage: The test file covers many markdown parsing scenarios but cannot cover all possible human edits to markdown files.

### Custom YAML Parser Edge Cases

- Files: `src/lib/frontmatter.js:15-91`
- Why fragile: The parser uses indent tracking with a manual stack. It handles `key: value`, `key: [inline, array]`, `key:` (object start), and `- item` (array items). It does NOT handle: multi-line strings (`|`, `>`), quoted keys, inline objects (`{a: 1}`), YAML comments (`#`), empty values followed by non-child content, or more than ~3 levels of nesting.
- Safe modification: Add new test cases to `bin/gsd-tools.test.cjs` before modifying the parser. The frontmatter test section starts around line 64.
- Test coverage: Moderate — tests cover the happy path. No tests for edge cases like trailing comments in values, keys with special characters, or deeply nested objects.

### 5-Strategy Milestone Detection

- Files: `src/lib/helpers.js:466-535`
- Why fragile: The `_getMilestoneInfoUncached()` function tries 5 different strategies to find the active milestone from ROADMAP.md, in priority order: (1) 🔵 marker, (2) `(active)` tag, (3) `Active Milestone` section, (4) last non-✅ milestone, (5) generic version match. Each strategy has its own regex. If the roadmap format evolves, a wrong strategy may match first.
- Safe modification: Test against multiple ROADMAP.md formats. Each strategy is clearly delineated with comments.
- Test coverage: Well-tested in the test suite with multiple roadmap format variations.

### Router Switch Statement (770+ lines)

- Files: `src/router.js:90-767`
- Why fragile: The `main()` function is a 677-line switch statement mapping CLI commands to handler functions. Each case manually parses arguments by index (`args[1]`, `args[2]`, etc.) with per-command flag parsing (e.g., `args.indexOf('--phase')`). Adding a new command or flag requires adding another case block with manual index arithmetic.
- Safe modification: Follow the existing pattern exactly. New commands should be added as new case blocks. Complex subcommand routing (like `state`, `verify`) should follow the nested if/else pattern.
- Test coverage: Good — the test suite covers most commands.

### Test Output Parsing Heuristics

- Files: `src/commands/features.js:247-268`
- Why fragile: `parseTestOutput()` tries to match ExUnit, Go test, and pytest output formats using regex. The Go test parser counts `ok` and `FAIL` lines, which could match non-test output. The pytest parser uses a loose pattern that could match log messages containing "passed" or "failed".
- Safe modification: Only add new framework parsers; don't modify existing ones without running against real test output from each framework.
- Test coverage: Basic pattern matching is tested but not against real framework output.

## Scaling Limits

### Single-File Bundle Size Budget

- Current capacity: ~470KB bundle (bin/gsd-tools.cjs, 15,348 lines), budget cap at 700KB
- Limit: `build.js:60` enforces a 700KB hard limit. Build fails if exceeded.
- Scaling path: The codebase has already been modularized from a true single-file into `src/` with 24 source files that get bundled by esbuild. Adding new features adds to bundle size. The 700KB limit provides ~230KB headroom. If needed, split into a core bundle and optional feature bundles that lazy-load.

### Phase Tree Scan

- Current capacity: Works well for projects with <100 phases
- Limit: `getPhaseTree()` at `src/lib/helpers.js:93-150` scans every phase directory synchronously. For a project with 500+ phases, startup time would increase linearly.
- Scaling path: Add incremental phase tree updates (only rescan changed directories). Current approach is fine for expected usage (<50 phases per milestone).

## Dependencies at Risk

### tokenx (Token Estimation)

- Risk: `tokenx` is the sole runtime dependency (`package.json:20`). If it breaks or becomes unavailable, token estimation degrades to `Math.ceil(text.length / 4)`.
- Impact: Token budget calculations become less accurate (~75% accuracy instead of ~96%).
- Migration plan: The fallback at `src/lib/context.js:21` already handles this gracefully. No action needed unless tokenx is abandoned.

### esbuild (Build Tool)

- Risk: `esbuild` is a dev dependency used by `build.js` to bundle the source into a single CJS file. It's actively maintained by the Go team.
- Impact: Build breaks if esbuild has a breaking change. The `build.js` config at line 28-42 is straightforward with no exotic features.
- Migration plan: Low risk. Could switch to another bundler (rollup, webpack) if needed.

## Missing Critical Features

### No Input Validation on CLI Arguments

- Problem: The router at `src/router.js:90-767` does no validation of argument types or counts before passing to command handlers. Missing required arguments produce cryptic errors deep in the command logic.
- Blocks: Clean error messages for misuse. Currently, passing wrong args can cause `undefined` to propagate through multiple function calls before failing.

### No Automated Integration Tests

- Problem: The test suite at `bin/gsd-tools.test.cjs` tests individual commands in isolation with synthetic `.planning/` directories. There are no tests that simulate a full workflow (new-project → plan → execute → verify → complete-milestone).
- Blocks: Confidence that multi-step workflows work end-to-end. Regressions in command sequencing go undetected.

## Test Coverage Gaps

### Worktree Commands Untested in CI

- What's not tested: The worktree module at `src/commands/worktree.js` (791 lines) involves git worktree operations that require a real git repository with specific state.
- Files: `src/commands/worktree.js`
- Risk: Worktree creation, merging, and cleanup could fail in edge cases (detached HEAD, merge conflicts, stale worktrees).
- Priority: Medium — worktree feature is opt-in and off by default.

### Codebase Intelligence Incremental Mode

- What's not tested: `src/commands/codebase.js` and `src/lib/codebase-intel.js` have an incremental analysis mode that updates only changed files. The logic for merging incremental results with previous full analysis is complex.
- Files: `src/lib/codebase-intel.js`, `src/commands/codebase.js:33-40`
- Risk: Incremental updates could produce stale or inconsistent language statistics if the merge logic mishandles deleted/renamed files.
- Priority: Medium — stale intel causes suboptimal but not broken behavior.

### Convention Extraction Accuracy

- What's not tested: `src/lib/conventions.js` (644 lines) classifies naming patterns, detects import organization, and identifies code style patterns across multiple languages. The classification heuristics (camelCase vs PascalCase detection at lines 10-16) have edge cases.
- Files: `src/lib/conventions.js`
- Risk: Wrong convention detection could lead to generated code that doesn't match the project's actual style.
- Priority: Low — conventions are advisory, not enforced.

### Error Paths in State Manipulation

- What's not tested: `src/commands/state.js` reads and writes STATE.md with field replacement using regex. Error paths (corrupt STATE.md, concurrent writes, disk full) are handled with try/catch but not tested.
- Files: `src/commands/state.js`
- Risk: Corrupt STATE.md could cause silent data loss on the next write operation.
- Priority: Medium — STATE.md is the primary continuity mechanism between sessions.

---

*Concerns audit: 2026-02-26*
