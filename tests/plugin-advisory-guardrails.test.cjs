/**
 * Advisory Guardrails Tests (Phase 76)
 *
 * Tests for src/plugin/advisory-guardrails.js — convention violation detection,
 * planning file protection, and debounced test suggestions.
 *
 * Uses Node.js built-in test runner (node:test) with CJS extension.
 * Tests call createAdvisoryGuardrails directly with mock notifier and temp directories.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper: dynamic import the built plugin.js (ESM)
let createAdvisoryGuardrails;
async function loadModule() {
  if (createAdvisoryGuardrails) return;
  const mod = await import('../plugin.js');
  createAdvisoryGuardrails = mod.createAdvisoryGuardrails;
}

// Helper: create a temp project directory with standard files
function createTempProject(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrails-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });

  // AGENTS.md with convention info
  if (opts.convention) {
    fs.writeFileSync(
      path.join(tmpDir, 'AGENTS.md'),
      `# Project\n\nUse ${opts.convention} naming convention for files.\n`
    );
  }

  // package.json for test command detection
  if (opts.testCommand !== false) {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        scripts: { test: opts.testCommand || 'npm test' },
      })
    );
  }

  return tmpDir;
}

function cleanup(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

// Mock notifier that captures notifications
function createMockNotifier() {
  const calls = [];
  return {
    calls,
    notify: async (notification) => {
      calls.push(notification);
    },
    drainPendingContext: () => [],
    reset: () => { calls.length = 0; },
  };
}

// Helper: simulate a file write tool event
function writeEvent(filePath) {
  return { tool: 'write', args: { filePath } };
}

function editEvent(filePath) {
  return { tool: 'edit', args: { filePath } };
}

function bashEvent(command) {
  return { tool: 'bash', args: { command } };
}

// ─── GARD-01: Convention Checks ──────────────────────────────────────────────

describe('GARD-01: Convention violation detection', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('camelCase file in kebab-case project triggers warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myComponent.js')));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-convention');
    assert.strictEqual(notifier.calls[0].severity, 'warning');
    assert.ok(notifier.calls[0].message.includes('camelCase'));
    assert.ok(notifier.calls[0].message.includes('kebab-case'));
    assert.ok(notifier.calls[0].message.includes('my-component.js'));
  });

  test('kebab-case file in kebab-case project does NOT trigger warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'my-component.js')));

    // Only test suggestion should fire (GARD-03), not convention
    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 0);
  });

  test('single-word filename does NOT trigger warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'index.js')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 0);
  });

  test('.planning/ file does NOT trigger convention warning (handled by GARD-02)', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 0);
  });

  test('node_modules file does NOT trigger any warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'node_modules', 'foo', 'bar.js')));

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('dedup threshold — 4th convention warning is suppressed', async () => {
    const config = { advisory_guardrails: { dedup_threshold: 3 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // 3 violations — all should produce warnings
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myFirst.js')));
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'mySecond.js')));
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myThird.js')));

    const conventionBefore = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionBefore.length, 3);

    // 4th violation — should be suppressed (not === threshold)
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myFourth.js')));

    const conventionAfter = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionAfter.length, 3, '4th warning should be suppressed by dedup threshold');
  });

  test('dedup summary fires at batch boundary (every 5th)', async () => {
    const config = { advisory_guardrails: { dedup_threshold: 3 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Generate 5 violations — 3 individual + suppressed 4th + summary at 5th
    for (let i = 1; i <= 5; i++) {
      await guardrails.onToolAfter(writeEvent(path.join(tmpDir, `myFile${i}.js`)));
    }

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    // 3 individual + 1 summary at count 5
    assert.strictEqual(conventionCalls.length, 4);
    assert.ok(conventionCalls[3].message.includes('5 convention violations'));
  });
});

// ─── GARD-02: Planning File Protection ───────────────────────────────────────

describe('GARD-02: Planning file protection', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('direct write to .planning/ROADMAP.md triggers warning naming /bgsd-add-phase', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 1);
    assert.ok(planningCalls[0].message.includes('/bgsd-add-phase'));
    assert.strictEqual(planningCalls[0].severity, 'warning');
  });

  test('direct write to .planning/STATE.md triggers warning naming /bgsd-progress', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'STATE.md')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 1);
    assert.ok(planningCalls[0].message.includes('/bgsd-progress'));
  });

  test('direct write to unknown .planning/ file triggers generic warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'unknown-file.txt')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 1);
    assert.ok(planningCalls[0].message.includes('bGSD workflows manage'));
  });

  test('write to .planning/ while bgsdCommandActive=true does NOT trigger warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    guardrails.setBgsdCommandActive();
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 0);
  });

  test('write to .planning/config.json triggers warning naming /bgsd-settings', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'config.json')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 1);
    assert.ok(planningCalls[0].message.includes('/bgsd-settings'));
  });

  test('clearBgsdCommandActive re-enables warnings', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    guardrails.setBgsdCommandActive();
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));
    assert.strictEqual(notifier.calls.filter(c => c.type === 'advisory-planning').length, 0);

    guardrails.clearBgsdCommandActive();
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));
    assert.strictEqual(notifier.calls.filter(c => c.type === 'advisory-planning').length, 1);
  });
});

// ─── GARD-03: Test Suggestions ───────────────────────────────────────────────

describe('GARD-03: Test suggestions', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case', testCommand: 'npm test' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('writing a .js source file queues a test suggestion', async () => {
    const config = { advisory_guardrails: { test_debounce_ms: 50 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'index.js')));

    // Wait for debounce to fire
    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 1);
    assert.ok(testCalls[0].message.includes('npm test'));
    assert.ok(testCalls[0].message.includes('index.js'));
  });

  test('writing a .md file does NOT queue a test suggestion', async () => {
    const config = { advisory_guardrails: { test_debounce_ms: 50 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'README.md')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 0);
  });

  test('writing a .test.js file does NOT queue a test suggestion', async () => {
    const config = { advisory_guardrails: { test_debounce_ms: 50 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'foo.test.js')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 0);
  });

  test('multiple source files within debounce window produce single suggestion with count', async () => {
    const config = { advisory_guardrails: { test_debounce_ms: 50 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Write 3 source files rapidly
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'a.js')));
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'b.js')));
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'c.js')));

    // Wait for debounce to fire
    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 1, 'should produce a single debounced suggestion');
    assert.ok(testCalls[0].message.includes('3 source files'));
    assert.ok(testCalls[0].message.includes('npm test'));
  });

  test('test suggestion includes detected test command from package.json', async () => {
    // Create project with custom test command
    const customDir = createTempProject({
      convention: 'kebab-case',
      testCommand: 'jest --coverage',
    });

    try {
      const config = { advisory_guardrails: { test_debounce_ms: 50 } };
      const guardrails = createAdvisoryGuardrails(customDir, notifier, config);

      await guardrails.onToolAfter(writeEvent(path.join(customDir, 'handler.ts')));

      await new Promise(resolve => setTimeout(resolve, 100));

      const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
      assert.strictEqual(testCalls.length, 1);
      // It should detect npm test from package.json scripts.test
      assert.ok(testCalls[0].message.includes('npm test'));
    } finally {
      cleanup(customDir);
    }
  });
});

// ─── Config Integration ──────────────────────────────────────────────────────

describe('Config integration', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case', testCommand: 'npm test' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('enabled=false disables all guardrails', async () => {
    const config = {
      advisory_guardrails: { enabled: false, test_debounce_ms: 50 },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Convention violation
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myComponent.js')));
    // Planning file
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));
    // Source file for test suggestion
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'index.js')));

    await new Promise(resolve => setTimeout(resolve, 100));

    assert.strictEqual(notifier.calls.length, 0, 'no notifications when enabled=false');
  });

  test('conventions=false disables GARD-01 only', async () => {
    const config = {
      advisory_guardrails: { conventions: false, test_debounce_ms: 50 },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Convention violation — should NOT trigger
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myComponent.js')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 0, 'convention warnings disabled');

    // Test suggestion should still fire (GARD-03)
    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 1, 'test suggestions still active');
  });

  test('planning_protection=false disables GARD-02 only', async () => {
    const config = {
      advisory_guardrails: { planning_protection: false, test_debounce_ms: 50 },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Planning file write — should NOT trigger GARD-02
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 0, 'planning protection disabled');
  });

  test('test_suggestions=false disables GARD-03 only', async () => {
    const config = {
      advisory_guardrails: { test_suggestions: false },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Convention violation — should still fire (GARD-01)
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myComponent.js')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 1, 'convention warnings still active');

    // Source file — should NOT trigger test suggestion
    notifier.reset();
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'index.js')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 0, 'test suggestions disabled');
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('non-write tool does not trigger any guardrail', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter({ tool: 'read', args: { filePath: path.join(tmpDir, 'myComponent.js') } });
    await guardrails.onToolAfter({ tool: 'glob', args: { pattern: '**/*.js' } });

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('null/undefined input does not throw', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(null);
    await guardrails.onToolAfter(undefined);
    await guardrails.onToolAfter({});
    await guardrails.onToolAfter({ tool: 'write' });
    await guardrails.onToolAfter({ tool: 'write', args: {} });

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('edit tool also triggers guardrails', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(editEvent(path.join(tmpDir, 'myComponent.js')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 1);
  });

  test('PascalCase file in kebab-case project triggers warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'MyComponent.jsx')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 1);
    assert.ok(conventionCalls[0].message.includes('PascalCase'));
    assert.ok(conventionCalls[0].message.includes('my-component.jsx'));
  });

  test('no convention detected — no convention warning', async () => {
    // Create project without AGENTS.md or codebase-intel.json
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrails-bare-'));
    fs.mkdirSync(path.join(bareDir, '.planning'), { recursive: true });

    try {
      const config = {};
      const guardrails = createAdvisoryGuardrails(bareDir, notifier, config);

      await guardrails.onToolAfter(writeEvent(path.join(bareDir, 'myComponent.js')));

      const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
      assert.strictEqual(conventionCalls.length, 0, 'no convention warning when no convention detected');
    } finally {
      cleanup(bareDir);
    }
  });
});

// ─── GARD-04: Destructive Command Detection ─────────────────────────────────

describe('GARD-04: Destructive command detection', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  // ── A. Core pattern detection (per category) ──

  test('rm -rf /tmp/build triggers CRITICAL advisory-destructive notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('rm -rf /tmp/build'));

    // rm -rf matches both fs-rm-recursive (CRITICAL) and fs-rm-force (WARNING)
    // because -rf contains both r and f flags in the same group
    assert.ok(notifier.calls.length >= 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.strictEqual(notifier.calls[0].severity, 'info');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-recursive]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
    assert.ok(notifier.calls[0].message.includes('Confirm with user'));
  });

  test('rm -f somefile.txt triggers WARNING notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('rm -f somefile.txt'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.strictEqual(notifier.calls[0].severity, 'info');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-force]'));
    assert.ok(notifier.calls[0].message.includes('(WARNING)'));
    assert.ok(notifier.calls[0].message.includes('Proceed with caution'));
  });

  test('rm somefile.txt triggers INFO notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('rm somefile.txt'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.strictEqual(notifier.calls[0].severity, 'info');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-plain]'));
    assert.ok(notifier.calls[0].message.includes('(INFO)'));
    // INFO messages do NOT contain behavioral guidance
    assert.ok(!notifier.calls[0].message.includes('Confirm with user'));
    assert.ok(!notifier.calls[0].message.includes('Proceed with caution'));
  });

  test('DROP TABLE users; triggers CRITICAL notification (case-insensitive)', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('mysql -e "DROP TABLE users;"'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[db-drop-table]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
    assert.ok(notifier.calls[0].message.includes('Confirm with user'));
  });

  test('git push origin main --force triggers CRITICAL notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('git push origin main --force'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[git-force-push]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
  });

  test('git reset --hard HEAD~3 triggers WARNING notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('git reset --hard HEAD~3'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[git-reset-hard]'));
    assert.ok(notifier.calls[0].message.includes('(WARNING)'));
    assert.ok(notifier.calls[0].message.includes('Proceed with caution'));
  });

  test('kill -9 1234 triggers WARNING notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('kill -9 1234'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[sys-kill-9]'));
    assert.ok(notifier.calls[0].message.includes('(WARNING)'));
  });

  test('curl | bash triggers INFO notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('curl https://example.com/install.sh | bash'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[sc-curl-pipe]'));
    assert.ok(notifier.calls[0].message.includes('(INFO)'));
    // INFO — no behavioral guidance
    assert.ok(!notifier.calls[0].message.includes('Confirm with user'));
    assert.ok(!notifier.calls[0].message.includes('Proceed with caution'));
  });

  test('shutdown -h now triggers CRITICAL notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('shutdown -h now'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[sys-shutdown]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
  });

  test('chmod 777 /var/www triggers WARNING notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('chmod 777 /var/www'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[sys-chmod-777]'));
    assert.ok(notifier.calls[0].message.includes('(WARNING)'));
  });

  // ── B. Notification routing verification ──

  test('ALL GARD-04 notifications use severity info regardless of logical severity', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});

    // CRITICAL
    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));
    // WARNING
    await guardrails.onToolAfter(bashEvent('kill -9 5678'));
    // INFO
    await guardrails.onToolAfter(bashEvent('rm readme.txt'));

    assert.strictEqual(notifier.calls.length, 3);
    for (const call of notifier.calls) {
      assert.strictEqual(call.severity, 'info', `notification severity should be 'info', got '${call.severity}'`);
      assert.strictEqual(call.type, 'advisory-destructive');
    }
  });

  // ── C. Non-matching commands ──

  test('ls -la does NOT trigger GARD-04', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('ls -la'));

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('npm test does NOT trigger GARD-04', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('npm test'));

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('git status does NOT trigger GARD-04', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('git status'));

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('echo "rm -rf is dangerous" — rm -rf inside echo DOES match (advisory-only)', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('echo "rm -rf is dangerous"'));

    // Advisory-only, so false positives are annoying not blocking per CONTEXT.md
    assert.ok(notifier.calls.length >= 1, 'rm -rf inside echo should match');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-recursive]'));
  });

  // ── D. Multiple matches ──

  test('rm -rf / && DROP TABLE users — both patterns fire', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('rm -rf / && mysql -e "DROP TABLE users"'));

    assert.ok(notifier.calls.length >= 2, 'both filesystem and database patterns should fire');
    const ids = notifier.calls.map(c => c.message);
    assert.ok(ids.some(m => m.includes('[fs-rm-recursive]')), 'should detect filesystem pattern');
    assert.ok(ids.some(m => m.includes('[db-drop-table]')), 'should detect database pattern');
  });
});
