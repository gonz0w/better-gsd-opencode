# Coding Conventions

**Analysis Date:** 2026-03-07

## Naming Patterns

**Files:**
- Source modules use `kebab-case.js`: `codebase-intel.js`, `regex-cache.js`, `stuck-detector.js`
- Command modules are single-word or kebab-case: `state.js`, `verify.js`, `codebase.js`
- Test files use dot-separated suffix: `gsd-tools.test.cjs`, `format.test.cjs`
- All source files use `.js` extension (CommonJS module format)
- Built output uses `.cjs` extension: `bin/gsd-tools.cjs`
- Snapshot files use `.json`: `test/__snapshots__/init-phase-op.json`

**Functions:**
- Use `camelCase` for all functions: `cmdStateLoad`, `findPhaseInternal`, `extractFrontmatter`
- Command handler functions use `cmd` prefix + PascalCase command name: `cmdStateLoad`, `cmdVerifyPlanStructure`, `cmdPhaseAdd`
- Internal/private helpers use descriptive camelCase without prefix: `normalizePhaseName`, `safeReadFile`
- Suffix `Internal` for functions used by other modules but not CLI-exposed: `findPhaseInternal`, `pathExistsInternal`, `resolveModelInternal`, `generateSlugInternal`
- Formatter functions use `format` prefix: `formatStateShow`, `formatStateUpdateProgress`, `formatCodebaseAnalyze`
- Lazy-loader functions use `lazy` prefix: `lazyState()`, `lazyRoadmap()`, `lazyPhase()` (in `src/router.js`)

**Variables:**
- Use `camelCase` for local variables: `tmpDir`, `phaseDir`, `configPath`
- Private module-level caches use `_` prefix: `_modules`, `_configCache`, `_fmCache`, `_phaseTreeCache`, `_tmpFiles`, `_autoWarmMessageShown`
- Constants use `UPPER_SNAKE_CASE`: `MODEL_PROFILES`, `CONFIG_SCHEMA`, `COMMAND_HELP`, `MAX_CACHE_SIZE`, `FM_CACHE_MAX`
- Regex patterns use `UPPER_SNAKE_CASE`: `FRONTMATTER_DELIMITERS`, `PHASE_HEADER`, `PHASE_DIR_NUMBER`, `FM_KEY_VALUE`

**Types:**
- No TypeScript. JSDoc `@typedef` used for complex object shapes in `src/lib/lifecycle.js`
- JSDoc `@param`/`@returns` used for key exported functions in lib modules
- Heaviest JSDoc usage in: `src/commands/research.js` (101), `src/commands/codebase.js` (70), `src/lib/deps.js` (47), `src/lib/ast.js` (44)

## Code Style

**Formatting:**
- No automated formatter configured (no `.prettierrc`, `.eslintrc`, `.editorconfig`)
- 2-space indentation throughout
- Single quotes for strings
- Semicolons always used
- Max line length ~120 characters (not enforced, but observed)
- Trailing commas in multi-line object/array literals

**Linting:**
- No linter configured
- Code quality enforced by:
  - Dead code audit: `npx knip --include exports,files`
  - Circular dependency check: `npx madge --circular src/`
  - Export audit: `node audit-exports.js`
  - Command audit: `node audit-commands.js`
  - All four: `npm run audit:all`

**Section Dividers:**
- Use Unicode box-drawing comment headers to organize files into sections:
  ```javascript
  // ─── Section Name ──────────────────────────────────────────────────────────
  ```
- Every source file uses these section dividers to separate logical groups
- Pattern: `// ─── ` + label + ` ─` repeated to ~80 chars
- Heavily used: `src/lib/format.js` (14 sections), `src/lib/ast.js` (10 sections)

## Module Format

**Module System:** CommonJS (`require`/`module.exports`)
- Built output is CJS via esbuild: `format: 'cjs'`, `platform: 'node'`, `target: 'node18'`
- Node.js built-ins are externalized; npm deps (tokenx, acorn) are bundled

**Strict Mode:**
- Place `'use strict';` as the first statement in every new source file
- ~60% of source files include it; all newer files do
- Files without it: `src/lib/helpers.js`, `src/lib/config.js`, `src/lib/constants.js`, `src/lib/frontmatter.js`, `src/lib/git.js`, `src/commands/intent.js`, `src/commands/memory.js`, `src/commands/phase.js`, `src/commands/roadmap.js`, `src/commands/state.js`, `src/commands/trajectory.js`

**Entry Point:** `src/index.js` (5 lines — requires router, calls `main()`)

## Import Organization

**Order:**
1. Node.js built-in modules: `const fs = require('fs');`, `const path = require('path');`, `const { execFileSync } = require('child_process');`
2. Internal output/error module: `const { output, error, debugLog } = require('../lib/output');`
3. Internal config: `const { loadConfig } = require('../lib/config');`
4. Internal helpers (grouped by function): `helpers`, `frontmatter`, `git`, `format`, `constants`
5. Sibling command modules (rare): `const { getIntentDriftData } = require('./intent');`

**Path Style:**
- Always relative paths with `../lib/` or `./` prefix
- No path aliases configured
- Destructured imports preferred:
  ```javascript
  const { safeReadFile, cachedReadFile, normalizePhaseName, findPhaseInternal } = require('../lib/helpers');
  ```

**Lazy Loading:**
- Router uses lazy-loading pattern for all 19 command/lib modules to avoid parsing overhead at startup:
  ```javascript
  const _modules = {};
  function lazyState() { return _modules.state || (_modules.state = require('./commands/state')); }
  ```
- Also used in `src/lib/helpers.js` for CacheEngine and in `src/lib/context.js` for tokenx
- Use this pattern when adding new command modules in `src/router.js`

## Error Handling

**Patterns:**
- **Fatal errors:** Use `error(message)` from `src/lib/output.js` — writes to stderr and calls `process.exit(1)`
  ```javascript
  if (!filePath) { error('file path required'); }
  ```
- **Recoverable errors:** Return error in JSON output object, do NOT exit:
  ```javascript
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  ```
- **Silent failures:** Use try/catch with `debugLog` for non-critical operations:
  ```javascript
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    debugLog('file.read', 'read failed', e);
    return null;
  }
  ```
- **Never throw.** Functions return `null` or empty defaults on failure, never throw exceptions
- `safeReadFile()` in `src/lib/helpers.js` wraps `fs.readFileSync` — returns `null` on error instead of throwing

**Debug Logging:**
- Use `debugLog(context, message, err)` from `src/lib/output.js` for all debug output
- Only emits when `GSD_DEBUG` env var is set
- Format: `[GSD_DEBUG] {context}: {message} | {err.message}`
- Context uses dot-notation convention: `'file.read'`, `'config.load'`, `'git.exec'`, `'phase.tree'`, `'dir.cache'`
- Output goes to stderr — never contaminates JSON stdout

## Output Patterns

**Dual-Mode Output:**
- All command handlers receive a `raw` boolean parameter (legacy) or use `output(result, { formatter })` (migrated)
- `output()` from `src/lib/output.js` handles JSON/formatted routing based on `global._gsdOutputMode`
- Piped (non-TTY) → JSON to stdout; TTY → human-readable formatted output
- `--pretty` flag forces formatted output even when piped
- Status/progress messages go to stderr via `status(message)` — never pollute stdout
- Help text goes to stderr via `process.stderr.write()` — never contaminates JSON stdout

**Command Handler Signature (legacy):**
```javascript
function cmdSomething(cwd, args, raw) {
  // ... compute result ...
  output(result, raw);
}
```

**Command Handler Signature (migrated):**
```javascript
function cmdSomething(cwd, args, raw) {
  const result = { /* ... */ };
  output(result, {
    formatter: (data) => {
      const lines = [];
      lines.push(banner('Title'));
      lines.push('');
      lines.push(sectionHeader('Section'));
      // ... format data ...
      lines.push(summaryLine('Summary text'));
      return lines.join('\n');
    }
  });
}
```

**Formatted output primitives** (from `src/lib/format.js`):
- `banner(title)` — branded header: `bGSD ▶ {TITLE}` with rule
- `sectionHeader(label)` — `━━ Label ━━━━━━━━━`
- `formatTable(headers, rows, options)` — PSql-style aligned table with truncation
- `progressBar(percent, width)` — `47% [███████░░░]`
- `summaryLine(text)` — horizontal rule + bold summary
- `actionHint(text)` — dim `→ next action`
- `box(content, type)` — info/warning/error/success box with horizontal rules
- `color.red/green/yellow/blue/cyan/magenta/bold/dim/underline()` — ANSI color (auto-disabled by `NO_COLOR` env or non-TTY)
- `listWithTruncation(items, max)` — numbered list with "... and N more"
- `SYMBOLS` — Unicode symbols: ✓ ✗ ▶ ○ ⚠ → • ─ ━

**Large Payload Handling:**
- JSON payloads >50KB are written to tmpfile and stdout gets `@file:/tmp/gsd-{timestamp}.json`
- Tmpfiles are cleaned up on `process.exit` via registered handler in `src/lib/output.js`
- Skip with `GSD_NO_TMPFILE=1` env var

**Field Filtering:**
- `--fields name,status` global flag filters JSON output to only requested fields
- Supports dot-notation for nested access: `--fields phases.status`
- Implemented in `filterFields()` in `src/lib/output.js`

## Caching Patterns

**Module-level caches** persist for a single CLI invocation (no TTL needed since process exits):
- `_cacheEngine` (CacheEngine) in `src/lib/helpers.js` — SQLite-backed persistent file cache
- `dirCache` (Map) in `src/lib/helpers.js` — caches `fs.readdirSync` results
- `_configCache` (Map) in `src/lib/config.js` — keyed by cwd
- `_fmCache` (Map) in `src/lib/frontmatter.js` — keyed by content hash, LRU eviction at 100 entries
- `_dynamicRegexCache` (Map) in `src/lib/regex-cache.js` — LRU eviction at 200 entries
- `_phaseTreeCache` in `src/lib/helpers.js` — single cached phase directory tree scan
- `_milestoneCache` in `src/lib/helpers.js` — single cached milestone info
- `_fieldRegexCache` (Map) in `src/commands/state.js` — cached regex for field extraction/replacement

**Persistent Cache:**
- `CacheEngine` in `src/lib/cache.js` uses SQLite (`node:sqlite`) with Map fallback
- SQLite DB stored at `~/.config/oc/get-shit-done/cache.db`
- Force Map fallback for testing: `--no-cache` flag or `GSD_CACHE_FORCE_MAP=1`

**Cache invalidation:** Call `invalidateFileCache(path)` or `invalidateMilestoneCache()` after writing files.

**LRU Pattern:**
```javascript
const MAX_SIZE = 200;
const cache = new Map();
function cachedGet(key) {
  if (cache.has(key)) {
    const val = cache.get(key);
    cache.delete(key); cache.set(key, val); // Move to end
    return val;
  }
  if (cache.size >= MAX_SIZE) {
    cache.delete(cache.keys().next().value); // Evict oldest
  }
  const val = compute(key);
  cache.set(key, val);
  return val;
}
```

## CLI Argument Parsing

**Pattern:** Manual `args.indexOf()` for named flags, positional `args[N]` for required args:
```javascript
const phaseIdx = args.indexOf('--phase');
const phase = phaseIdx !== -1 ? args[phaseIdx + 1] : null;
```

**Global flags** are parsed and spliced out in `src/router.js` before command dispatch:
- `--pretty`, `--raw`, `--fields <field,...>`, `--verbose`, `--compact`, `--manifest`, `--no-cache`
- These set `global._gsdOutputMode`, `global._gsdRequestedFields`, `global._gsdCompactMode`, `global._gsdManifestMode`

**Boolean flags:** Use `args.includes('--flag')`:
```javascript
const fix = args.includes('--fix');
const dryRun = args.includes('--dry-run');
```

**Namespace routing:** Commands use `namespace:command` syntax (e.g., `plan:roadmap analyze`):
```javascript
// Router splits on first colon
const colonIdx = command.indexOf(':');
namespace = command.substring(0, colonIdx);
// Remaining args passed to command handler
```

## Git Operations

**Use `execGit()` from `src/lib/git.js`** — NOT `execSync('git ...')`:
```javascript
const { execGit } = require('../lib/git');
const result = execGit(cwd, ['log', '--oneline', '-n', '10']);
if (result.exitCode === 0) { /* use result.stdout */ }
```
- Uses `execFileSync('git', args)` — bypasses shell, prevents injection, ~2ms faster per call
- Returns `{ exitCode, stdout, stderr }` — never throws
- All calls profiled via `startTimer`/`endTimer` when `GSD_PROFILE=1`

**Shell argument safety:** Use `sanitizeShellArg()` from `src/lib/helpers.js` when interpolating user input into rare shell commands (wraps in single quotes, escapes internal quotes).

**Date validation:** Use `isValidDateString()` from `src/lib/helpers.js` to validate YYYY-MM-DD strings before interpolating into git `--since` args.

## Frontmatter Handling

**Use `extractFrontmatter()` from `src/lib/frontmatter.js`** for reading YAML frontmatter:
```javascript
const { extractFrontmatter } = require('../lib/frontmatter');
const fm = extractFrontmatter(content);
// fm.wave, fm.phase, fm.type, fm.requirements, etc.
```
- Custom parser optimized for GSD planning files (not a general YAML parser)
- Handles nested objects (2 levels), arrays, inline arrays `[a, b, c]`
- Pre-compiled regex patterns (`FM_DELIMITERS`, `FM_KEY_VALUE`)
- Results cached in `_fmCache` (LRU, max 100 entries)

**Use `spliceFrontmatter()` for updating** — replaces frontmatter block while preserving body:
```javascript
const { spliceFrontmatter } = require('../lib/frontmatter');
fm.wave = '2';
const newContent = spliceFrontmatter(content, fm);
fs.writeFileSync(filePath, newContent);
```

**Use `reconstructFrontmatter()` to serialize objects back to YAML string** — handles arrays, nested objects, quoting for values containing `:` or `#`.

## Performance Instrumentation

**Opt-in profiling** via `GSD_PROFILE=1`:
- `startTimer(label)` / `endTimer(timer)` from `src/lib/profiler.js`
- Zero-cost when disabled (functions return null early)
- Baselines written to `.planning/baselines/{command}-{timestamp}.json`
- Compare baselines: `gsd-tools util:profiler compare --before old.json --after new.json`

## Function Design

**Size:** Functions are medium-length (20-80 lines typical). Complex parsers can reach 100-150 lines.

**Parameters:** Use positional params for required args, object destructuring for optional:
```javascript
function cmdVerifyQuality(cwd, { plan, phase }, raw) { ... }
function cmdMemoryRead(cwd, { store, limit, query, phase, category, tags, from, to, asc }, raw) { ... }
```

**Return Values:**
- Return plain objects for JSON serialization. Never return class instances.
- Use `null` for "not found" cases, empty arrays/objects for "no results"
- Boolean results use `found: true/false` or `valid: true/false`

**Async:** Only 2 functions are async (`cmdWebsearch` in `src/commands/misc.js`, `cmdProfilerCacheSpeedup` in `src/commands/profiler.js`). Everything else is synchronous.

## Module Design

**Exports:** Single `module.exports` at end of file with explicit named exports:
```javascript
module.exports = { cmdStateLoad, cmdStateUpdate, cmdStatePatch, /* ... */ };
```
- Some modules export test-only functions with comments: `// Exported for testing`
- Example: `src/commands/agent.js` exports `parseRaciMatrix` for direct test access

**Barrel Files:** Not used. Each module imports directly from the source.

**File Organization:**
- `src/lib/*.js` — shared utilities, parsers, helpers (no CLI output)
- `src/lib/recovery/*.js` — recovery/stuck-detection logic (`stuck-detector.js`)
- `src/lib/review/*.js` — review logic (`severity.js`)
- `src/commands/*.js` — command handlers (18 modules, call `output()` or `error()`)
- `src/router.js` — CLI argument parsing and namespace-based command dispatch (930 lines)
- `src/index.js` — entry point (5 lines: require router, call main)

## Git Conventions

**Commit Message Format:**
- Conventional Commits style: `type(scope): description`
- Types: `feat`, `fix`, `perf`, `test`, `docs`, `chore`, `refactor`
- Scope patterns:
  - Phase reference: `feat(66-01):`, `docs(65-02):`, `perf(65-01):`
  - Phase completion: `docs(phase-66):`, `docs(phase-65):`
  - No scope for broad changes: `chore: apply v8.2 agent manifest tightening`

**Commit Examples:**
```
feat(66-03): enhance audit with dynamic RACI parsing and add validate-contracts subcommand
test(66-03): add tests for agent audit RACI parsing and validate-contracts
perf(65-02): optimize init command hot paths with cached git and fast intel reads
docs(phase-66): complete phase execution
chore: archive v8.2 milestone — cleanup, performance & validation
fix: update deploy.sh smoke test to use namespaced command
```

## Comments

**When to Comment:**
- JSDoc `@param`/`@returns` for exported functions with non-obvious signatures
- Inline comments for regex patterns explaining what they match
- Section dividers (`// ─── Section Name ──`) for file organization
- `// Backward compat:` comments when preserving legacy behavior
- `// Legacy:` comments for code that exists for migration compatibility

**JSDoc:**
- Used selectively on key exported functions, not universally
- `@typedef` for complex object shapes (see `src/lib/lifecycle.js`)
- Always include `@param` types and `@returns` type when used
- Heaviest in library modules; lighter in command modules

---

*Convention analysis: 2026-03-07*
