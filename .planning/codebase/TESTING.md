# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`) — no external test framework
- Config: None (no `jest.config.*`, `vitest.config.*`, etc.)
- Node.js >= 18 required (built-in test runner)

**Assertion Library:**
- `node:assert` (strict mode: `assert.strictEqual`, `assert.deepStrictEqual`)

**Run Commands:**
```bash
npm test                    # Run all tests: node --test bin/gsd-tools.test.cjs
node --test bin/gsd-tools.test.cjs   # Direct invocation
```

No watch mode configured. No coverage tool configured.

## Test File Organization

**Location:**
- Single test file co-located with build output: `bin/gsd-tools.test.cjs`
- 3,948+ lines, ~13,040 lines total
- Tests the built artifact directly (integration tests against the CLI)

**Naming:**
- `bin/gsd-tools.test.cjs` — matches the convention `<name>.test.cjs`

**No unit test files** for individual source modules. All testing is done through CLI integration tests.

## Test Structure

**Suite Organization:**
```javascript
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('command-name command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('descriptive test name', () => {
    // Setup: write files to tmpDir
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);

    // Execute: run CLI command
    const result = runGsdTools('roadmap get-phase 1', tmpDir);

    // Assert
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase should be found');
  });
});
```

**Section separators** between describe blocks:
```javascript
// ─────────────────────────────────────────────────────────────────────────────
// command-name command
// ─────────────────────────────────────────────────────────────────────────────
```

## Test Helpers

**CLI runner** — executes the built artifact as a subprocess:
```javascript
const TOOLS_PATH = path.join(__dirname, 'gsd-tools.cjs');

function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}
```

**Temp project factory** — creates isolated `.planning/phases/` directory:
```javascript
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

**State fixture** — reusable STATE.md content for state mutation tests:
```javascript
const STATE_FIXTURE = `# Project State
## Current Position
**Phase:** 1 of 3 (Foundation)
**Current Plan:** 1
...`;

function writeStateFixture(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), STATE_FIXTURE);
}
```

**stderr capture** — for testing debug output and --help:
```javascript
function runWithStderr(args, opts = {}) {
  const { spawnSync } = require('child_process');
  const result = spawnSync('node', [TOOLS_PATH, ...args.split(/\s+/)], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf-8',
    env: { ...process.env, ...opts.env },
  });
  return { success: result.status === 0, stdout: ..., stderr: ... };
}
```

## Test Categories

The test file covers these command groups (each is a `describe` block):

| Describe Block | Tests | What's Tested |
|---|---|---|
| `history-digest command` | 6 | SUMMARY.md frontmatter parsing, nested fields, multiple phases, malformed files |
| `phases list command` | 5 | Phase directory listing, sorting, filtering by type/phase |
| `roadmap get-phase command` | 7 | Phase extraction, decimal phases, missing ROADMAP, header depths, malformed roadmaps |
| `phase next-decimal command` | 5 | Decimal phase number calculation, gaps, normalization |
| `phase-plan-index command` | 5 | Plan indexing, wave grouping, frontmatter extraction, checkpoint detection |
| `state-snapshot command` | 5 | STATE.md parsing, fields, decisions table, blockers, session info |
| `summary-extract command` | 4 | SUMMARY.md field extraction, --fields filtering, missing fields |
| `init commands` | 15+ | File path resolution, --compact output, --manifest mode, size reduction verification |
| `roadmap analyze command` | 3 | Full roadmap parsing, disk status detection, goal extraction |
| `phase add command` | 2 | Adding phases, directory creation, ROADMAP update |
| `phase insert command` | 5 | Decimal phase insertion, sibling detection, padding handling |
| `phase remove command` | 4 | Phase removal, renumbering, --force flag, decimal removal |
| `phase complete command` | 6 | Phase completion, state transition, REQUIREMENTS.md update, bracket format |
| `milestone complete command` | 2 | Milestone archival, MILESTONES.md creation/append |
| `validate consistency command` | 3 | Consistency checking, orphan detection, gap detection |
| `progress command` | 3 | JSON/bar/table output formats |
| `todo complete command` | 2 | Todo file movement, completion timestamp |
| `scaffold command` | 5 | Context/UAT/verification scaffolding, phase-dir creation, no-overwrite |
| `state update command` | 3 | Single field mutation, complex values, nonexistent fields |
| `state patch command` | 2 | Multi-field atomic update, failed fields |
| `state add-decision command` | 3 | Decision appending, placeholder removal, missing section |
| `state add-blocker command` | 2 | Blocker appending, placeholder removal |
| `state resolve-blocker command` | 3 | Blocker removal, "None" placeholder restoration |
| `state record-session command` | 2 | Session field updates |
| `state advance-plan command` | 3 | Plan advancement, last-plan detection, activity date update |
| `state record-metric command` | 3 | Metric table appending, required field validation |
| `frontmatter round-trip` | 7 | Semantic lossless round-trips for all frontmatter patterns |
| `frontmatter edge cases` | 7 | Real PLAN.md format, array objects, YAML special values, additive/update merge |
| `debug logging` | 4 | GSD_DEBUG env var, stderr isolation, context format |
| `shell sanitization` | 5 | Date injection prevention, backtick/subshell rejection, --fixed-strings |
| `temp file cleanup` | 4 | Exit handler registration, _tmpFiles tracking, cleanup verification |
| `--help flag` | 4 | Help text output, stderr routing, command coverage |
| `config-migrate command` | 5 | Key migration, no-overwrite, backup creation, already-complete detection |
| `build system` | 5+ | Build success, output file verification, shebang, smoke tests, timing |

## Mocking

**Framework:** None — no mocking library.

**Approach:** Tests are integration tests that spawn the CLI as a subprocess. No mocking of internal modules. Instead:

1. **Filesystem mocking** — create temp directories with specific file structures, then run CLI against them
2. **Environment mocking** — pass env vars via `runWithStderr()`:
   ```javascript
   runWithStderr('init progress --raw', {
     env: { ...process.env, GSD_DEBUG: '1' },
   });
   ```
3. **Git repo mocking** — init a temporary git repo:
   ```javascript
   function initGitRepo(dir) {
     execSync('git init && git -c user.name=Test -c user.email=test@test.com add . && git commit ...', { cwd: dir });
   }
   ```

**What NOT to mock:**
- The CLI binary itself — always test the actual built artifact
- File system — use real temp directories
- Git — use real git repos for commands that need them

## Fixtures and Factories

**Test Data:**
- Inline file content written in test setup (no separate fixture files)
- ROADMAP.md, STATE.md, SUMMARY.md content constructed per-test
- `STATE_FIXTURE` constant for reusable state document

**Location:**
- All fixtures inline in `bin/gsd-tools.test.cjs`
- No `__fixtures__/` or `test/` directory

**Pattern — frontmatter round-trip assertion:**
```javascript
function assertSemanticRoundTrip(filePath, description) {
  const resultA = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
  const jsonA = JSON.parse(resultA.output);
  const dataStr = JSON.stringify(jsonA);
  runGsdTools(`frontmatter merge ${filePath} --data '${dataStr}' --raw`, tmpDir);
  const resultB = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
  const jsonB = JSON.parse(resultB.output);
  assert.deepStrictEqual(jsonA, jsonB, `Semantic round-trip failed for ${description}`);
  return jsonA;
}
```

## Coverage

**Requirements:** None enforced. No coverage tool configured.

**View Coverage:** Not available. Consider adding:
```bash
node --test --experimental-test-coverage bin/gsd-tools.test.cjs
```

**Self-coverage tracking:** The `test-coverage` command in `src/commands/features.js` analyzes test file invocations against router commands:
```bash
node bin/gsd-tools.cjs test-coverage --raw
```
This detects which CLI commands have corresponding test cases by scanning for `runGsdTools('command ...')` patterns.

## Test Types

**Unit Tests:**
- Not present. No per-module unit tests.

**Integration Tests:**
- **All tests are integration tests.** They spawn the CLI as a child process, pass arguments, and assert on JSON output.
- Each test creates an isolated temp directory with specific file structures.
- Tests verify both successful operations and error handling paths.

**E2E Tests:**
- Not used as a separate category, but the integration tests effectively test end-to-end CLI behavior.

**Build Tests:**
- Dedicated `describe('build system')` block verifies:
  - `npm run build` succeeds
  - Output file exists and has correct shebang
  - Built artifact executes correctly
  - Build completes in under 500ms
  - Bundle size is within 700KB budget

**Security Tests:**
- `describe('shell sanitization')` block verifies:
  - Date injection prevention (semicolons, backticks, `$()`)
  - `--fixed-strings` for grep patterns
  - Date validation rejects non-date strings

## Common Patterns

**Async Testing:**
- Not needed — all tests are synchronous (CLI subprocess with `execSync`)

**Error Testing:**
```javascript
test('rejects removal of phase with summaries unless --force', () => {
  // Setup completed phase
  fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

  // Should fail without --force
  const result = runGsdTools('phase remove 1', tmpDir);
  assert.ok(!result.success, 'should fail without --force');
  assert.ok(result.error.includes('executed plan'), 'error mentions executed plans');

  // Should succeed with --force
  const forceResult = runGsdTools('phase remove 1 --force', tmpDir);
  assert.ok(forceResult.success, `Force remove failed: ${forceResult.error}`);
});
```

**Mutation round-trip testing:**
```javascript
test('updates a single field (Status)', () => {
  const result = runGsdTools('state update Status Complete', tmpDir);
  assert.ok(result.success);

  const output = JSON.parse(result.output);
  assert.strictEqual(output.updated, true);

  // Verify disk state
  const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
  assert.ok(content.includes('**Status:** Complete'));
});
```

**Size regression testing:**
```javascript
test('compact default reduces init output size by at least 38% vs --verbose', () => {
  const commands = ['init progress', 'init execute-phase 03', ...];
  const reductions = [];
  for (const cmd of commands) {
    const full = runGsdTools(`${cmd} --verbose --raw`, tmpDir);
    const compact = runGsdTools(`${cmd} --raw`, tmpDir);
    const reduction = (1 - Buffer.byteLength(compact.output) / Buffer.byteLength(full.output)) * 100;
    reductions.push({ cmd, reduction });
  }
  const avgReduction = reductions.reduce((sum, r) => sum + r.reduction, 0) / reductions.length;
  assert.ok(avgReduction >= 38, `Expected >=38% reduction, got ${avgReduction.toFixed(1)}%`);
});
```

## Adding New Tests

**For a new CLI command:**
1. Add a `describe('command-name command')` block in `bin/gsd-tools.test.cjs`
2. Use section separator comments above the block
3. Use `beforeEach`/`afterEach` with `createTempProject()`/`cleanup()`
4. Set up file structures in each test, run via `runGsdTools()`, assert JSON output
5. Test both success and error paths
6. For state-mutating commands, verify both JSON output AND disk state after mutation

**For testing a new source module:**
- No per-module unit test pattern exists. Test through CLI integration.
- If unit tests are added, create `src/lib/<module>.test.js` and add to `package.json` scripts.

## Smoke Tests

**Build-time smoke test** (in `build.js`):
```javascript
const result = execSync('node bin/gsd-tools.cjs current-timestamp --raw', { timeout: 5000 });
console.log(`Smoke test passed: ${result.trim()}`);
```

**Deploy-time smoke test** (in `deploy.sh`):
```bash
SMOKE=$(node "$DEST/bin/gsd-tools.cjs" current-timestamp --raw 2>/dev/null) || true
if [ -z "$SMOKE" ]; then
  echo "Smoke test FAILED — rolling back..."
  rm -rf "$DEST" && mv "$BACKUP" "$DEST"
  exit 1
fi
```

Both use `current-timestamp --raw` as the canonical smoke test because it:
- Has no dependencies (no `.planning/` directory needed)
- Exercises the full module loading pipeline
- Returns a deterministic format (ISO timestamp)
- Completes in <100ms

---

*Testing analysis: 2026-02-26*
