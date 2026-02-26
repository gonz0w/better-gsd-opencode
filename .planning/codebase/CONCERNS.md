# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Monolithic Router with Manual Argument Parsing:**
- Issue: `src/router.js` (776 lines) is a single giant `switch` statement with 50+ cases. Each case manually parses `--flag` arguments using `args.indexOf()` patterns rather than a proper arg parser. Repeated boilerplate for every flag extraction.
- Files: `src/router.js`
- Impact: Adding new commands or flags requires duplicating the same `indexOf`/`splice` pattern. Easy to introduce off-by-one errors or miss edge cases (e.g., flag value containing `--`). The manual `--fields` parsing with `global._gsdRequestedFields` uses mutable global state.
- Fix approach: Extract a lightweight argument parser utility (e.g., `parseArgs(args, schema)`) that returns typed options. Refactor commands to declare their flags declaratively. This would also enable auto-generated `--help` text per command.

**Duplicate `module.exports` in Router:**
- Issue: `src/router.js` has two identical `module.exports = { main };` statements at lines 774 and 776 (duplicate line left behind from an edit).
- Files: `src/router.js` (lines 774-776)
- Impact: Harmless runtime behavior (second assignment overwrites first), but indicates sloppy editing and can confuse future readers.
- Fix approach: Remove the duplicate line.

**Global State for Output Modes:**
- Issue: Output mode flags (`_gsdCompactMode`, `_gsdRequestedFields`, `_gsdManifestMode`) are stored on `global`, creating implicit coupling between `src/router.js` (sets globals), `src/lib/output.js` (reads `_gsdRequestedFields`), and `src/commands/init.js` (reads `_gsdCompactMode` and `_gsdManifestMode` in 20+ locations). The `features.js` measurement code even temporarily mutates and restores these globals.
- Files: `src/router.js` (lines 40-63), `src/lib/output.js` (line 82), `src/commands/init.js` (50+ references), `src/commands/features.js` (lines 1591-1639)
- Impact: Makes testing individual functions in isolation impossible without setting globals. The save/restore pattern in `features.js` is fragile — if an exception occurs between save and restore, the global is left in a dirty state.
- Fix approach: Thread output options through a context object parameter instead of globals. Pass `{ compact, manifest, fields }` down the call chain.

**features.js Is the Largest Source File (1,945 lines):**
- Issue: `src/commands/features.js` is a catch-all for 18 exported command functions spanning session tracking, context budgeting, test running, search, dependency validation, codebase impact, rollback, velocity, tracing, config validation, section extraction, token budgeting, and test coverage. No clear cohesion.
- Files: `src/commands/features.js`
- Impact: Hard to navigate. High cognitive load. Changes to one feature risk breaking adjacent functions. 
- Fix approach: Split into domain-focused modules: `src/commands/search.js` (decisions, lessons), `src/commands/budget.js` (context-budget, token-budget), `src/commands/testing.js` (test-run, test-coverage), `src/commands/analysis.js` (velocity, codebase-impact, trace-requirement), etc.

**verify.js Is Similarly Oversized (1,984 lines):**
- Issue: `src/commands/verify.js` contains 15+ verification commands, from plan structure checking to deliverable testing to quality scoring. Some functions exceed 150 lines.
- Files: `src/commands/verify.js`
- Impact: Same navigation and maintenance problems as `features.js`.
- Fix approach: Split by verification domain: `src/commands/verify-plan.js`, `src/commands/verify-requirements.js`, `src/commands/verify-quality.js`.

**Custom YAML Frontmatter Parser (Not Full YAML):**
- Issue: `src/lib/frontmatter.js` (166 lines) is a hand-rolled YAML parser that only handles the subset used by GSD planning files. It relies on indent counting and simple regex matching. Multi-line strings, flow mappings beyond `[a, b]`, anchors/aliases, block scalars (`|`, `>`), and complex nested structures are not supported.
- Files: `src/lib/frontmatter.js`
- Impact: Frontmatter that uses full YAML features silently parses incorrectly. The parser's cache key uses first 200 chars + content length as a "cheap hash", which can collide for files with identical preambles and same length but different bodies.
- Fix approach: Either document the supported subset explicitly and add warnings/errors for unsupported constructs, or consider using a minimal YAML library. The cache key should use a proper hash (e.g., first 200 chars + last 100 chars + length).

**Duplicate Logic Between `getPhaseTree()` and `searchPhaseInDir()`:**
- Issue: Phase directory scanning logic (reading plans, summaries, research files, building completedPlanIds set) is duplicated between `getPhaseTree()` (lines 93-150) and `searchPhaseInDir()` (lines 302-346) in `src/lib/helpers.js`. Both functions independently filter files by suffix and compute `incompletePlans`.
- Files: `src/lib/helpers.js` (lines 93-150 and 302-346)
- Impact: Bug fixes to phase scanning logic must be applied in two places. Risk of divergence.
- Fix approach: Extract a `buildPhaseEntry(phaseDir, phaseFiles)` helper and call it from both locations.

**Duplicate SKIP_DIRS Constants:**
- Issue: The `SKIP_DIRS` set is defined independently in both `src/lib/codebase-intel.js` (line 63) and `src/commands/env.js` (line 40) with slightly different entries (`.planning` is only in codebase-intel's version).
- Files: `src/lib/codebase-intel.js` (line 63), `src/commands/env.js` (line 40)
- Impact: Adding a new skip directory requires updating two files; inconsistency means `env scan` may traverse directories that `codebase analyze` skips.
- Fix approach: Move `SKIP_DIRS` into `src/lib/constants.js` as a single source of truth.

## Known Bugs

**Unused `sanitizedSince` Variable in `cmdSessionDiff`:**
- Symptoms: `sanitizedSince` is computed on line 40 of `src/commands/features.js` via `sanitizeShellArg(since)` but never used — `execGit()` already handles argument safety via `execFileSync`. The shell-safe version is a dead artifact from when `execSync` was used.
- Files: `src/commands/features.js` (line 40)
- Trigger: Always present; no bug in behavior, but confuses readers.
- Workaround: None needed — harmless dead code.

**Token Budget Uses Heuristic Instead of tokenx:**
- Symptoms: `cmdTokenBudget()` in `src/commands/features.js` (line 1720) estimates tokens via `Math.ceil(content.length / 4)` instead of using the `estimateTokens()` function from `src/lib/context.js` that wraps the `tokenx` library.
- Files: `src/commands/features.js` (line 1720)
- Trigger: Always — any call to `token-budget` uses the less accurate heuristic.
- Workaround: Import and use `estimateTokens()` from `../lib/context`.

## Security Considerations

**`execSync()` Used with User-Provided Config Values:**
- Risk: `src/commands/features.js` line 208 runs `execSync(command, ...)` where `command` comes from `config.test_commands`, which is read from `.planning/config.json`. If a malicious config is checked into a repository, any user running `gsd-tools test-run` would execute arbitrary shell commands.
- Files: `src/commands/features.js` (line 208), `src/commands/worktree.js` (line 284)
- Current mitigation: Config is in `.planning/config.json` within the project, so an attacker would need write access to the repo. The commands run under the user's own permissions.
- Recommendations: Document this trust boundary clearly. Consider validating that test commands don't contain shell metacharacters beyond basic pipes. Add a warning on first run of uncached test commands. `worktree.js` similarly runs `setup_hooks` from config via `execSync` (line 284).

**Shell Injection via `verify.js` Test Commands:**
- Risk: `src/commands/verify.js` lines 862 and 1532 run `execSync(testCommand, ...)` where `testCommand` comes from config. Same vector as above.
- Files: `src/commands/verify.js` (lines 862, 1532)
- Current mitigation: Same config trust boundary.
- Recommendations: Same as above. Centralize test command execution into a single validated helper.

**`process.env.HOME` Used Without Null Check in Path Construction:**
- Risk: `src/commands/verify.js` line 178 uses `process.env.HOME || ''` in `path.join()`. On Windows or in stripped environments, this could resolve paths to unexpected locations.
- Files: `src/commands/verify.js` (line 178), `src/commands/misc.js` (line 126), `src/commands/mcp.js` (line 98)
- Current mitigation: The tool targets Node.js on Linux/macOS where `HOME` is always set.
- Recommendations: Add a utility function `getHomeDir()` that falls back to `os.homedir()` and use it consistently across all modules.

**Brave Search API Key in Environment:**
- Risk: `BRAVE_API_KEY` is read from `process.env` in `src/commands/misc.js` (line 1137) and checked as file in `~/.gsd/brave_api_key` (line 127). API key leakage is possible if debug mode logs environment variables.
- Files: `src/commands/misc.js` (lines 127, 1137)
- Current mitigation: `debugLog` only prints context messages, not full environment dumps. The `.gsd/` directory is not committed.
- Recommendations: Ensure `GSD_DEBUG` output never includes API key values. Consider using a keyring integration.

## Performance Bottlenecks

**Bundled Output Size (16,436 lines, ~550KB):**
- Problem: `bin/gsd-tools.cjs` is a single 16,436-line bundled file. Every CLI invocation loads and parses the entire file, even though lazy loading means only one command module is actually executed.
- Files: `bin/gsd-tools.cjs`
- Cause: esbuild bundles all source + the `tokenx` dependency into one file. The build system has a 1000KB budget (`build.js` line 60).
- Improvement path: The lazy-loading pattern in `src/router.js` already mitigates runtime cost. The bundle is parsed once by V8 and JIT-compiled. For startup time, consider `--sourcemap` to help debugging without inflating the main file, or splitting into multiple chunks if startup latency becomes measurable.

**Synchronous File I/O Throughout:**
- Problem: Every file operation uses synchronous Node.js APIs (`readFileSync`, `writeFileSync`, `readdirSync`, `statSync`, `execFileSync`). For single CLI invocations this is acceptable, but it blocks the event loop.
- Files: All files in `src/commands/` and `src/lib/`
- Cause: Deliberate design choice — the tool runs as a short-lived CLI process, not a server.
- Improvement path: Low priority. Sync I/O is appropriate for a CLI tool that processes one command and exits. Only investigate if startup/execution time exceeds ~500ms.

**Multiple `readdirSync` Calls for Same Directory:**
- Problem: While `cachedReaddirSync()` in `src/lib/helpers.js` exists, several command files still call `fs.readdirSync()` directly (especially in `src/commands/phase.js`, `src/commands/features.js`, `src/commands/worktree.js`).
- Files: `src/commands/phase.js` (lines 26, 60, 111), `src/commands/features.js` (lines 363, 696, 704), `src/commands/worktree.js` (line 72)
- Cause: The cached wrapper was added later; not all call sites were migrated.
- Improvement path: Replace direct `fs.readdirSync()` calls with `cachedReaddirSync()` or `getPhaseTree()` where applicable.

**Individual Git Calls for Batch Operations:**
- Problem: In `cmdRollbackInfo()`, when batch `git rev-parse --verify` fails for a batch of SHAs, it falls back to verifying each SHA individually in a loop (lines 743-750 in `src/commands/features.js`).
- Files: `src/commands/features.js` (lines 735-751)
- Cause: `git rev-parse --verify` exits non-zero if any single argument fails, requiring individual fallback.
- Improvement path: Use `git cat-file --batch-check` which can process multiple SHAs in a single call and reports failures per-line.

## Fragile Areas

**Markdown Section Parsing via Regex:**
- Files: `src/commands/state.js` (lines 217, 282, 306, 328, 597), `src/commands/roadmap.js` (lines 23-26, 104, 150, 191), `src/commands/verify.js` (lines 364, 562, 963, 1629), `src/commands/features.js` (lines 793, 1076, 1882)
- Why fragile: Nearly every command that reads STATE.md, ROADMAP.md, or PLAN.md uses regex to find markdown sections (e.g., `###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n`). These patterns break if users add unexpected heading levels, trailing whitespace, emoji, or non-standard formatting. The decision section regex alone has 3 alternate heading names.
- Safe modification: When changing markdown section patterns, always test with: (1) standard formatting, (2) extra whitespace/blank lines, (3) missing sections, (4) sections at different heading levels.
- Test coverage: The test file (`bin/gsd-tools.test.cjs`, 13,722 lines) covers major commands but does not systematically test regex edge cases for section parsing.

**Frontmatter Cache Key Collision Risk:**
- Files: `src/lib/frontmatter.js` (line 20)
- Why fragile: The cache key is `content.length + ':' + content.slice(0, 200)`. Two files with identical first 200 characters and identical total length (but different content after character 200) would share a cache entry, returning stale/wrong frontmatter.
- Safe modification: Replace with a more robust key: include last N characters or a checksum.
- Test coverage: No tests verify cache correctness under collision conditions.

**Multi-Strategy Milestone Detection:**
- Files: `src/lib/helpers.js` (lines 466-534)
- Why fragile: `_getMilestoneInfoUncached()` uses 5 sequential fallback strategies to detect the active milestone from ROADMAP.md. Each strategy parses different markdown patterns (🔵 marker, `(active)` tag, "Active Milestone" section, last non-✅ item, any version match). If ROADMAP format changes, any strategy could match the wrong milestone, and the fallback chain makes debugging difficult.
- Safe modification: Log which strategy matched (already possible via `GSD_DEBUG`). Test each strategy independently. Consider making the milestone format canonical — one format instead of five.
- Test coverage: Milestone detection is tested but primarily for the happy path.

**Phase Number Normalization Assumptions:**
- Files: `src/lib/helpers.js` (lines 154-161), all code calling `normalizePhaseName()`
- Why fragile: `normalizePhaseName()` assumes phase numbers are `\d+(\.\d+)?` (one optional decimal). Phase numbers like `01.2.3` or `1a` would not normalize correctly. The regex `PHASE_DIR_NUMBER` (`/^(\d+(?:\.\d+)?)-?(.*)/`) makes the same assumption.
- Safe modification: Add validation that phase numbers match expected format before normalizing. Return an error or null for unexpected formats.
- Test coverage: Tests cover standard cases (e.g., `1` → `01`, `3.1` → `03.1`) but not edge cases like multi-segment decimals.

**`parseMustHavesBlock()` Indent-Sensitive Parsing:**
- Files: `src/lib/helpers.js` (lines 165-229)
- Why fragile: The `parseMustHavesBlock()` function parses nested YAML-like structures by counting exact indent levels (4, 6, 8, 10 spaces). Any deviation in indentation (e.g., mixing tabs and spaces, 2-space indentation) causes silent parse failure — items are simply missed.
- Safe modification: Add a tolerance for indent detection or normalize indentation before parsing. At minimum, log a warning when unexpected indent levels are encountered.
- Test coverage: Tested with canonical indentation only.

## Scaling Limits

**File Cache Unbounded for Single Invocation:**
- Current capacity: `fileCache` and `dirCache` in `src/lib/helpers.js` (lines 12-14) are unbounded `Map` objects. The LRU strategy is only applied to `_dynamicRegexCache` (200 max) and `_fmCache` (100 max).
- Limit: For projects with thousands of plan files, the caches could consume significant memory during a single CLI invocation.
- Scaling path: Add LRU bounds to `fileCache` (e.g., 500 entries). In practice, single invocations process <100 files, so this is low priority.

**Phase Tree Loaded Entirely Into Memory:**
- Current capacity: `getPhaseTree()` scans all phase directories and their contents in a single pass, holding the entire tree in memory.
- Limit: For projects with 100+ phases, each with dozens of plans, the tree could grow to a few MB.
- Scaling path: Acceptable for expected usage (typically <50 phases). No action needed unless the tool is adopted for very large projects.

## Dependencies at Risk

**tokenx (^1.3.0) — Single External Runtime Dependency:**
- Risk: `tokenx` is the only non-dev npm dependency. It's used for token estimation in context budgeting. The fallback (`Math.ceil(text.length / 4)`) works if tokenx fails to load, but with lower accuracy.
- Impact: If `tokenx` is deprecated, breaks, or has a security vulnerability, it affects all token estimation features.
- Migration plan: The graceful fallback in `src/lib/context.js` (lines 13-24) already handles tokenx failure. Alternative: `tiktoken` (OpenAI's official tokenizer) or `gpt-tokenizer`. Monitor tokenx for updates.

**esbuild (^0.27.3) — Dev-Only Build Dependency:**
- Risk: esbuild is used only for bundling (`build.js`). It's well-maintained but moves fast with breaking changes between major versions.
- Impact: Build-only. Runtime is unaffected.
- Migration plan: Pin to exact version in lockfile. The build process is simple (single-file bundle) and could migrate to any bundler.

## Missing Critical Features

**No Input Validation on CLI Arguments:**
- Problem: Command arguments are not validated for type, range, or format before being passed to command handlers. For example, `gsd-tools state record-metric --phase abc --plan xyz --duration hello` would pass strings where numbers are expected, potentially writing garbage to STATE.md.
- Blocks: Reliable automated usage. Manual testing catches most issues, but agent-generated calls may pass unexpected values.

**No Structured Error Codes:**
- Problem: The `error()` function in `src/lib/output.js` writes free-text error messages to stderr and exits with code 1. There's no structured error format (e.g., `{ error_code: 'PHASE_NOT_FOUND', message: '...' }`) for programmatic consumption by calling agents.
- Blocks: Reliable error handling in workflows. Agents must parse error text to determine what went wrong.

**No Sourcemaps in Bundle:**
- Problem: `build.js` sets `sourcemap: false` (line 40). When errors occur in the bundled `bin/gsd-tools.cjs`, stack traces reference the bundled file's line numbers (up to 16,436), not the original source locations.
- Blocks: Efficient debugging of production issues. Developers must mentally map bundled line numbers back to source files.

## Test Coverage Gaps

**Regex Section Parsing Not Exhaustively Tested:**
- What's not tested: Edge cases in markdown section parsing — sections with unusual heading levels, trailing/leading whitespace, emoji in headings, sections that span to EOF, empty sections.
- Files: `src/commands/state.js` (all `sectionPattern` regex), `src/commands/roadmap.js` (phase pattern matching)
- Risk: Users with non-standard ROADMAP.md formatting experience silent data loss.
- Priority: Medium — most common formats are covered.

**Frontmatter Parser Edge Cases:**
- What's not tested: YAML features beyond GSD's subset — multiline strings, block scalars, flow sequences with quoted strings containing commas, nested objects >3 levels deep.
- Files: `src/lib/frontmatter.js`
- Risk: Plans with complex frontmatter could be silently misparsed.
- Priority: Medium — the parser works for standard GSD files but lacks error reporting for unsupported constructs.

**Error Paths in File Operations:**
- What's not tested: Permission errors, disk full scenarios, read-only `.planning/` directories, concurrent writes to STATE.md.
- Files: All command handlers that write to `.planning/`
- Risk: Corrupted state files if disk operations fail mid-write.
- Priority: Low — CLI runs in cooperative environment.

**Worktree Commands:**
- What's not tested: `src/commands/worktree.js` — worktree creation, merge, cleanup, overlap detection. These involve complex git operations.
- Files: `src/commands/worktree.js` (791 lines)
- Risk: Worktree operations could corrupt git state if edge cases aren't handled.
- Priority: Medium — feature is opt-in (disabled by default), but when enabled, failures could be destructive.

**Intent System:**
- What's not tested: `src/commands/intent.js` (1,592 lines) — intent creation, validation, trace, drift detection. This is a complex subsystem with its own parsing logic.
- Files: `src/commands/intent.js`
- Risk: Intent drift detection could give false positives/negatives without thorough testing.
- Priority: Medium.

**Memory Subsystem:**
- What's not tested: `src/commands/memory.js` (307 lines) — memory compaction thresholds, concurrent writes, read filtering by query/phase.
- Files: `src/commands/memory.js`
- Risk: Memory compaction could lose entries if edge cases aren't handled.
- Priority: Low — simpler subsystem.

---

*Concerns audit: 2026-02-26*
