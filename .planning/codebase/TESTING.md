# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:** Node.js built-in test runner (`node:test`)
- Config: No separate config file; CLI flags in `package.json` scripts
- Version: Built into Node.js 18+ (project requires `node >= 18`)

**Assertion Library:** Node.js built-in `assert` module
```javascript
const assert = require('node:assert');
assert.strictEqual(actual, expected, 'message');
assert.ok(condition, 'message');
assert.deepStrictEqual(actual, expected);
```

**Run Commands:**
```bash
npm test              # Run all tests with concurrency=8, force-exit
npm run test:fast     # Fast subset (core functionality)
npm run test:slow     # Slow subset (integration-heavy tests)
npm run test:file     # Run specific file: node --test --test-force-exit <file>
```

## Test File Organization

**Location:** Separate `/tests/` directory, not co-located with source files
- Source: `src/lib/db.js` → Test: `tests/db.test.cjs`
- CLI tools tests: `tests/cli-tools.test.cjs`, `tests/cli-tools-integration.test.cjs`
- Integration tests: `tests/integration.test.cjs`, `tests/infra.test.cjs`

**Naming:** `*.test.cjs` pattern (e.g., `agent.test.cjs`, `codebase.test.cjs`)

## Test Structure

**Suite Organization:**
```javascript
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('suite name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('nested suite', () => {
    test('describes behavior', () => {
      assert.ok(true);
    });
  });
});
```

**Test file example:** `tests/cli-tools.test.cjs` (734 lines)
- Top-level JSDoc comment describing scope
- Nested `describe()` blocks for logical grouping
- `beforeEach`/`afterEach` for per-test setup/cleanup

## Mocking

**Framework:** No mocking framework; uses test helpers and fixtures
- Test isolation via temporary directories (`fs.mkdtempSync()`)
- File system manipulation for testing file-based logic
- Child process spawning with controlled input/output

**What to Mock:**
- External CLI tools (ripgrep, fd, git, jj) — use `spawnSync`/`execSync` with mocked environments
- File system operations — use temp directories and cleanup

**What NOT to Mock:**
- Core bgsd-tools logic — test actual behavior via CLI invocation
- Git/jj operations — verify real tool interaction in integration tests

## Fixtures and Factories

**Test Data:** Inline fixtures and helper functions
- `STATE_FIXTURE` constant: predefined STATE.md content (393 lines in `tests/helpers.cjs`)
- Helper functions for project setup:
  ```javascript
  function createTempProject() {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    return tmpDir;
  }

  function createParityProject(opts) {
    // Creates deterministic test project with git init and .gitignore rules
  }
  ```

**Location:** `tests/helpers.cjs` (393 lines) — shared test utilities
- `runGsdTools()`: CLI invocation wrapper
- `snapshotCompare()`: JSON output comparison against fixtures
- `contractCheck()`: Field-level schema validation

## Coverage

**Requirements:** No coverage enforcement detected
- Test suite runs 762+ tests across 84 `.test.cjs` files
- Coverage reporting not configured in test scripts

## Test Types

**Unit Tests:**
- Scope: Individual functions and modules
- Approach: Direct function calls with mocked inputs
- Example: `tests/cli-tools.test.cjs` — detector.js, guidance.js unit tests
  ```javascript
  describe('detector.js — detectTool()', () => {
    test('returns object with available (boolean), name, description', () => {
      const result = detector.detectTool('ripgrep');
      assert.ok(typeof result === 'object', 'result should be object');
      assert.ok(typeof result.available === 'boolean', ...);
    });
  });
  ```

**Integration Tests:**
- Scope: CLI tool behavior, git/jj interactions, file system operations
- Approach: Full CLI invocation via `runGsdTools()`, temp project setup
- Example: `tests/codebase.test.cjs` — tests codebase intelligence commands
  - Uses `createCodebaseProject()` to set up test environment
  - Verifies JSON output schema and field values

**E2E Tests:**
- Not explicitly separated; integration tests cover end-to-end CLI workflows
- Full command execution with real tools (git, jj, ripgrep) in controlled environments

---

*Testing analysis: 2026-04-06*
