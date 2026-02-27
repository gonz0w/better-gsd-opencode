/**
 * Format Module Tests
 *
 * Tests for src/lib/format.js — the shared formatting primitives for bGSD CLI output.
 * Uses Node.js built-in test runner (node:test). NOT included in package — pre-release only.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const path = require('path');

const {
  color,
  colorByPercent,
  SYMBOLS,
  formatTable,
  progressBar,
  sectionHeader,
  banner,
  box,
  summaryLine,
  actionHint,
  listWithTruncation,
  getTerminalWidth,
  isTTY,
  truncate,
  relativeTime,
  pad,
  stripAnsi,
} = require('../src/lib/format');

// ─── SYMBOLS ─────────────────────────────────────────────────────────────────

describe('SYMBOLS', () => {
  test('check is checkmark', () => {
    assert.strictEqual(SYMBOLS.check, '\u2713');
  });

  test('cross is ballot X', () => {
    assert.strictEqual(SYMBOLS.cross, '\u2717');
  });

  test('progress is right-pointing triangle', () => {
    assert.strictEqual(SYMBOLS.progress, '\u25B6');
  });

  test('pending is white circle', () => {
    assert.strictEqual(SYMBOLS.pending, '\u25CB');
  });

  test('all expected keys exist', () => {
    const expectedKeys = ['check', 'cross', 'progress', 'pending', 'warning', 'arrow', 'bullet', 'dash', 'heavyDash'];
    for (const key of expectedKeys) {
      assert.ok(key in SYMBOLS, `SYMBOLS.${key} should exist`);
      assert.strictEqual(typeof SYMBOLS[key], 'string', `SYMBOLS.${key} should be a string`);
    }
  });
});

// ─── Color Utility ───────────────────────────────────────────────────────────

describe('color', () => {
  test('color functions return strings', () => {
    // In test (piped) mode, colors are disabled, but functions still return strings
    const result = color.red('text');
    assert.strictEqual(typeof result, 'string');
    assert.ok(result.includes('text'), 'result should contain the input text');
  });

  test('color.enabled is false in piped mode (non-TTY)', () => {
    // Tests run piped, so color should be disabled
    assert.strictEqual(color.enabled, false);
  });

  test('NO_COLOR env disables color in subprocess', () => {
    // Run a small script that checks color.enabled with NO_COLOR set
    const script = `
      const { color } = require('./src/lib/format');
      process.stdout.write(String(color.enabled));
    `;
    const result = execSync(`NO_COLOR=1 node -e "${script.replace(/"/g, '\\"')}"`, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert.strictEqual(result.trim(), 'false');
  });

  test('colorByPercent returns red-range for low values', () => {
    const fn = colorByPercent(20);
    assert.strictEqual(typeof fn, 'function');
    // In non-TTY, all color functions just return the string
    assert.ok(fn('test').includes('test'));
  });

  test('colorByPercent returns yellow-range for mid values', () => {
    const fn = colorByPercent(50);
    assert.strictEqual(typeof fn, 'function');
    assert.ok(fn('test').includes('test'));
  });

  test('colorByPercent returns green-range for high values', () => {
    const fn = colorByPercent(80);
    assert.strictEqual(typeof fn, 'function');
    assert.ok(fn('test').includes('test'));
  });

  test('stripAnsi removes ANSI escape codes', () => {
    const colored = '\x1b[31mhello\x1b[39m';
    assert.strictEqual(stripAnsi(colored), 'hello');
  });

  test('stripAnsi returns plain text unchanged', () => {
    assert.strictEqual(stripAnsi('plain text'), 'plain text');
  });
});

// ─── formatTable ─────────────────────────────────────────────────────────────

describe('formatTable', () => {
  test('basic table has header separator with dash character', () => {
    const result = formatTable(['Name', 'Status'], [['Test', '\u2713']]);
    assert.ok(result.includes(SYMBOLS.dash), 'should contain dash separator');
    assert.ok(result.includes('Name'), 'should contain header Name');
    assert.ok(result.includes('Status'), 'should contain header Status');
    assert.ok(result.includes('Test'), 'should contain row data');
  });

  test('empty rows produces header-only output without crash', () => {
    const result = formatTable(['A', 'B'], []);
    assert.ok(result.includes('A'), 'should contain header A');
    assert.ok(result.includes('B'), 'should contain header B');
    assert.ok(result.includes(SYMBOLS.dash), 'should contain separator');
  });

  test('table with >10 rows shows truncation message', () => {
    const rows = Array.from({ length: 15 }, (_, i) => [`item${i}`, `val${i}`]);
    const result = formatTable(['Name', 'Value'], rows);
    assert.ok(result.includes('... and'), 'should contain truncation notice');
    assert.ok(result.includes('5 more'), 'should show 5 remaining');
  });

  test('column alignment pads values with spaces', () => {
    const result = formatTable(['Name', 'Status'], [['A', 'OK'], ['LongerName', 'OK']]);
    const lines = result.split('\n');
    // Data rows should have consistent spacing — the header and both data rows
    // should all have the same structure
    assert.ok(lines.length >= 3, 'should have header, separator, and data rows');
  });

  test('empty headers returns empty string', () => {
    const result = formatTable([], []);
    assert.strictEqual(result, '');
  });
});

// ─── progressBar ─────────────────────────────────────────────────────────────

describe('progressBar', () => {
  test('0% contains 0% and empty bar characters', () => {
    const result = progressBar(0);
    assert.ok(result.includes('0%'), 'should contain 0%');
    assert.ok(result.includes('\u2591'), 'should contain empty bar chars');
  });

  test('100% contains 100% and filled bar characters', () => {
    const result = progressBar(100);
    assert.ok(result.includes('100%'), 'should contain 100%');
    assert.ok(result.includes('\u2588'), 'should contain filled bar chars');
  });

  test('50% contains 50% and both filled and empty chars', () => {
    const result = progressBar(50);
    assert.ok(result.includes('50%'), 'should contain 50%');
    assert.ok(result.includes('\u2588'), 'should contain filled chars');
    assert.ok(result.includes('\u2591'), 'should contain empty chars');
  });

  test('width parameter controls bar length', () => {
    const narrow = progressBar(50, 10);
    const wide = progressBar(50, 30);
    // Wider bar should produce a longer string
    assert.ok(stripAnsi(wide).length > stripAnsi(narrow).length,
      'wider bar should produce longer output');
  });
});

// ─── sectionHeader ───────────────────────────────────────────────────────────

describe('sectionHeader', () => {
  test('contains the label text', () => {
    const result = sectionHeader('Progress');
    assert.ok(stripAnsi(result).includes('Progress'), 'should contain label');
  });

  test('contains heavy dash characters', () => {
    const result = sectionHeader('Progress');
    assert.ok(result.includes(SYMBOLS.heavyDash), 'should contain heavy dash');
  });
});

// ─── banner ──────────────────────────────────────────────────────────────────

describe('banner', () => {
  test('standard banner contains bGSD branding and title', () => {
    const result = banner('TEST');
    assert.ok(stripAnsi(result).includes('bGSD'), 'should contain bGSD');
    assert.ok(stripAnsi(result).includes('TEST'), 'should contain title');
  });

  test('banner includes dash horizontal rule', () => {
    const result = banner('TEST');
    assert.ok(result.includes(SYMBOLS.dash), 'should contain horizontal rule');
  });

  test('completion banner contains check mark and heavy dashes', () => {
    const result = banner('DONE', { completion: true });
    assert.ok(stripAnsi(result).includes(SYMBOLS.check), 'should contain check mark');
    assert.ok(result.includes(SYMBOLS.heavyDash), 'should contain heavy dash');
  });
});

// ─── box ─────────────────────────────────────────────────────────────────────

describe('box', () => {
  test('warning box contains message', () => {
    const result = box('message', 'warning');
    assert.ok(stripAnsi(result).includes('message'), 'should contain message');
  });

  test('error box contains ERROR prefix', () => {
    const result = box('message', 'error');
    assert.ok(stripAnsi(result).includes('ERROR'), 'should contain ERROR prefix');
  });

  test('box uses horizontal rules (not full box-drawing borders)', () => {
    const result = box('test', 'info');
    assert.ok(result.includes(SYMBOLS.dash), 'should contain horizontal rules');
    assert.ok(stripAnsi(result).includes('INFO'), 'should contain INFO label');
  });
});

// ─── truncate ────────────────────────────────────────────────────────────────

describe('truncate', () => {
  test('truncates long text with ellipsis', () => {
    const result = truncate('hello world', 8);
    assert.strictEqual(result, 'hello w\u2026');
  });

  test('returns short text unchanged', () => {
    const result = truncate('short', 10);
    assert.strictEqual(result, 'short');
  });

  test('empty string returns empty (no crash)', () => {
    const result = truncate('', 5);
    assert.strictEqual(result, '');
  });
});

// ─── relativeTime ────────────────────────────────────────────────────────────

describe('relativeTime', () => {
  test('today returns just now or recent time', () => {
    const now = new Date().toISOString();
    const result = relativeTime(now);
    assert.ok(
      result === 'just now' || result.includes('ago'),
      `should be recent time, got: ${result}`
    );
  });

  test('yesterday returns yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000 * 1.5);
    const result = relativeTime(yesterday.toISOString());
    assert.ok(
      result === 'yesterday' || result.includes('day'),
      `should indicate yesterday, got: ${result}`
    );
  });

  test('invalid input does not crash', () => {
    const result = relativeTime('not-a-date');
    assert.strictEqual(typeof result, 'string');
    assert.strictEqual(result, 'not-a-date');
  });
});

// ─── listWithTruncation ──────────────────────────────────────────────────────

describe('listWithTruncation', () => {
  test('short list shows all items', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const result = listWithTruncation(items);
    for (const item of items) {
      assert.ok(result.includes(item), `should contain item: ${item}`);
    }
    assert.ok(!result.includes('... and'), 'should not truncate');
  });

  test('long list shows 10 + truncation message', () => {
    const items = Array.from({ length: 15 }, (_, i) => `item-${i}`);
    const result = listWithTruncation(items);
    assert.ok(result.includes('item-0'), 'should contain first item');
    assert.ok(result.includes('item-9'), 'should contain 10th item');
    assert.ok(!result.includes('item-10'), 'should not contain 11th item');
    assert.ok(result.includes('... and 5 more'), 'should show truncation notice');
  });
});

// ─── pad ─────────────────────────────────────────────────────────────────────

describe('pad', () => {
  test('left-align pads with trailing spaces', () => {
    const result = pad('hi', 5);
    assert.strictEqual(result, 'hi   ');
  });

  test('right-align pads with leading spaces', () => {
    const result = pad('hi', 5, 'right');
    assert.strictEqual(result, '   hi');
  });

  test('center-align pads both sides', () => {
    const result = pad('hi', 6, 'center');
    assert.strictEqual(result, '  hi  ');
  });
});

// ─── getTerminalWidth / isTTY ────────────────────────────────────────────────

describe('terminal detection', () => {
  test('getTerminalWidth returns a number', () => {
    const width = getTerminalWidth();
    assert.strictEqual(typeof width, 'number');
    assert.ok(width > 0, 'width should be positive');
  });

  test('isTTY returns a boolean', () => {
    const tty = isTTY();
    assert.strictEqual(typeof tty, 'boolean');
  });
});

// ─── summaryLine ─────────────────────────────────────────────────────────────

describe('summaryLine', () => {
  test('contains the summary text and horizontal rule', () => {
    const result = summaryLine('All done');
    assert.ok(stripAnsi(result).includes('All done'), 'should contain text');
    assert.ok(result.includes(SYMBOLS.dash), 'should contain horizontal rule');
  });
});

// ─── actionHint ──────────────────────────────────────────────────────────────

describe('actionHint', () => {
  test('contains arrow and hint text', () => {
    const result = actionHint('Run next command');
    assert.ok(stripAnsi(result).includes('Run next command'), 'should contain hint');
    assert.ok(result.includes(SYMBOLS.arrow), 'should contain arrow');
  });
});
