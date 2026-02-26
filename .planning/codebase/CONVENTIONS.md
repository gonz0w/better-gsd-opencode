# Coding Conventions

**Analysis Date:** 2026-02-26

## Language & Runtime

**Primary:** JavaScript (Node.js >=18, CommonJS modules)
- All source files use `'use strict'` at top
- `require()` for imports, `module.exports` for exports
- Zero runtime dependencies except `tokenx` (bundled by esbuild)
- Node.js built-ins only: `fs`, `path`, `child_process`, `os`, `crypto`

## Naming Patterns

**Files:**
- Source files: `kebab-case.js` (e.g., `codebase-intel.js`, `regex-cache.js`)
- Command modules: `kebab-case.js` in `src/commands/` (e.g., `state.js`, `worktree.js`)
- Library modules: `kebab-case.js` in `src/lib/` (e.g., `frontmatter.js`, `output.js`)
- Test files: `*.test.cjs` co-located with build output (e.g., `bin/gsd-tools.test.cjs`)
- Templates: `kebab-case.md` (e.g., `continue-here.md`, `summary-standard.md`)
- Workflows: `kebab-case.md`, prefixed with `cmd-` for thin wrappers (e.g., `cmd-velocity.md`)

**Functions:**
- camelCase for all functions: `cmdStateLoad`, `findPhaseInternal`, `extractFrontmatter`
- Command handlers prefixed with `cmd`: `cmdStateUpdate`, `cmdInitProgress`, `cmdPhaseComplete`
- Internal helpers suffixed with `Internal`: `findPhaseInternal`, `resolveModelInternal`, `pathExistsInternal`
- Private/uncached variants prefixed with `_`: `_getMilestoneInfoUncached`

**Variables:**
- camelCase for local variables: `phaseDir`, `planCount`, `roadmapContent`
- UPPER_SNAKE_CASE for module-level constants: `CONFIG_SCHEMA`, `MODEL_PROFILES`, `COMMAND_HELP`
- UPPER_SNAKE_CASE for pre-compiled regex patterns: `PHASE_DIR_NUMBER`, `FRONTMATTER_DELIMITERS`
- Underscore prefix for module-level caches: `_configCache`, `_phaseTreeCache`, `_fmCache`

**Types / Data Structures:**
- Plain objects (no classes). No TypeScript types or JSDoc `@typedef` except in `src/lib/conventions.js`
- Exported constants are plain objects or Maps

## Code Style

**Formatting:**
- 2-space indentation
- Single quotes for strings
- No trailing commas (most of the time)
- No semicolons at end of lines... actually **yes semicolons** — all source files use semicolons consistently

**Linting:**
- No linter configured (no `.eslintrc`, `.prettierrc`, or `biome.json`)
- Style is enforced by convention, not tooling

**Line length:**
- No hard limit, but long lines are common in `src/lib/constants.js` (CONFIG_SCHEMA definitions)
- Template strings and regex patterns may exceed 120 chars

## Import Organization

**Order:**
1. Node.js built-ins: `const fs = require('fs')`, `const path = require('path')`
2. Internal lib modules: `const { output, error, debugLog } = require('../lib/output')`
3. Internal command modules (rare cross-imports): `const { getIntentDriftData } = require('./intent')`

**Path style:**
- Relative paths only: `../lib/output`, `./helpers`, `./git`
- No path aliases or barrel files
- Destructured imports are standard: `const { execGit } = require('../lib/git')`

**Lazy loading pattern** (in `src/router.js`):
```javascript
const _modules = {};
function lazyState() { return _modules.state || (_modules.state = require('./commands/state')); }
```
Use lazy loading for command modules in the router to avoid parsing all modules at startup.

## Error Handling

**Patterns:**

1. **Fatal errors** — call `error(message)` from `src/lib/output.js`:
   ```javascript
   function error(message) {
     process.stderr.write('Error: ' + message + '\n');
     process.exit(1);
   }
   ```
   Use for: missing required arguments, invalid subcommands.

2. **Graceful degradation** — return structured error in JSON output:
   ```javascript
   output({ error: 'STATE.md not found' });
   ```
   Use for: missing files, missing sections, operation-specific failures. The caller gets valid JSON with an `error` field.

3. **Silent fallbacks** — try/catch with `debugLog`, return default:
   ```javascript
   try {
     const content = fs.readFileSync(path, 'utf-8');
   } catch (e) {
     debugLog('context', 'read failed', e);
     return null;
   }
   ```
   Use for: optional files, cache misses, non-critical reads.

4. **Debug logging** — conditional on `GSD_DEBUG` env var, always to stderr:
   ```javascript
   function debugLog(context, message, err) {
     if (!process.env.GSD_DEBUG) return;
     let line = `[GSD_DEBUG] ${context}: ${message}`;
     if (err) line += ` | ${err.message || err}`;
     process.stderr.write(line + '\n');
   }
   ```
   Context format: `module.action` (e.g., `config.load`, `git.exec`, `phase.tree`).

**Key rule:** Never write debug output to stdout. Stdout is reserved for JSON output. All diagnostic output goes to stderr.

## Output Convention

**All commands produce JSON on stdout** (via `output()` from `src/lib/output.js`):
```javascript
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(filtered, null, 2);
    process.stdout.write(json);
  }
  process.exit(0);
}
```

- `--raw` flag: when `rawValue` is provided, outputs the raw string directly instead of JSON
- Large payloads (>50KB): written to a temp file, stdout gets `@file:/path/to/gsd-NNN.json`
- Temp files tracked in `_tmpFiles` array, cleaned up on process exit
- `--fields` global flag: filters JSON output to specific fields (supports dot-notation)
- `--compact` global flag: reduces output to essential fields (default behavior)
- `--verbose` global flag: full output (opt-in, overrides compact)

## Caching Strategy

**Module-level caches** — live for single CLI invocation, no TTL:
- `fileCache` (Map) in `src/lib/helpers.js` — file content cache via `cachedReadFile()`
- `dirCache` (Map) in `src/lib/helpers.js` — directory listing cache via `cachedReaddirSync()`
- `_phaseTreeCache` in `src/lib/helpers.js` — single scan of `.planning/phases/`
- `_configCache` (Map) in `src/lib/config.js` — config.json parse cache keyed by cwd
- `_fmCache` (Map, max 100) in `src/lib/frontmatter.js` — frontmatter parse cache with LRU eviction
- `_dynamicRegexCache` (Map, max 200) in `src/lib/regex-cache.js` — compiled regex cache with LRU eviction
- `_milestoneCache` in `src/lib/helpers.js` — milestone info computed once per invocation
- `_fieldRegexCache` (Map) in `src/commands/state.js` — pre-compiled field extraction regex

**Invalidation:** Call `invalidateFileCache(path)` after writing a file. Call `invalidateMilestoneCache()` after writing ROADMAP.md.

## Section Comments

Use Unicode box-drawing section dividers throughout all source files:
```javascript
// ─── Section Name ────────────────────────────────────────────────────────────
```

This is the standard section separator. Use it to divide files into logical sections (e.g., "File Helpers", "Phase Helpers", "Git Execution").

## JSDoc Comments

**Function-level JSDoc** is used selectively for complex functions:
```javascript
/**
 * Cached wrapper around safeReadFile. Returns cached content on repeated reads
 * of the same path within a single CLI invocation.
 */
function cachedReadFile(filePath) { ... }
```

**Parameter documentation** with `@param` and `@returns` for public API functions:
```javascript
/**
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
function estimateTokens(text) { ... }
```

Not required for simple command handlers (`cmd*` functions) or internal helpers.

## Function Design

**Size:** Most functions are 20-80 lines. Complex parsers (e.g., `parseIntentMd`, `getMilestoneInfo`) may reach 100-150 lines.

**Parameters:**
- First param is usually `cwd` (project root directory)
- Last param is usually `raw` (boolean, raw output flag)
- Options objects for 3+ optional params: `cmdStateRecordMetric(cwd, { phase, plan, duration, tasks, files }, raw)`

**Return values:**
- Command handlers call `output()` and exit — they don't return values
- Internal helpers return structured objects or `null` on failure
- Arrays default to `[]`, objects default to `{}`, strings default to `null`

## Module Design

**Exports:** Each module exports a flat object of named functions:
```javascript
module.exports = { cmdStateLoad, cmdStateGet, cmdStatePatch, ... };
```

**No barrel files.** Each module is imported directly by path.

**No classes.** Everything is functions and plain objects.

## Markdown Document Conventions

**Planning documents** (in `.planning/`):
- Use `**Bold Key:** Value` pattern for fields: `**Current Phase:** 03`
- Use markdown tables for structured data (decisions, metrics)
- Headings: `#` for title, `##` for major sections, `###` for subsections
- Checkbox lists: `- [ ] Incomplete`, `- [x] Complete`

**Templates** (in `templates/`):
- Use `<purpose>`, `<lifecycle>`, `<sections>`, `<size_constraint>` XML tags to document template semantics
- Templates contain both the document template (in a markdown code block) and usage instructions

**Workflows** (in `workflows/`):
- Each workflow is a self-contained markdown prompt for Claude
- Reference `gsd-tools` commands inline: `gsd-tools init execute-phase 03 --raw`
- Use `<context>`, `<required_reading>`, `<execution_context>` XML blocks for structured data injection

**YAML Frontmatter** (in PLAN.md, SUMMARY.md files):
- Custom parser in `src/lib/frontmatter.js` — NOT a full YAML parser
- Supports: key-value pairs, inline arrays `[a, b, c]`, block arrays (`- item`), 3-level nesting
- Values are always strings (no type coercion — `true` stays `"true"`, `42` stays `"42"`)
- Quoted strings with colons: `name: "Phase: Setup"` — colons in values require quotes

## Git Integration

**Shell-free git execution** via `execFileSync` in `src/lib/git.js`:
```javascript
function execGit(cwd, args) {
  const stdout = execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf-8' });
  return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
}
```

**Security:** Never interpolate user input into shell strings. Use `execFileSync` (no shell) or `sanitizeShellArg()` for the rare cases where shell is needed. Validate date strings with `isValidDateString()` before passing to git `--since` args.

## Build System

**esbuild** bundles `src/index.js` into `bin/gsd-tools.cjs`:
- Config in `build.js`: CJS format, Node 18 target, no minification
- External: Node.js built-ins only (npm deps like `tokenx` are bundled)
- Shebang handling: `stripShebangPlugin` removes source shebangs, banner adds canonical one
- Bundle budget: 700KB max, tracked in `.planning/baselines/bundle-size.json`
- Smoke test: `current-timestamp --raw` runs after every build
- The built file `bin/gsd-tools.cjs` is gitignored — always build from source

## Config Schema

Config lives at `.planning/config.json`. All keys defined in `CONFIG_SCHEMA` in `src/lib/constants.js`.
- Lookup priority: flat key -> nested path -> aliases
- `loadConfig()` in `src/lib/config.js` merges user config with schema defaults
- Use `config-migrate` command to add missing keys from schema updates

---

*Convention analysis: 2026-02-26*
