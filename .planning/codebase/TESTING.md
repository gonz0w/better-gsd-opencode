# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`) — no external test framework
- Config: None — test runner is configured via `package.json` scripts only
- Requires Node.js >= 18 (`package.json` engines field)

**Assertion Library:**
- `node:assert` (built-in strict assertions)
- Primary methods: `assert.ok()`, `assert.strictEqual()`, `assert.deepStrictEqual()`, `assert.doesNotThrow()`, `assert.match()`

**Run Commands:**
```bash
npm test                   # Run all tests (node --test bin/gsd-tools.test.cjs)
node --test bin/gsd-tools.test.cjs  # Direct invocation
npm run build              # Build includes smoke test (current-timestamp --raw)
```

## Test File Organization

**Location:**
- Single test file: `bin/gsd-tools.test.cjs` (~3,900 lines, ~13,700 total including all test groups)
- Co-located with the build output (`bin/gsd-tools.cjs`) — tests run against the built artifact
- No separate test directory, no test fixtures directory

**Naming:**
- `gsd-tools.test.cjs` — matches source name with `.test.` inserted
- Uses `.cjs` extension (CommonJS) to match the bundled output format

**Structure:**
```
bin/
├── gsd-tools.cjs          # Built artifact (esbuild bundle from src/)
└── gsd-tools.test.cjs     # Integration tests (run against built artifact)
```

## Test Structure

**Suite Organization:**
```javascript
describe('command-name command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();      // Create temp dir with .planning/phases/
  });

  afterEach(() => {
    cleanup(tmpDir);                    // Remove temp dir
  });

  test('descriptive behavior statement', () => {
    // Setup: Write fixture files
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);
    
    // Execute: Run CLI command
    const result = runGsdTools('command args', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    
    // Assert: Parse JSON and check values
    const output = JSON.parse(result.output);
    assert.strictEqual(output.field, expected, 'descriptive message');
  });
});
```

**Patterns:**
- **Setup:** `beforeEach` creates temp project, `afterEach` cleans up. All tests get isolated temp directories.
- **Teardown:** `cleanup(tmpDir)` using `fs.rmSync(tmpDir, { recursive: true, force: true })`
- **Assertion messages:** Every assertion includes a descriptive string explaining what should be true
- **Test isolation:** Each test writes its own fixture files; no shared mutable state between tests
- **Section dividers:** Unicode box-drawing lines between `describe` blocks (matching source convention)

**Test Naming Convention:**
- Start with verb describing the behavior: `'extracts...'`, `'returns...'`, `'handles...'`, `'rejects...'`
- Include edge case description: `'handles decimal phases in sort order'`, `'malformed SUMMARY.md skipped gracefully'`
- Backward compatibility tests explicitly named: `'flat provides field still works (backward compatibility)'`

## Test Helper Functions

**`runGsdTools(args, cwd)`** — Primary test helper (`bin/gsd-tools.test.cjs` line 14):
```javascript
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
- Runs the CLI as a subprocess (integration test approach)
- Returns `{ success, output, error }` — never throws
- Tests parse `output` as JSON to validate structured responses

**`createTempProject()`** — Creates isolated temp directory with `.planning/phases/` structure (line 32)

**`cleanup(tmpDir)`** — Recursive delete of temp directory (line 38)

**`writeStateFixture(tmpDir)`** — Writes a standard STATE.md fixture for mutation tests (line 2611)

**`assertSemanticRoundTrip(filePath, description)`** — Tests frontmatter extract→merge→extract stability (line 3016)

**`runWithStderr(args, opts)`** — Captures both stdout and stderr separately using `spawnSync` (line 3392)

**`runGsdToolsFull(args, cwd)`** — Variant that returns both stdout/stderr for `--help` tests (line 3637)

**`initGitRepo(dir)`** — Initialize git repo in temp dir for commands that need git history (line 3489)

## Mocking

**Framework:** None — no mocking framework used

**Approach:**
- Tests are **full integration tests** — they run the actual CLI binary as a subprocess
- File system is the "mock" — each test creates real files in a temp directory
- Git commands tested by initializing real git repos in temp dirs (`initGitRepo()`)
- No function-level mocking, no dependency injection, no stubs

**What to Mock:** Nothing — the testing philosophy is "test the actual binary"

**What NOT to Mock:**
- File system operations (use real temp directories)
- Git operations (use real git repos)
- JSON parsing (test actual CLI output)
- Process exit codes (test via `execSync` success/failure)

## Fixtures and Factories

**Test Data:**
- Fixtures are created inline within each test — no external fixture files
- Standard patterns for common document types:

```javascript
// ROADMAP.md fixture
fs.writeFileSync(
  path.join(tmpDir, '.planning', 'ROADMAP.md'),
  `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Set up infrastructure\n`
);

// STATE.md fixture (reusable via writeStateFixture)
const STATE_FIXTURE = `# Project State\n\n## Current Position\n\n**Phase:** 1 of 3 (Foundation)\n...`;

// SUMMARY.md with frontmatter
fs.writeFileSync(
  path.join(phaseDir, '01-01-SUMMARY.md'),
  `---\nphase: "01"\nname: "Foundation Setup"\nprovides:\n  - "Database schema"\n---\n\n# Summary content\n`
);

// PLAN.md with frontmatter
fs.writeFileSync(
  path.join(phaseDir, '03-01-PLAN.md'),
  `---\nwave: 1\nautonomous: true\nobjective: Set up database schema\n---\n\n## Task 1: Create schema\n`
);
```

**Location:**
- All inline in test file
- `STATE_FIXTURE` constant defined at line 2568 and reused across state mutation test suites
- Phase directory structures created with `fs.mkdirSync(..., { recursive: true })`

## Coverage

**Requirements:** No formal coverage target enforced

**Built-in coverage tracking:**
- `gsd-tools test-coverage` command analyzes test coverage by comparing test invocations against router commands
- Detects tested commands via `runGsdTools('command ...')` patterns in test file
- Reports: `{ total_commands, commands_with_tests, coverage_percent, covered, uncovered }`

**View Coverage:**
```bash
node bin/gsd-tools.cjs test-coverage --raw   # Structural coverage analysis
```

**No Istanbul/c8:** No code coverage instrumentation tool configured. Coverage is structural (which commands have tests) not line-level.

## Test Types

**Integration Tests (Primary — 100% of test suite):**
- All tests run the CLI binary as a subprocess via `execSync`/`spawnSync`
- Test the full pipeline: argument parsing → routing → command execution → JSON output
- File system side effects verified by reading back files after commands
- ~3,900+ lines of integration tests covering 25+ command groups

**Unit Tests:**
- None — no isolated function-level unit tests
- All testing happens at the CLI integration boundary

**E2E Tests:**
- Not applicable — this is a CLI tool, integration tests serve as E2E

**Build System Tests:**
- `describe('build system')` block tests the esbuild pipeline (line 3818):
  - `npm run build` succeeds
  - Output has correct shebang
  - Smoke test passes
  - Build completes under 500ms
  - Bundle size within budget (1000KB)

## Common Patterns

**Async Testing:**
- Not applicable — all commands are synchronous (`execSync` based)
- No async/await patterns in tests

**Error Testing:**
```javascript
test('returns error for missing phase', () => {
  const result = runGsdTools('roadmap get-phase 5', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);

  const output = JSON.parse(result.output);
  assert.strictEqual(output.found, false, 'phase should not be found');
});

test('rejects removal of phase with summaries unless --force', () => {
  // Setup: create phase with summary files...
  
  // Should fail without --force
  const result = runGsdTools('phase remove 1', tmpDir);
  assert.ok(!result.success, 'should fail without --force');
  assert.ok(result.error.includes('executed plan'), 'error mentions executed plans');

  // Should succeed with --force
  const forceResult = runGsdTools('phase remove 1 --force', tmpDir);
  assert.ok(forceResult.success, `Force remove failed: ${forceResult.error}`);
});
```

**Mutation Round-Trip Testing:**
```javascript
// Pattern: Write → Execute Command → Read Back → Assert
test('updates a single field (Status)', () => {
  const result = runGsdTools('state update Status Complete', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);

  const output = JSON.parse(result.output);
  assert.strictEqual(output.updated, true);

  const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
  assert.ok(content.includes('**Status:** Complete'), 'STATE.md should contain updated value');
});
```

**Semantic Round-Trip Testing (Frontmatter):**
```javascript
// Pattern: Extract A → Merge A back → Extract B → Assert A === B
function assertSemanticRoundTrip(filePath, description) {
  const resultA = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
  const jsonA = JSON.parse(resultA.output);

  const dataStr = JSON.stringify(jsonA);
  runGsdTools(`frontmatter merge ${filePath} --data '${dataStr}' --raw`, tmpDir);

  const resultB = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
  const jsonB = JSON.parse(resultB.output);

  assert.deepStrictEqual(jsonA, jsonB, `Semantic round-trip failed for ${description}`);
}
```

**Security Testing:**
```javascript
// Shell injection prevention
test('session-diff rejects backtick injection in date', () => {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    '# Project State\n\n**Last Activity:** `whoami`\n'
  );
  initGitRepo(tmpDir);
  const result = runGsdTools('session-diff', tmpDir);
  const output = JSON.parse(result.output);
  assert.ok(output.error, 'Backtick date should be rejected');
});
```

**Performance Testing:**
```javascript
test('compact default reduces init output size by at least 38% vs --verbose', () => {
  const commands = ['init progress', 'init execute-phase 03', ...];
  const reductions = [];
  for (const cmd of commands) {
    const full = runGsdTools(`${cmd} --verbose --raw`, tmpDir);
    const compact = runGsdTools(`${cmd} --raw`, tmpDir);
    const reduction = (1 - compact.output.length / full.output.length) * 100;
    reductions.push(reduction);
  }
  const avgReduction = reductions.reduce((sum, r) => sum + r, 0) / reductions.length;
  assert.ok(avgReduction >= 38, `Expected >=38% reduction, got ${avgReduction.toFixed(1)}%`);
});
```

## Test Suite Organization

**Describe blocks** (in order within `bin/gsd-tools.test.cjs`):
1. `history-digest command` — SUMMARY.md aggregation
2. `phases list command` — Phase directory listing
3. `roadmap get-phase command` — Roadmap section extraction
4. `phase next-decimal command` — Decimal phase numbering
5. `phase-plan-index command` — Plan indexing with waves
6. `state-snapshot command` — STATE.md parsing
7. `summary-extract command` — SUMMARY.md field extraction
8. `init commands` — All init workflow commands + compact/manifest flags
9. `roadmap analyze command` — Full roadmap analysis
10. `phase add command` — Adding phases to roadmap
11. `phase insert command` — Inserting decimal phases
12. `phase remove command` — Removing phases with renumbering
13. `phase complete command` — Phase completion + requirements update
14. `milestone complete command` — Milestone archival
15. `validate consistency command` — Cross-document validation
16. `progress command` — Progress rendering (JSON/table/bar)
17. `todo complete command` — Todo lifecycle
18. `scaffold command` — Template scaffolding
19. `state update command` — Single field mutation
20. `state patch command` — Multi-field mutation
21. `state add-decision command` — Decision appending
22. `state add-blocker command` — Blocker management
23. `state resolve-blocker command` — Blocker resolution
24. `state record-session command` — Session continuity
25. `state advance-plan command` — Plan counter advancement
26. `state record-metric command` — Performance metrics
27. `frontmatter round-trip` — Lossless frontmatter serialization
28. `frontmatter edge cases` — Complex YAML patterns
29. `debug logging` — GSD_DEBUG environment variable
30. `shell sanitization` — Input injection prevention
31. `temp file cleanup` — Process exit cleanup
32. `--help flag` — Help text system
33. `config-migrate command` — Config migration
34. `build system` — Build pipeline tests

## Adding New Tests

**For a new CLI command:**
1. Add a `describe` block at the end of `bin/gsd-tools.test.cjs`
2. Use the standard `beforeEach`/`afterEach` temp directory pattern
3. Use `runGsdTools('new-command args', tmpDir)` to invoke
4. Parse JSON output and assert on fields
5. For mutation commands: read back the file after command and verify changes

**For new edge cases:**
1. Find the existing `describe` block for the command
2. Add a new `test()` within it
3. Write descriptive test name starting with a verb
4. Include assertion messages in all `assert.*()` calls

---

*Testing analysis: 2026-02-26*
