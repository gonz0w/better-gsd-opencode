# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- Source files: `kebab-case.js` — all source files use lowercase with hyphens (`src/lib/regex-cache.js`, `src/lib/codebase-intel.js`)
- Command modules: `kebab-case.js` in `src/commands/` — one file per command domain (`state.js`, `roadmap.js`, `features.js`)
- Library modules: `kebab-case.js` in `src/lib/` — shared utilities (`helpers.js`, `output.js`, `frontmatter.js`)
- Test files: same name as source with `.test.` inserted — `bin/gsd-tools.test.cjs`
- Workflow files: `kebab-case.md` in `workflows/` (`execute-phase.md`, `plan-phase.md`, `cmd-session-diff.md`)
- Template files: `kebab-case.md` in `templates/` (`summary-standard.md`, `planner-subagent-prompt.md`)
- `cmd-` prefix on workflow files for utility/diagnostic commands (`cmd-velocity.md`, `cmd-context-budget.md`)

**Functions:**
- Use `camelCase` for all functions
- Command handlers: `cmd` + PascalCase noun + action — `cmdStateLoad`, `cmdRoadmapGetPhase`, `cmdPhaseNextDecimal`, `cmdInitExecutePhase`
- Internal helpers: `camelCase` without prefix — `findPhaseInternal`, `resolveModelInternal`, `getRoadmapPhaseInternal`
- Private/cached: underscore prefix for module-level caches — `_milestoneCache`, `_phaseTreeCache`, `_fmCache`
- Lazy loaders: `lazy` + PascalCase — `lazyState()`, `lazyRoadmap()`, `lazyPhase()` (in `src/router.js`)

**Variables:**
- `camelCase` for local variables
- `UPPER_SNAKE_CASE` for module-level constants — `MODEL_PROFILES`, `CONFIG_SCHEMA`, `COMMAND_HELP`, `FM_CACHE_MAX`, `MAX_CACHE_SIZE`
- `snake_case` for JSON output keys — `phase_number`, `plan_count`, `state_path`, `commit_docs`
- Pattern: internal JS uses camelCase, external JSON API uses snake_case

**Types:**
- No TypeScript — project is plain JavaScript with JSDoc annotations
- JSDoc `@typedef` for complex structures (see `src/lib/lifecycle.js` line 16: `@typedef {Object} LifecycleNode`)
- JSDoc `@param` and `@returns` on public functions (see `src/lib/helpers.js`, `src/lib/context.js`)

## Code Style

**Formatting:**
- No formatter configured (no `.prettierrc`, `.editorconfig`, or similar)
- 2-space indentation throughout all `.js` files
- Single quotes for strings
- Semicolons required (consistent across all files)
- Trailing commas in multi-line object/array literals
- Max line length: ~120 characters (soft limit, not enforced)

**Linting:**
- No linter configured (no `.eslintrc`, `biome.json`, or similar)
- `'use strict'` directive at top of most modules (`src/router.js`, `src/commands/init.js`, `src/commands/features.js`, `src/lib/context.js`, `src/lib/deps.js`)
- Some modules omit `'use strict'` — inconsistency exists (`src/commands/state.js`, `src/commands/roadmap.js`, `src/lib/helpers.js`)

**Section Dividers:**
- Unicode box-drawing horizontal lines used as section headers throughout all source files:
  ```javascript
  // ─── Section Name ──────────────────────────────────────────────────────────
  ```
- These appear in every source file and the test file. Follow this pattern for new sections.

## Import Organization

**Order:**
1. Node.js built-ins: `require('fs')`, `require('path')`, `require('child_process')`
2. Project library modules: `require('../lib/output')`, `require('../lib/config')`
3. Project command modules (when cross-referencing): `require('./verify')`, `require('./intent')`

**Path Aliases:**
- No path aliases — all imports use relative paths
- Entry point `src/index.js` requires `./router`
- Router `src/router.js` requires `./commands/*` and `./lib/*`
- Commands require `../lib/*` for shared utilities

**Destructured Imports:**
- Always use destructuring for named exports:
  ```javascript
  const { output, error, debugLog } = require('../lib/output');
  const { loadConfig } = require('../lib/config');
  const { safeReadFile, cachedReadFile, findPhaseInternal } = require('../lib/helpers');
  ```

**Lazy Loading Pattern:**
- Router uses lazy-loaded command modules for startup performance:
  ```javascript
  const _modules = {};
  function lazyState() { return _modules.state || (_modules.state = require('./commands/state')); }
  ```
- Each command module is loaded on first use, not at startup (`src/router.js` lines 10-24)

## Error Handling

**Patterns:**

1. **Try-catch with graceful degradation** — Primary pattern across all commands:
   ```javascript
   try {
     const content = cachedReadFile(filePath);
     if (!content) return null;
     // ... parse content
   } catch (e) {
     debugLog('context.label', 'human-readable message', e);
     return null;  // or return default value
   }
   ```

2. **`error()` for fatal CLI errors** — Writes to stderr and calls `process.exit(1)`:
   ```javascript
   if (!command) {
     error('Usage: gsd-tools <command> [args]');
   }
   ```

3. **JSON error responses** — Commands return error objects in JSON, not process exits:
   ```javascript
   output({ error: 'STATE.md not found' }, raw);
   output({ found: false, error: 'ROADMAP.md not found' }, raw, '');
   ```

4. **`safeReadFile()`** — Returns `null` on any read error instead of throwing (`src/lib/helpers.js` line 16)

5. **Debug logging via `debugLog()`** — Only emits when `GSD_DEBUG=1` environment variable set:
   ```javascript
   debugLog('git.exec', 'exec failed', err);
   ```
   Format: `[GSD_DEBUG] context.subcontext: message | error.message`

**Guidelines:**
- Never let uncaught exceptions propagate — every external operation (fs, git, parse) is wrapped in try-catch
- Return structured error objects in JSON output, don't throw
- Use `debugLog()` in catch blocks for diagnosability without polluting stdout
- Separate error channel: debug goes to stderr, JSON output goes to stdout

## Logging

**Framework:** Custom `debugLog()` function in `src/lib/output.js`

**Patterns:**
- Gate all debug output behind `GSD_DEBUG` environment variable
- Context strings use `domain.action` format: `'file.read'`, `'git.exec'`, `'config.load'`, `'milestone.info'`
- Debug output goes to stderr to never contaminate JSON stdout
- No log levels — either debug is on or off

## Comments

**When to Comment:**
- Section dividers with box-drawing characters for major code sections
- JSDoc on public/exported functions with `@param` and `@returns`
- Inline comments for non-obvious logic or strategies:
  ```javascript
  // Strategy 1: Look for active milestone marker (blue circle or "(active)")
  // Strategy 2: Look for "(active)" tag on a milestone line
  ```
- Pre-compiled regex patterns get descriptive comments:
  ```javascript
  /** Match phase header in ROADMAP.md: "## Phase N: Name" or "### Phase N: Name" */
  const PHASE_HEADER = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
  ```

**JSDoc/TSDoc:**
- Used on library functions and complex helpers
- Full `@typedef` blocks for complex data structures (`LifecycleNode` in `src/lib/lifecycle.js`)
- `@param {string} cwd - Project root` style parameter documentation
- `@returns {{ tokens: number, percent: number, warning: boolean }}` for return types

## Function Design

**Size:**
- Command handler functions: 20-100 lines typical
- Complex commands (e.g., `cmdInitProgress`): up to ~200 lines
- Helper functions: 5-30 lines
- Library files: 100-700 lines each; command files: 300-2000 lines each

**Parameters:**
- `(cwd, ...specificArgs, raw)` — Standard command handler signature
- `cwd` is always first parameter (project working directory)
- `raw` is always last parameter (controls output format)
- Named options use an object parameter for complex commands:
  ```javascript
  function cmdStateRecordMetric(cwd, { phase, plan, duration, tasks, files }, raw)
  ```

**Return Values:**
- Command handlers don't return — they call `output()` which exits the process
- Internal helpers return values (objects, arrays, null for not-found)
- `null` is the standard "not found" / "error" return value

## Module Design

**Exports:**
- Each module exports an object with named functions at the bottom:
  ```javascript
  module.exports = { cmdStateLoad, cmdStateGet, cmdStateUpdate, ... };
  ```
- Library modules export utility functions
- Command modules export `cmd*` handler functions

**Barrel Files:**
- No barrel/index files for re-exporting
- Each module imported directly by path

**Module Organization:**
- `src/lib/` — Pure utility functions, no CLI I/O
- `src/commands/` — CLI command handlers, call `output()` or `error()`
- `src/router.js` — Central switch/case dispatcher, lazy-loads commands
- `src/index.js` — Entry point, just calls `main()`

## Output Pattern

**Dual-mode output** — Every command supports two output modes via `raw` parameter:
```javascript
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));  // Plain text for --raw
  } else {
    process.stdout.write(JSON.stringify(filtered, null, 2));  // JSON default
  }
  process.exit(0);
}
```

**Large payload handling** — JSON output > 50KB written to temp file, path returned as `@file:/tmp/gsd-*.json`

**Global flags parsed in router** — `--raw`, `--fields`, `--verbose`, `--compact`, `--manifest` are stripped from args before routing

**Field filtering** — `--fields field1,field2` filters JSON output to requested keys only. Supports dot-notation (`phases.status`).

## Caching Strategy

**Module-level caches** — All caches live for single CLI invocation (process lifetime):
- `fileCache` (Map) — File content cache in `src/lib/helpers.js`
- `dirCache` (Map) — Directory listing cache in `src/lib/helpers.js`
- `_configCache` (Map) — Config.json parse cache in `src/lib/config.js`
- `_fmCache` (Map) — Frontmatter parse cache in `src/lib/frontmatter.js` (LRU, max 100)
- `_dynamicRegexCache` (Map) — Regex compilation cache in `src/lib/regex-cache.js` (LRU, max 200)
- `_phaseTreeCache` — Full phase directory tree in `src/lib/helpers.js`
- `_milestoneCache` — Milestone info in `src/lib/helpers.js`
- `_fieldRegexCache` (Map) — Pre-compiled STATE.md field regexes in `src/commands/state.js`

**Pattern:** Check cache → compute → store → return. Call `invalidateFileCache()` / `invalidateMilestoneCache()` after writes.

## Workflow File Conventions

**Structure pattern** — All workflow `.md` files follow this XML-tagged structure:
```markdown
<purpose>
One-line description of what this workflow does.
</purpose>

<required_reading>
Files to read before starting.
</required_reading>

<process>
<step name="stepname" priority="first">
Step instructions with code blocks for gsd-tools calls.
</step>
</process>
```

**CLI invocations in workflows** use absolute paths to the installed binary:
```bash
INIT=$(node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs init execute-phase "${PHASE_ARG}" --compact)
```

**Subagent spawning** uses `Task()` syntax with model parameters from init JSON.

## Template File Conventions

**Template files** in `templates/` are reference documents wrapped in markdown code blocks:
- Contain `## File Template` section with the actual template in a code block
- Include guidance sections explaining when/how to use the template
- Placeholder values use `[bracket notation]`: `[Phase name]`, `[YYYY-MM-DD]`
- Templates may include multiple variants (e.g., `templates/roadmap.md` has greenfield and new-milestone variants)

---

*Convention analysis: 2026-02-26*
