# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- Source files: `.cjs` extension for CommonJS modules (e.g., `src/lib/db.js`, `bin/bgsd-tools.cjs`)
- Test files: `*.test.cjs` pattern, co-located with source or in `/tests/` directory
- Configuration: `.config.*` suffix (e.g., `eslint.config.cjs`)

**Functions:**
- camelCase for functions and variables (observed throughout codebase)
  - Example: `detectNamingConventions()`, `runGsdTools()`, `classifyName()` in `src/lib/conventions.js`

**Variables:**
- camelCase for regular variables
- UPPER_SNAKE_CASE for constants (e.g., `TOOLS_PATH`, `STATE_FIXTURE`)

**Types/Classes:**
- PascalCase for constructor functions and types (observed pattern)

## Code Style

**Formatting:**
- No Prettier configuration detected
- Manual formatting conventions observed:
  - 2-space indentation
  - Semicolons required
  - Single quotes for strings (`'use strict'`, `'module'`)

**Linting:**
- ESLint v9+ flat config format (`.config.cjs` pattern)
- Config file: `eslint.config.cjs`
- Active rules:
  ```javascript
  'no-unreachable': 'error',
  'no-else-return': 'warn',
  'no-useless-return': 'warn'
  ```

## Import Organization

**Order:**
1. `'use strict';` directive (top of file)
2. `require()` statements grouped by purpose
3. Module-level constants and classifiers
4. Function definitions

**Path Aliases:**
- No path aliases detected; uses relative paths (`./lib/db`, `../src/lib`)

## Error Handling

**Patterns:**
- Try/catch blocks for async operations and file I/O:
  ```javascript
  try {
    const result = execSync('jj --version', { cwd, stdio: 'pipe' });
    return { success: true, output: result.trim() };
  } catch (err) {
    return { success: false, error: err.message };
  }
  ```
- Return objects with `success` boolean and either `output` or `error`:
  - Success: `{ success: true, output: 'result' }`
  - Failure: `{ success: false, error: 'message', exitCode: number }`
- Explicit error messages in return objects for CLI tools

## Logging

**Framework:**
- No logging framework detected; uses `console.log()` and `console.error()` sparingly
- CLI output via `process.stdout.write()` and `process.stderr.write()`

**Patterns:**
- Minimal logging in production code
- Debug logging gated by environment or flags (e.g., `--debug`)
- Error messages include context: file paths, command names, exit codes

## Comments

**When to Comment:**
- Module-level JSDoc-style comments for public APIs and complex logic
- Inline comments for non-obvious decisions or workarounds
- Section headers using ASCII dividers (`// ─── SECTION NAME ─────────────`)

**JSDoc/TSDoc:**
- Used for function documentation:
  ```javascript
  /**
   * Classify a filename (without extension) into a naming pattern.
   *
   * @param {string} name - Filename without extension
   * @returns {string} Pattern name or 'single-word' or 'mixed'
   */
  function classifyName(name) { ... }
  ```

## Function Design

**Size:**
- Functions typically 20-100 lines
- Single responsibility: helper functions are small and focused (e.g., `isSourceFile()`, `hasJj()`)

**Parameters:**
- Named parameters for clarity
- Options object pattern for optional arguments:
  ```javascript
  function initColocatedCommitRepo(tmpDir, options = {}) {
    const { detachHead = false } = options;
    ...
  }
  ```

**Return Values:**
- Consistent return objects with `success` boolean
- Promise-based async functions (e.g., in router.js)
- Synchronous returns for utility functions

## Module Design

**Exports:**
- CommonJS: `module.exports = { func1, func2 }` or `module.exports = function()`
- Barrel files not used; explicit imports from specific paths

**Barrel Files:**
- No barrel files detected; direct imports from source files (e.g., `require('./lib/db')`)

---

*Convention analysis: 2026-04-06*
