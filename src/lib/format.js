// ─── Format Module ───────────────────────────────────────────────────────────
// Shared formatting primitives for bGSD CLI output.
// Zero external dependencies. TTY-aware color with NO_COLOR support.

'use strict';

// ─── Terminal Detection ──────────────────────────────────────────────────────

function getTerminalWidth() {
  return process.stdout.columns || 80;
}

function isTTY() {
  return !!process.stdout.isTTY;
}

// ─── Color Utility (~2KB picocolors pattern) ─────────────────────────────────

const _colorEnabled = (() => {
  // NO_COLOR standard (no-color.org)
  if ('NO_COLOR' in process.env) return false;
  // Non-TTY (piped output)
  if (!process.stdout.isTTY) return false;
  // FORCE_COLOR override
  if (process.env.FORCE_COLOR) return true;
  return true;
})();

function _wrap(open, close) {
  if (!_colorEnabled) return (s) => String(s);
  return (s) => `\x1b[${open}m${s}\x1b[${close}m`;
}

const color = {
  enabled: _colorEnabled,

  // Modifiers
  bold: _wrap('1', '22'),
  dim: _wrap('2', '22'),
  underline: _wrap('4', '24'),

  // Colors
  red: _wrap('31', '39'),
  green: _wrap('32', '39'),
  yellow: _wrap('33', '39'),
  blue: _wrap('34', '39'),
  magenta: _wrap('35', '39'),
  cyan: _wrap('36', '39'),
  white: _wrap('37', '39'),
  gray: _wrap('90', '39'),
};

/**
 * Returns a color function based on percentage (red 0-33, yellow 34-66, green 67-100).
 */
function colorByPercent(percent) {
  if (percent <= 33) return color.red;
  if (percent <= 66) return color.yellow;
  return color.green;
}

// ─── Symbol Constants ────────────────────────────────────────────────────────

const SYMBOLS = {
  check: '\u2713',     // ✓
  cross: '\u2717',     // ✗
  progress: '\u25B6',  // ▶
  pending: '\u25CB',   // ○
  warning: '\u26A0',   // ⚠
  arrow: '\u2192',     // →
  bullet: '\u2022',    // •
  dash: '\u2500',      // ─
  heavyDash: '\u2501', // ━
};

// ─── Helper Utilities ────────────────────────────────────────────────────────

const _ansiRegex = /\x1b\[[0-9;]*m/g;

/**
 * Strip ANSI escape codes for width calculation.
 */
function stripAnsi(text) {
  return String(text).replace(_ansiRegex, '');
}

/**
 * Truncate text to maxWidth, adding '…' if truncated.
 */
function truncate(text, maxWidth) {
  const str = String(text);
  const visible = stripAnsi(str);
  if (visible.length <= maxWidth) return str;
  if (maxWidth <= 1) return '\u2026';
  // For strings with ANSI codes, we need to truncate the visible portion
  // and re-apply codes. For simplicity, strip first then truncate.
  return visible.slice(0, maxWidth - 1) + '\u2026';
}

/**
 * Convert ISO date or 'YYYY-MM-DD' to relative time string.
 */
function relativeTime(dateStr) {
  const then = new Date(dateStr);
  if (isNaN(then.getTime())) return String(dateStr);
  const now = new Date();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 0) return 'in the future';
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay} days ago`;
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffDay / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Pad text to width with alignment.
 * @param {string} text
 * @param {number} width
 * @param {'left'|'right'|'center'} align
 */
function pad(text, width, align = 'left') {
  const str = String(text);
  const visible = stripAnsi(str);
  const diff = width - visible.length;
  if (diff <= 0) return str;
  if (align === 'right') return ' '.repeat(diff) + str;
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  }
  return str + ' '.repeat(diff);
}

// ─── Table Renderer (PSql-style) ─────────────────────────────────────────────

/**
 * Render a PSql-style table with aligned columns, header separator, and truncation.
 *
 * @param {string[]} headers - Column names
 * @param {Array<Array<string>>} rows - Row data
 * @param {Object} [options]
 * @param {number} [options.maxWidth] - Max table width (default: terminal width)
 * @param {boolean} [options.truncate] - Truncate long cell text (default: true)
 * @param {boolean} [options.borders] - Show borders (default: false)
 * @param {number} [options.indent] - Left indent spaces (default: 1)
 * @param {Function} [options.colorFn] - Per-cell coloring: (value, colIdx, rowIdx) => coloredString
 * @param {number} [options.maxRows] - Max rows before truncation (default: 10)
 * @param {boolean} [options.showAll] - Show all rows (ignores maxRows)
 * @returns {string}
 */
function formatTable(headers, rows, options = {}) {
  const {
    maxWidth = getTerminalWidth(),
    truncate: doTruncate = true,
    borders = false,
    indent = 1,
    colorFn = null,
    maxRows = 10,
    showAll = false,
  } = options;

  if (!headers || headers.length === 0) return '';

  const indentStr = ' '.repeat(indent);
  const colGap = 2; // gap between columns

  // Calculate column widths from content
  const colCount = headers.length;
  const colWidths = headers.map((h) => stripAnsi(String(h)).length);

  for (const row of rows) {
    for (let i = 0; i < colCount; i++) {
      const cellLen = stripAnsi(String(row[i] || '')).length;
      if (cellLen > colWidths[i]) colWidths[i] = cellLen;
    }
  }

  // Constrain to maxWidth
  const totalGap = (colCount - 1) * colGap + indent;
  const availableWidth = maxWidth - totalGap;
  const totalColWidth = colWidths.reduce((a, b) => a + b, 0);

  if (totalColWidth > availableWidth && availableWidth > 0) {
    // Proportionally shrink columns, minimum 4 chars each
    const ratio = availableWidth / totalColWidth;
    for (let i = 0; i < colCount; i++) {
      colWidths[i] = Math.max(4, Math.floor(colWidths[i] * ratio));
    }
  }

  // Render header
  const headerCells = headers.map((h, i) =>
    color.bold(pad(truncateCell(String(h), colWidths[i], doTruncate), colWidths[i]))
  );
  const headerLine = indentStr + headerCells.join(' '.repeat(colGap));

  // Separator
  const sepWidth = colWidths.reduce((a, b) => a + b, 0) + (colCount - 1) * colGap;
  const separator = indentStr + SYMBOLS.dash.repeat(sepWidth);

  // Render rows
  const displayRows = (!showAll && rows.length > maxRows) ? rows.slice(0, maxRows) : rows;
  const rowLines = displayRows.map((row, rowIdx) => {
    const cells = [];
    for (let i = 0; i < colCount; i++) {
      let cellText = String(row[i] != null ? row[i] : '');
      cellText = truncateCell(cellText, colWidths[i], doTruncate);
      if (colorFn) {
        cellText = colorFn(row[i], i, rowIdx);
        cellText = truncateCell(String(cellText), colWidths[i], doTruncate);
      }
      cells.push(pad(cellText, colWidths[i]));
    }
    return indentStr + cells.join(' '.repeat(colGap));
  });

  const lines = [headerLine, separator, ...rowLines];

  // Truncation notice
  if (!showAll && rows.length > maxRows) {
    const remaining = rows.length - maxRows;
    lines.push(indentStr + color.dim(`... and ${remaining} more (use --all to see full list)`));
  }

  return lines.join('\n');
}

function truncateCell(text, maxWidth, doTruncate) {
  if (!doTruncate) return text;
  return truncate(text, maxWidth);
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

/**
 * Render a progress bar: '47% [███████░░░]'
 *
 * @param {number} percent - 0-100
 * @param {number} [width=20] - Bar width in characters
 * @returns {string}
 */
function progressBar(percent, width = 20) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  const colorFn = colorByPercent(pct);
  const pctStr = String(pct).padStart(3) + '%';
  return `${colorFn(pctStr)} [${colorFn(bar)}]`;
}

// ─── Section Header ──────────────────────────────────────────────────────────

/**
 * Render inline label embedded in horizontal rule: '━━ Progress ━━━━━━━━'
 *
 * @param {string} label
 * @returns {string}
 */
function sectionHeader(label) {
  const termWidth = getTerminalWidth();
  const prefix = SYMBOLS.heavyDash.repeat(2) + ' ';
  const labelStr = color.bold(color.cyan(label));
  const labelLen = stripAnsi(label).length;
  const suffixLen = Math.max(4, termWidth - 2 - 1 - labelLen - 1);
  const suffix = ' ' + SYMBOLS.heavyDash.repeat(suffixLen);
  return prefix + labelStr + suffix;
}

// ─── Banner ──────────────────────────────────────────────────────────────────

/**
 * Render a branded banner.
 * Standard: 'bGSD ▶ {TITLE}' with horizontal rule below.
 * Completion: special styled treatment with ━━━ borders and ✓.
 *
 * @param {string} title
 * @param {Object} [options]
 * @param {boolean} [options.completion] - Use completion style
 * @returns {string}
 */
function banner(title, options = {}) {
  const { completion = false } = options;
  const termWidth = getTerminalWidth();

  if (completion) {
    const rule = SYMBOLS.heavyDash.repeat(Math.min(termWidth, 60));
    const line = `${SYMBOLS.check} ${title}`;
    return [
      color.green(rule),
      color.bold(color.green(line)),
      color.green(rule),
    ].join('\n');
  }

  const prefix = color.dim('bGSD') + ' ' + color.cyan(SYMBOLS.progress) + ' ';
  const titleStr = color.bold(title);
  const ruleLen = Math.min(termWidth, 60);
  const rule = color.dim(SYMBOLS.dash.repeat(ruleLen));
  return prefix + titleStr + '\n' + rule;
}

// ─── Box ─────────────────────────────────────────────────────────────────────

const _boxPrefixes = {
  info: { fn: color.cyan, label: 'INFO' },
  warning: { fn: color.yellow, label: 'WARNING' },
  error: { fn: color.red, label: 'ERROR' },
  success: { fn: color.green, label: 'SUCCESS' },
};

/**
 * Render a box with horizontal rules only (no full borders per user decision).
 * Types: 'info', 'warning', 'error', 'success'.
 *
 * @param {string} content
 * @param {'info'|'warning'|'error'|'success'} [type='info']
 * @returns {string}
 */
function box(content, type = 'info') {
  const termWidth = getTerminalWidth();
  const ruleLen = Math.min(termWidth, 60);
  const cfg = _boxPrefixes[type] || _boxPrefixes.info;
  const topRule = cfg.fn(SYMBOLS.dash.repeat(ruleLen));
  const prefix = cfg.fn(color.bold(cfg.label + ':'));
  const bottomRule = cfg.fn(SYMBOLS.dash.repeat(ruleLen));

  return [topRule, prefix + ' ' + content, bottomRule].join('\n');
}

// ─── Summary Line ────────────────────────────────────────────────────────────

/**
 * Every command ends with a one-line takeaway.
 * Renders as: dim horizontal rule + bold summary text.
 *
 * @param {string} text
 * @returns {string}
 */
function summaryLine(text) {
  const ruleLen = Math.min(getTerminalWidth(), 60);
  const rule = color.dim(SYMBOLS.dash.repeat(ruleLen));
  return rule + '\n' + color.bold(text);
}

// ─── Action Hint ─────────────────────────────────────────────────────────────

/**
 * Always show next action at bottom of output.
 * Renders as: dim '→ {text}'.
 *
 * @param {string} text
 * @returns {string}
 */
function actionHint(text) {
  return color.dim(SYMBOLS.arrow + ' ' + text);
}

// ─── List With Truncation ────────────────────────────────────────────────────

/**
 * Show first maxItems items, then truncation notice.
 * Numbered items per user decision.
 *
 * @param {string[]} items
 * @param {number} [maxItems=10]
 * @param {boolean} [showAll=false]
 * @returns {string}
 */
function listWithTruncation(items, maxItems = 10, showAll = false) {
  if (!items || items.length === 0) return '';
  const display = (!showAll && items.length > maxItems) ? items.slice(0, maxItems) : items;
  const lines = display.map((item, i) => ` ${i + 1}. ${item}`);
  if (!showAll && items.length > maxItems) {
    const remaining = items.length - maxItems;
    lines.push(color.dim(` ... and ${remaining} more (use --all to see full list)`));
  }
  return lines.join('\n');
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Terminal
  getTerminalWidth,
  isTTY,

  // Color
  color,
  colorByPercent,

  // Symbols
  SYMBOLS,

  // Helpers
  stripAnsi,
  truncate,
  relativeTime,
  pad,

  // Renderers
  formatTable,
  progressBar,
  sectionHeader,
  banner,
  box,
  summaryLine,
  actionHint,
  listWithTruncation,
};
