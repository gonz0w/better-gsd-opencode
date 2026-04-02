'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const tempPaths = [];

async function loadAttentionSyncModule() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-cmux-attention-sync-'));
  tempPaths.push(fixtureDir);

  const files = [
    'cmux-lifecycle-signal',
    'cmux-sidebar-snapshot',
    'cmux-attention-policy',
    'cmux-attention-sync',
  ];

  for (const name of files) {
    const sourcePath = path.join(__dirname, '..', 'src', 'plugin', `${name}.js`);
    let source = fs.readFileSync(sourcePath, 'utf-8');
    source = source.replaceAll('./cmux-lifecycle-signal.js', './cmux-lifecycle-signal.mjs');
    source = source.replaceAll('./cmux-sidebar-snapshot.js', './cmux-sidebar-snapshot.mjs');
    source = source.replaceAll('./cmux-attention-policy.js', './cmux-attention-policy.mjs');
    fs.writeFileSync(path.join(fixtureDir, `${name}.mjs`), source);
  }

  return import(pathToFileURL(path.join(fixtureDir, 'cmux-attention-sync.mjs')).href);
}

function makeProjectState(overrides = {}) {
  const state = {
    phase: '186 — cmux Truthful Lifecycle Signals',
    currentPlan: '02',
    status: 'In progress',
    lastActivity: '2026-04-02T05:00:00Z',
    progress: null,
    raw: '',
    blocking_reason: null,
    recovery_summary: null,
    getSection(name) {
      return name === 'Session Continuity' ? null : null;
    },
    ...overrides.state,
  };

  return {
    state,
    currentPhase: {
      number: '186',
      name: 'cmux Truthful Lifecycle Signals',
      status: 'incomplete',
      ...overrides.currentPhase,
    },
    notificationHistory: overrides.notificationHistory || [],
  };
}

function createAdapter() {
  return {
    workspaceId: 'workspace:2',
    logs: [],
    notifications: [],
    async log(message, meta) {
      this.logs.push({ message, meta });
    },
    async notify(payload) {
      this.notifications.push(payload);
    },
  };
}

test.afterEach(() => {
  while (tempPaths.length > 0) {
    fs.rmSync(tempPaths.pop(), { recursive: true, force: true });
  }
});

describe('plugin cmux attention sync', () => {
  test('waiting notifications reuse the shared lifecycle hint instead of generic raw-status wording', async () => {
    const { createAttentionMemory, syncCmuxAttention } = await loadAttentionSyncModule();
    const adapter = createAdapter();
    const result = await syncCmuxAttention(adapter, makeProjectState({
      state: {
        status: 'Checkpoint waiting for review',
        progress: 61,
      },
    }), {
      memory: createAttentionMemory(),
      now: 1_000,
      trigger: { hook: 'file.watcher.updated' },
    });

    assert.strictEqual(result.emitted, true);
    assert.strictEqual(result.event.kind, 'waiting');
    assert.match(result.event.log.message, /checkpoint waiting for review/i);
    assert.strictEqual(adapter.notifications.length, 1);
    assert.match(adapter.notifications[0].body, /checkpoint waiting for review/i);
  });

  test('stale and finalize-failed notify once per semantic occurrence while blocked stays log-only', async () => {
    const { createAttentionMemory, syncCmuxAttention } = await loadAttentionSyncModule();
    const memory = createAttentionMemory();

    const staleAdapter = createAdapter();
    const staleResult = await syncCmuxAttention(staleAdapter, makeProjectState({
      state: {
        status: 'In progress',
        blocking_reason: 'stale',
        recovery_summary: { blocking_reason: 'stale' },
      },
    }), { memory, now: 2_000 });
    assert.strictEqual(staleResult.event.kind, 'stale');
    assert.strictEqual(staleAdapter.notifications.length, 1);

    const finalizeAdapter = createAdapter();
    const finalizeResult = await syncCmuxAttention(finalizeAdapter, makeProjectState({
      state: {
        status: 'Blocked on finalize failure',
        blocking_reason: 'finalize_failed',
        recovery_summary: { blocking_reason: 'finalize_failed' },
      },
    }), { memory, now: 3_000 });
    assert.strictEqual(finalizeResult.event.kind, 'finalize-failed');
    assert.strictEqual(finalizeAdapter.notifications.length, 1);

    const blockedAdapter = createAdapter();
    const blockedResult = await syncCmuxAttention(blockedAdapter, makeProjectState({
      state: {
        status: 'Blocked by hard failure',
      },
      notificationHistory: [{ severity: 'critical', message: 'workspace cannot continue' }],
    }), { memory, now: 4_000 });
    assert.strictEqual(blockedResult.event.kind, 'blocked');
    assert.strictEqual(blockedAdapter.logs.length, 1);
    assert.strictEqual(blockedAdapter.notifications.length, 0);
  });

  test('resolved intervention logs recovery once without notifying or leaving warning treatment on running state', async () => {
    const { createAttentionMemory, syncCmuxAttention } = await loadAttentionSyncModule();
    const memory = createAttentionMemory();

    const waitingAdapter = createAdapter();
    await syncCmuxAttention(waitingAdapter, makeProjectState({
      state: {
        status: 'Checkpoint waiting for review',
      },
    }), { memory, now: 5_000 });

    const runningAdapter = createAdapter();
    const result = await syncCmuxAttention(runningAdapter, makeProjectState({
      state: {
        status: 'Verification running',
        progress: 48,
      },
    }), { memory, now: 6_000 });

    assert.strictEqual(result.emitted, true);
    assert.strictEqual(result.event.kind, 'running');
    assert.strictEqual(runningAdapter.notifications.length, 0);
    assert.strictEqual(runningAdapter.logs.length, 1);
    assert.match(runningAdapter.logs[0].message, /resolved|running|recovered/i);
  });
});
