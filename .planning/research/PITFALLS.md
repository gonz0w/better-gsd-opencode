# Pitfalls Research

**Domain:** Node.js CLI tool refactoring (single-file 6,495-line CJS monolith → bundled, tested, logged)
**Researched:** 2026-02-22
**Confidence:** HIGH (based on codebase analysis + verified ecosystem patterns)

## Critical Pitfalls

### Pitfall 1: Bundler Breaks deploy.sh Before Anyone Notices

**What goes wrong:**
Adding a bundler (esbuild, rollup, tsup) introduces a build step between "edit code" and "deploy works." The current `deploy.sh` does `cp -r "$SRC/bin" "$DEST/"` — it copies the source `bin/` directory directly. After adding a bundler, the deployable artifact is now `dist/gsd-tools.cjs` (or similar), but `deploy.sh` still copies the unbundled source. Deployment silently ships un-built code, which either works (because the source file still exists) or breaks (because imports can't resolve split modules).

The worst case: deploy.sh copies source files that contain `import` statements or `require('./parser')` that only resolve when bundled. The deployed tool crashes with `MODULE_NOT_FOUND` but only on the live install path — the dev workspace still works because all source files are present.

**Why it happens:**
The build step is added to `package.json` scripts but `deploy.sh` is a standalone bash script that nobody updates in the same PR. CI doesn't run `deploy.sh`, so the break is invisible until someone runs `./deploy.sh` and then tries to use the live plugin.

**How to avoid:**
1. Update `deploy.sh` as the **first task** of the bundler phase, not the last
2. Add a build step to deploy.sh: `npm run build && cp -r dist/ "$DEST/bin/"` (or equivalent)
3. Add a smoke test to deploy.sh: after copying, run `node "$DEST/bin/gsd-tools.cjs" --version` (or `current-timestamp`) to verify the deployed artifact actually executes
4. Keep the single source file working standalone during the transition — only break it once deploy.sh is proven to handle the built artifact

**Warning signs:**
- `deploy.sh` hasn't been modified in the same commit/PR as the bundler setup
- `bin/gsd-tools.cjs` no longer works with `node bin/gsd-tools.cjs` directly (only the bundled output does)
- Tests pass but `./deploy.sh && node ~/.config/opencode/get-shit-done/bin/gsd-tools.cjs current-timestamp` fails

**Phase to address:**
The bundler/build-system phase. deploy.sh must be updated **in the same phase** as bundler introduction, not deferred.

---

### Pitfall 2: Silent Catch → Logging Changes Behavioral Contracts

**What goes wrong:**
The 55 `} catch {}` blocks aren't just sloppy — many are **intentional behavioral contracts**. Code calling these functions expects them to return `null`/`''`/`[]` on failure without side effects. Adding `console.error()` or `process.stderr.write()` introduces output where callers expect silence.

Concrete example from the codebase: `getSessionDiffSummary()` (line 4992–5009) wraps an entire function in `try { ... } catch { return null; }`. The caller `cmdInitProgress()` checks `if (diff)` to conditionally include diff data. If the catch block now logs to stderr, every time STATE.md is missing or git log fails (both normal conditions on fresh projects), stderr gets noise that AI agents may interpret as errors.

Worse: the `output()` function (line 465) writes JSON to stdout. Any `console.log()` accidentally used for debug logging will corrupt the JSON output stream and break every caller that parses the result.

**Why it happens:**
Developers replacing silent catches think of error visibility but forget that CLI tools have two communication channels (stdout for data, stderr for errors) and that "error" in a library sense (file not found) may be "expected" in a CLI sense (project not initialized yet).

**How to avoid:**
1. Categorize all 55 catches before changing any: "genuinely silent" (file optional, git optional) vs. "hiding bugs" (state write failure, parse error on known-good input)
2. Use a gated debug log: `if (process.env.GSD_DEBUG) process.stderr.write(...)` — never `console.log` or `console.error`
3. Never write to stdout in catch blocks — stdout is the data channel
4. For the ~10-15 catches that hide genuine bugs (CONCERNS.md's estimate), convert to explicit error returns with `{ error: "..." }` in the JSON result, not stderr noise
5. Write a test that verifies `node gsd-tools.cjs state load --raw 2>/dev/null` produces valid JSON when run in an empty directory — this catches any stderr/stdout contamination

**Warning signs:**
- AI agents start reporting "Error: ..." messages they don't understand during normal workflows
- `--raw` output starts containing debug text mixed with JSON
- Fresh project initialization (`gsd-tools.cjs init progress`) logs warnings about missing files that don't exist yet

**Phase to address:**
The error-handling/logging phase. Must be done **after** tests are added for state mutation commands (so regressions from catch changes are caught), but **before** wiring new commands into workflows (so agents don't encounter noisy output).

---

### Pitfall 3: Regex "Improvements" Break Backward Compatibility

**What goes wrong:**
The codebase has 309+ regex patterns, many with accumulated compatibility quirks like `**Goal:?**:?` (accepts 4 format variations per CONCERNS.md line 36). When someone "cleans up" or "simplifies" a regex during refactoring, they unknowingly drop a variant that exists in real ROADMAP.md/STATE.md files. The regex still passes new tests (written against the new format) but silently fails to match existing project files.

The most dangerous case: a regex change in `getMilestoneInfo()` (lines 4244–4311) that alters which milestone is detected as "active." The function has 5 fallback strategies. If strategy 1's regex is tightened, it falls through to strategy 5, which just grabs any `v\d+.\d+` — returning the wrong milestone. Every phase operation then scopes to the wrong set of phases.

**Why it happens:**
Regex refactoring feels safe ("I'm just cleaning this up"). The test suite covers the happy path but not the 4 format variations. The `AGENTS.md` rule ("All regex/parser changes must accept both old and new formats") is documentation, not enforcement. No test asserts against real ROADMAP.md files from `/mnt/raid/DEV/event-pipeline/.planning/`.

**How to avoid:**
1. **Golden file tests**: Copy real `.planning/` files from event-pipeline as test fixtures. Run every regex-touching change against them. This is the single most important prevention.
2. **Never simplify a regex without adding the old test case first**: Before changing `**Goal:?**:?`, write tests for all 4 variants: `**Goal**`, `**Goal:**`, `**Goal** :`, `**Goal:** `
3. **Regex changes get their own commits**: Never bundle a regex "cleanup" with a feature change. If the feature commit breaks parsing, git bisect can't isolate the regex change.
4. **Run the real-project test**: `node bin/gsd-tools.cjs init progress --raw` against event-pipeline after every regex change, as AGENTS.md line 33 already documents.

**Warning signs:**
- Test passes but `milestone_version` returns a different value when run against event-pipeline
- Phase count changes between commits without any phase being added/removed
- `progress_percent` changes unexpectedly

**Phase to address:**
The testing phase must establish golden file fixtures **before** any regex refactoring happens. The config schema extraction phase (which touches `loadConfig()` regex patterns) should be particularly careful.

---

### Pitfall 4: Test-Induced Refactoring — Changing Code to Fit Tests

**What goes wrong:**
The existing code is a 6,495-line single file with no exports. To test individual functions, developers add `module.exports = { cmdStateUpdate, cmdStatePatch, ... }` or refactor functions to be "more testable" by extracting pure logic. These refactoring changes introduce bugs in the code they were supposed to help test. The irony: the test for `cmdStatePatch()` passes, but the refactored `cmdStatePatch()` now behaves differently in production because a side effect was removed to make it testable.

Specific risk in this codebase: the current test file (`bin/gsd-tools.test.cjs`) tests via CLI invocation (`execSync('node gsd-tools.cjs ...')`). Switching to unit-level imports would require either: (a) adding exports to gsd-tools.cjs (changing the file's module contract), or (b) mocking `process.argv` and intercepting `process.stdout.write`/`process.exit`. Both approaches change the code or require complex test infrastructure.

**Why it happens:**
"I need to test this function" → "I can't test it without exporting it" → "Let me refactor it to be exportable" → Scope creep from test phase into code change phase.

**How to avoid:**
1. **Keep testing via CLI invocation** (the existing pattern): `execSync('node gsd-tools.cjs state patch --field val')` then assert on JSON output. This tests the actual user contract, not implementation details.
2. **If unit tests are needed**, add a test-only export guard: `if (process.env.GSD_TEST_EXPORTS) module.exports = { ... }` — never unconditional exports from a CLI entry point
3. **Separate "add tests" from "refactor code"**: Phase 1 adds tests for current behavior. Phase 2 refactors with tests as a safety net. Never combine them.
4. **The existing test file pattern works** — 19 `describe` blocks already test via CLI execution. Extend this pattern for the 8 state mutation commands rather than inventing a new test approach.

**Warning signs:**
- `module.exports` or `export` added to `gsd-tools.cjs` during a "testing" phase
- Test file imports functions directly instead of invoking the CLI
- Test passes but `deploy.sh` output doesn't include the added exports (bundler strips them, etc.)

**Phase to address:**
The testing phase. Decision on test approach must be made upfront — CLI invocation (safe, proven) vs. unit imports (requires code changes). Recommend CLI invocation.

---

### Pitfall 5: esbuild CJS Bundling Rewrites `require()` Semantics

**What goes wrong:**
When esbuild bundles CJS code with `--format=cjs --platform=node`, it processes `require()` calls and may inline or wrap them. For Node.js built-ins (`require('fs')`, `require('path')`, `require('os')`), esbuild marks them as external by default with `--platform=node`. But if `--bundle` is used without `--platform=node`, esbuild wraps require calls in `__require` shims that change behavior.

Specific risk in this codebase: `require('os')` is called inline at lines 473, 600, and 4452 (inside function bodies, not at the top level). esbuild may hoist or wrap these differently depending on configuration. The `execSync` from `child_process` is used throughout for git commands — if the bundler mishandles this, every git operation silently fails (and gets caught by `} catch {}`).

Another risk: the shebang line `#!/usr/bin/env node` (line 1). esbuild strips shebangs by default. The deployed file loses executability. The `banner` option must be set to re-add it.

**Why it happens:**
The esbuild defaults are tuned for web bundling. Node.js CLI bundling requires explicit configuration (`--platform=node`, `--banner:js='#!/usr/bin/env node'`, `--external:` for any native modules). Developers copy esbuild configs from web projects and assume they work for CLI tools.

**How to avoid:**
1. Use `--platform=node` always — this marks all Node.js built-ins as external
2. Add `--banner:js='#!/usr/bin/env node'` to preserve the shebang
3. After every build, verify: `head -1 dist/gsd-tools.cjs` shows the shebang, `node dist/gsd-tools.cjs current-timestamp` produces valid output
4. Start with the simplest possible config: `esbuild bin/gsd-tools.cjs --bundle --platform=node --format=cjs --outfile=dist/gsd-tools.cjs --banner:js='#!/usr/bin/env node'`
5. Do NOT set `--format=esm` — the source is CJS, the output should remain CJS. ESM conversion would break `require()`, `__dirname`, `__filename`, `module.exports` semantics.
6. Test the built artifact, not the source, in CI

**Warning signs:**
- Built file doesn't start with `#!/usr/bin/env node`
- `require('os')` calls throw "Dynamic require is not supported" errors
- File size of built artifact is suspiciously small (built-ins got excluded but helpers didn't get inlined) or suspiciously large (node built-ins got bundled)
- `process.exit()` behaves differently in bundled code

**Phase to address:**
The bundler/build-system phase. The esbuild config must be validated with a smoke test suite before any source code splitting begins.

---

### Pitfall 6: Config Schema Extraction Introduces Format Incompatibility

**What goes wrong:**
Extracting a single `CONFIG_SCHEMA` constant from the current three-way split (`loadConfig()` line 158, `cmdConfigEnsureSection()` line 616, `cmdValidateConfig()` line 5932) sounds straightforward but has a hidden trap: the three sources don't agree on field names. `loadConfig()` uses `plan_checker`, `cmdConfigEnsureSection()` writes `workflow.plan_check` (not `plan_checker`), and `cmdValidateConfig()` has `research_enabled` (not `research`). A single schema must either pick one name (breaking existing config.json files that use the other names) or maintain the translation layer.

If the extraction drops the nested→flat translation in `loadConfig()` (lines 176–182), every existing `config.json` that uses `workflow: { research: true, plan_check: true }` stops being read correctly. The config silently falls back to defaults because `loadConfig()` catches the error.

**Why it happens:**
The three definitions evolved independently. The extraction refactoring assumes they're "the same thing with minor differences" when they're actually three different contracts: (1) what the tool reads, (2) what the tool writes, (3) what the tool validates.

**How to avoid:**
1. **Map all three schemas first**: Create a table of every field across all three sources before writing any code. Document which fields are aliases.
2. **Write round-trip tests before changing anything**: `config-ensure-section` → `loadConfig()` → `validate-config` should produce no warnings. Test this with real event-pipeline config.json.
3. **The schema must explicitly define aliases**: `{ field: 'plan_checker', aliases: ['plan_check'], nested: 'workflow.plan_check' }`
4. **Do not break existing config.json files** — the schema must accept all current formats.

**Warning signs:**
- After extraction, `cmdValidateConfig()` starts reporting "unknown key" for fields that `loadConfig()` reads fine
- `config-ensure-section` writes a config that `loadConfig()` doesn't fully read
- Tests pass with freshly-generated config but fail with real project config

**Phase to address:**
Should be its own focused phase, early in the roadmap (it's a prerequisite for clean testing of config-related functions).

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Testing only via CLI execution, never unit-testing internal functions | No code changes needed, tests match real usage | Can't test edge cases without creating fixture files for each one; slow test execution (spawns processes) | Acceptable for this project — the CLI contract is what matters, not internal APIs |
| Keeping all 309 regexes inline rather than extracting named constants | No refactoring risk, each pattern stays near its usage site | Duplicate patterns diverge, format changes require finding all instances | Acceptable during improvement pass; extract the most-duplicated ones (bold field pattern used ~20 times) |
| Using `process.env.GSD_DEBUG` instead of a proper log-level system | Minimal code change, no dependencies | Only two levels (debug on/off), no warn/info distinction | Acceptable for CLI tool — add log levels only if needed later |
| Bundler config as a build script rather than a config file | One file to maintain | Harder for contributors to understand build options | Acceptable — a `build.mjs` script with esbuild API is clearer than `esbuild.config.json` |

## Integration Gotchas

Common mistakes when connecting refactored internals to existing workflows.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Slash commands calling gsd-tools.cjs | New commands added to gsd-tools.cjs but slash command files still point to old paths after build | Slash commands must reference the **deployed** path, not the dev workspace path. Verify after deploy. |
| Workflow `.md` files invoking gsd-tools.cjs | Workflow assumes `gsd-tools.cjs` output format. Adding debug logging to stderr causes workflow prompt to include error text | All debug output goes to stderr with `GSD_DEBUG` gate. Workflows capture stdout only. |
| `deploy.sh` after build step added | deploy.sh copies source `bin/` instead of built `dist/` | deploy.sh must run build first, then copy build output |
| Test file after bundler introduced | Tests import source file directly while deploy uses bundled file — tests pass but deployed code fails | Either test the bundled output OR ensure bundled output is byte-equivalent to source for zero-dependency case |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| In-memory cache without invalidation | Stale data within a single CLI invocation if a command reads, modifies, then re-reads the same file | Cache must be invalidated on write, or cache is read-only (populated once, never updated). For this CLI tool, read-only cache is correct since each invocation is short-lived. | Breaks if commands are ever chained in-process instead of via separate CLI invocations |
| Golden file tests with real project data | Tests break when the real project evolves (phases completed, roadmap updated) | Copy fixture files at a point in time, store in test fixtures directory, don't reference live project files at runtime | Breaks the first time event-pipeline advances a phase |
| esbuild rebuild on every test run | Test suite takes 10s+ because it rebuilds the bundle before running | Separate `npm run build` from `npm test`. Only rebuild when source changes. Use source file directly for tests. | Breaks when test file count exceeds ~50 |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding `console.log` debug output that includes file contents | Planning data (decisions, blockers, sensitive project details) appears in logs | Debug logging should log filenames and parse results, never raw file contents |
| Bundler including `node_modules` in output | Dev dependencies (test utilities, etc.) get bundled into deployed CLI | Use `--external` for all non-essential packages, or `--packages=external` with esbuild |
| Shell injection when `since` date is logged in debug output | Unlikely but logged strings could contain shell metacharacters if they come from user-controlled STATE.md fields | Sanitize before logging, same as before shell interpolation |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Debug logging enabled by default after "fixing" silent catches | AI agents parsing stdout get confused by stderr noise. Developers see warning spam on every invocation. | Debug logging OFF by default. Only enabled with `GSD_DEBUG=1`. Never log to stdout. |
| Bundled file is minified (harder to debug in production) | When deployed tool fails, stack traces point to `line 1, column 48273` | Use `--minify=false` (or no minify flag). Readable output is more valuable than 50KB savings for a CLI tool. |
| Build step fails silently in deploy.sh | Developer thinks deploy succeeded but shipped stale artifact | `set -euo pipefail` (already present) + explicit build verification step |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Bundler setup:** Tests pass locally — verify deployed artifact works: `./deploy.sh && node ~/.config/opencode/get-shit-done/bin/gsd-tools.cjs current-timestamp --raw`
- [ ] **Silent catch replacement:** All 55 catches have debug logging — verify `node gsd-tools.cjs state load --raw 2>/dev/null` still produces clean JSON in an empty directory
- [ ] **Config schema extraction:** Single schema defined — verify `config-ensure-section` → `loadConfig()` → `validate-config` round-trip works with event-pipeline's real `config.json`
- [ ] **State mutation tests:** 8 commands tested — verify tests actually modify STATE.md and read back the result (not just check the JSON output, but also re-parse the written file)
- [ ] **Frontmatter round-trip tests:** Parse → reconstruct works — verify with YAML that contains colons in values (e.g., `title: "Phase: Setup"`) since the custom parser has known edge cases (CONCERNS.md line 42)
- [ ] **New slash commands wired:** 11 commands have slash command files — verify each command file references the correct gsd-tools.cjs path and the command actually executes
- [ ] **package.json added:** Has `engines`, `test`, `build` scripts — verify `npm test` and `npm run build` work from a clean clone (no implicit global state)
- [ ] **Shebang preserved after bundling:** `head -1 dist/gsd-tools.cjs` shows `#!/usr/bin/env node` — this is the most commonly forgotten esbuild config

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| deploy.sh ships unbundled source | LOW | Fix deploy.sh, redeploy. No data loss. |
| Regex change breaks milestone detection | MEDIUM | `git bisect` to find the breaking commit. Revert the regex change. Add the failing case as a test before re-attempting. |
| Debug logging corrupts stdout JSON | LOW | Remove the offending `console.log` (change to `process.stderr.write` with `GSD_DEBUG` guard). Run `node gsd-tools.cjs state load --raw \| python3 -c "import json,sys; json.load(sys.stdin)"` to verify clean output. |
| Config schema extraction breaks existing configs | MEDIUM | Revert schema change. Map all three sources completely before re-attempting. Write the round-trip test first. |
| Test-induced refactoring changes behavior | HIGH | Hard to detect — behavior change may be subtle. Requires comparing output of every command before/after the refactoring. Golden file tests against real project data are the best prevention. |
| esbuild bundles Node.js built-ins | LOW | Add `--platform=node` to esbuild config. Rebuild and verify file size is reasonable (~150-200KB for a 6,495-line file, not 2MB+). |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| deploy.sh breaks after bundler | Build system / bundler phase | `./deploy.sh && node ~/.config/opencode/get-shit-done/bin/gsd-tools.cjs current-timestamp --raw` succeeds |
| Silent catch → logging breaks callers | Error handling phase (must come after testing phase) | `GSD_DEBUG=0 node gsd-tools.cjs state load --raw 2>/dev/null` produces valid JSON; `GSD_DEBUG=1` same command produces debug output on stderr only |
| Regex backward compat broken | Testing phase (golden fixtures must exist before any regex work) | All tests pass against both new fixtures AND copied event-pipeline fixtures |
| Test-induced refactoring | Testing phase (decision: CLI invocation vs unit imports) | No `module.exports` changes in gsd-tools.cjs during testing phase |
| esbuild CJS bundling issues | Build system phase | Built artifact is executable, has shebang, passes smoke test, doesn't contain `__require` shims for built-ins |
| Config schema format incompatibility | Config consolidation phase (should precede testing phase) | Round-trip test: ensure-section → load → validate produces zero warnings |

## Sources

- Codebase analysis: `bin/gsd-tools.cjs` (6,495 lines), `bin/gsd-tools.test.cjs` (2,302 lines), `deploy.sh`
- `.planning/codebase/CONCERNS.md` — 55 silent catches, 309 regex patterns, config schema drift documented
- `.planning/PROJECT.md` — constraints, key decisions, out-of-scope items
- esbuild documentation: CJS/ESM interop, `--platform=node`, `--banner` option, `__require` shim behavior (https://esbuild.github.io/content-types/, https://esbuild.github.io/api/)
- esbuild GitHub issues: #1467 (CJS→ESM bundling), #1950 (duplicate modules in bundle), #3637 (ESM+Node.js issues)
- Node.js error handling patterns: https://www.honeybadger.io/blog/errors-nodejs/

---
*Pitfalls research for: GSD Plugin Node.js CLI refactoring*
*Researched: 2026-02-22*
