# Phase 48: Compare — Multi-Attempt Metrics Aggregation - Research

**Researched:** 2026-03-01
**Domain:** CLI command implementation, metrics aggregation, TTY table rendering
**Confidence:** HIGH

## Summary

Phase 48 adds a `trajectory compare` subcommand that reads checkpoint journal entries from `trajectory.json`, aggregates metrics (test results, LOC delta, cyclomatic complexity) across all attempts for a given checkpoint name, and renders a color-coded comparison matrix identifying the best attempt per metric.

The existing trajectory infrastructure (Phase 45–47) provides all the data structures needed: journal entries with `category: 'checkpoint'` contain `metrics` objects with `tests`, `loc_delta`, and `complexity` fields. The compare command reads these entries, filters by checkpoint name/scope, builds a comparison matrix, and outputs via the established `output(result, { formatter })` dual-mode pattern. The `formatTable` primitive in `format.js` supports per-cell coloring via its `colorFn` option, which is exactly what's needed for green=best/red=worst rendering.

**Primary recommendation:** Implement compare as a pure data-reading command (no git operations, no metric re-collection) that aggregates metrics already stored in journal entries. This is the simplest, fastest path — checkpoint already captures all needed metrics at creation time.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | Compare test results (pass/fail/skip) across all attempts | Journal entries store `metrics.tests` with `{total, pass, fail}` — direct read |
| COMP-02 | Compare LOC delta (lines added/removed) across attempts | Journal entries store `metrics.loc_delta` with `{insertions, deletions, files_changed}` — direct read |
| COMP-03 | Compare cyclomatic complexity across attempts via ast.js | Journal entries store `metrics.complexity` with `{total, files_analyzed}` — direct read |
| COMP-04 | Aggregated multi-dimension matrix identifying best attempt per metric | Compute min/max per metric column, tag best/worst per row |
| COMP-05 | Color-coded TTY table (green=best, red=worst) with JSON fallback | `formatTable` has `colorFn` option; `output(result, { formatter })` handles TTY/JSON auto-detection |
</phase_requirements>

## Standard Stack

### Core (already in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fs` | N/A | Read trajectory.json | Zero deps, existing pattern |
| `src/lib/output.js` | N/A | Dual-mode output (JSON + TTY) | Established `output(result, { formatter })` pattern |
| `src/lib/format.js` | N/A | Table rendering with color | `formatTable` with `colorFn`, `banner`, `summaryLine`, `actionHint` |
| `src/commands/trajectory.js` | N/A | Home for compare command | All trajectory subcommands live here |
| `src/router.js` | N/A | Route `trajectory compare` to handler | Add case to trajectory switch block |
| `src/lib/constants.js` | N/A | Help text | Add compare subcommand and compound help key |

### Supporting (if needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/ast.js` → `computeComplexity` | N/A | Live complexity re-computation | Only if journal metrics are null/missing — NOT the primary path |
| `src/lib/git.js` → `diffSummary` | N/A | Live LOC delta re-computation | Only if journal metrics are null/missing — NOT the primary path |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reading stored metrics | Re-computing metrics from branches | Slower, requires git checkout per attempt — unnecessary since checkpoint already stores metrics |
| Single table view | Multiple tables per metric | More complex for marginal readability gain; single matrix is standard for comparison |

## Architecture Patterns

### Recommended Implementation Structure

The compare command adds to the existing `src/commands/trajectory.js` file. No new files needed.

```
src/commands/trajectory.js    # Add cmdTrajectoryCompare + formatCompareResult
src/router.js                 # Add 'compare' case to trajectory switch
src/lib/constants.js          # Add compare help text
bin/gsd-tools.test.cjs        # Add compare tests
```

### Pattern 1: Journal Entry Reading (copy from list command)

**What:** Read trajectory.json, filter by checkpoint name + scope, sort by attempt number
**When to use:** Entry point for compare command — identical pattern to `cmdTrajectoryList`

```javascript
// Source: src/commands/trajectory.js — cmdTrajectoryList pattern
const trajPath = path.join(cwd, '.planning', 'memory', 'trajectory.json');
let entries = [];
try {
  const data = fs.readFileSync(trajPath, 'utf-8');
  entries = JSON.parse(data);
  if (!Array.isArray(entries)) entries = [];
} catch (e) {
  debugLog('trajectory.compare', 'no trajectory.json found', e);
  entries = [];
}

// Filter to checkpoints matching name/scope (exclude abandoned)
const attempts = entries.filter(e =>
  e.category === 'checkpoint' &&
  e.checkpoint_name === name &&
  e.scope === scope &&
  !(e.tags && e.tags.includes('abandoned'))
);
```

### Pattern 2: Dual-Mode Output (established v6.0 pattern)

**What:** Use `output(result, { formatter })` for automatic JSON/TTY switching
**When to use:** Every command output — provides machine-readable JSON when piped, human-readable when TTY

```javascript
// Source: src/commands/trajectory.js — formatTrajectoryList pattern
output(result, { formatter: formatCompareResult });
```

### Pattern 3: Color-Coded Table with formatTable colorFn

**What:** The `formatTable` function accepts a `colorFn` option: `(value, colIdx, rowIdx) => coloredString`
**When to use:** For the comparison matrix where best=green, worst=red per metric column

```javascript
// Source: src/lib/format.js — formatTable signature
formatTable(headers, rows, {
  showAll: true,
  colorFn: (value, colIdx, rowIdx) => {
    // colIdx 0 = attempt name, skip coloring
    if (colIdx === 0) return String(value);
    // Look up if this cell is best/worst for this metric
    const metric = metricKeys[colIdx - 1];
    if (bestPerMetric[metric] === rowIdx) return color.green(String(value));
    if (worstPerMetric[metric] === rowIdx) return color.red(String(value));
    return String(value);
  },
});
```

### Pattern 4: Best/Worst Identification per Metric

**What:** For each metric column, find which attempt has the best and worst value
**When to use:** Building the aggregated matrix (COMP-04)

```javascript
// Best/worst determination rules:
// - Tests passing: HIGHER is better (most tests passing = best)
// - Tests failing: LOWER is better (fewest failures = best)
// - LOC delta (total): LOWER is better (smallest change = best)
// - Complexity: LOWER is better (lowest complexity = best)
const METRIC_DIRECTION = {
  tests_pass: 'higher',     // More passing tests = better
  tests_fail: 'lower',      // Fewer failing tests = better
  loc_insertions: 'lower',  // Fewer insertions = smaller change
  loc_deletions: 'lower',   // Fewer deletions = smaller change
  loc_net: 'lower',         // Smallest net change = best (abs value)
  complexity: 'lower',      // Lower complexity = better
};
```

### Pattern 5: Subcommand Registration

**What:** Add to trajectory switch in router.js and export from trajectory.js
**When to use:** Standard pattern for every new trajectory subcommand

```javascript
// router.js — trajectory switch block
case 'compare': lazyTrajectory().cmdTrajectoryCompare(cwd, args.slice(1), raw); break;

// trajectory.js — module.exports
module.exports = { cmdTrajectoryCheckpoint, cmdTrajectoryList, cmdTrajectoryPivot, cmdTrajectoryCompare };
```

### Anti-Patterns to Avoid

- **Re-computing metrics from git branches:** Checkpoint already stores metrics at creation time. Don't checkout each attempt branch to re-measure — it's slow and defeats the purpose of storing metrics.
- **Interactive prompts:** gsd-tools runs via `execFileSync`, not interactive TTY. All inputs must be flags.
- **Modifying journal data:** Compare is read-only. Never write to trajectory.json from compare.
- **Hard-coding column widths:** Let `formatTable` auto-size based on content. The format module handles terminal width constraints.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table rendering | Custom column alignment | `formatTable(headers, rows, opts)` | Handles ANSI-aware width calculation, truncation, terminal sizing |
| TTY detection | `process.stdout.isTTY` checks | `output(result, { formatter })` | Handles JSON mode, --pretty override, --fields filtering, tmpfile fallback |
| Color output | Raw ANSI codes | `color.green()`, `color.red()`, `color.bold()` | Respects NO_COLOR, non-TTY, FORCE_COLOR automatically |
| Metrics from journal | Parse raw JSON manually | Filter on `e.category === 'checkpoint'` and read `e.metrics` | Established pattern from list/pivot commands |
| Cyclomatic complexity calculation | Regex counting | `computeComplexity()` from `ast.js` | Full AST-based per-function analysis; but only needed if metrics are null |

## Common Pitfalls

### Pitfall 1: Null/Missing Metrics in Journal Entries
**What goes wrong:** Some journal entries may have `metrics: null` (e.g., abandoned entries created by pivot, or checkpoints where metric collection failed)
**Why it happens:** Pivot creates abandoned entries with `metrics: null`. Metric collectors use fault-tolerant try/catch, so individual metrics can be null.
**How to avoid:** Always null-check each metric field. Display '-' for missing values. Don't crash on null metrics.
**Warning signs:** `TypeError: Cannot read properties of null` when accessing `e.metrics.tests`

### Pitfall 2: Abandoned Entries in Comparison
**What goes wrong:** Including abandoned attempt entries pollutes the comparison with entries that have no metrics
**Why it happens:** Pivot creates entries tagged `['checkpoint', 'abandoned']` — they have `category: 'checkpoint'` but are abandoned
**How to avoid:** Filter out entries where `e.tags && e.tags.includes('abandoned')` — exactly as pivot command does
**Warning signs:** Attempts showing up with all '-' metrics

### Pitfall 3: colorFn Receives Original Value, Not Display String
**What goes wrong:** The `colorFn` in `formatTable` receives the raw `row[colIdx]` value, not a pre-formatted string. If you return a colored string from colorFn but also set the cell text separately, you get double-processing.
**Why it happens:** formatTable applies colorFn AFTER setting cellText, then re-truncates the result
**How to avoid:** When using colorFn, the colorFn return value IS the cell text. Don't also format the cell in the rows array — let colorFn handle coloring of the raw value.
**Warning signs:** Garbled output, truncated ANSI codes

### Pitfall 4: No Checkpoints Found
**What goes wrong:** User runs `trajectory compare` without specifying a name, or specifies a name that doesn't exist
**Why it happens:** User error or scope mismatch (checkpointed as 'task' scope, comparing as 'phase' scope)
**How to avoid:** Show clear error with available checkpoint names (same pattern as pivot's not-found handling). If no name provided, list all unique checkpoint names and prompt.
**Warning signs:** Empty table or cryptic error

### Pitfall 5: Single Attempt Comparison
**What goes wrong:** User compares a checkpoint that has only one attempt — there's nothing to compare against
**Why it happens:** They haven't pivoted yet or are checking status
**How to avoid:** Still show the single attempt with its metrics (useful for status), but skip best/worst coloring since there's nothing to compare. Add actionHint suggesting to create more checkpoints.
**Warning signs:** N/A — this is a valid use case, just handle gracefully

### Pitfall 6: Bundle Size Budget (1050KB)
**What goes wrong:** Adding compare command pushes bundle over budget
**Why it happens:** Current bundle is 1029KB / 1050KB budget
**How to avoid:** Compare is a lightweight data-reading command — it adds ~100-200 lines to trajectory.js. This should be well within the remaining 21KB budget. Keep formatting inline, don't add new modules.
**Warning signs:** Build script reporting over-budget

## Code Examples

### Compare Command Skeleton

```javascript
// Source: derived from cmdTrajectoryList pattern in src/commands/trajectory.js
function cmdTrajectoryCompare(cwd, args, raw) {
  const posArgs = [];
  let scope = 'phase';

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--scope' && args[i + 1]) { scope = args[++i]; continue; }
    if (!args[i].startsWith('-')) posArgs.push(args[i]);
  }

  const name = posArgs[0];
  if (!name) error('Missing checkpoint name. Usage: trajectory compare <name> [--scope <scope>]');

  // Read trajectory journal
  const trajPath = path.join(cwd, '.planning', 'memory', 'trajectory.json');
  let entries = [];
  try {
    const data = fs.readFileSync(trajPath, 'utf-8');
    entries = JSON.parse(data);
    if (!Array.isArray(entries)) entries = [];
  } catch (e) {
    entries = [];
  }

  // Filter to matching non-abandoned checkpoints
  const attempts = entries.filter(e =>
    e.category === 'checkpoint' &&
    e.checkpoint_name === name &&
    e.scope === scope &&
    !(e.tags && e.tags.includes('abandoned'))
  ).sort((a, b) => a.attempt - b.attempt);

  if (attempts.length === 0) {
    error(`No checkpoints found for "${name}" (scope: ${scope}).`);
  }

  // Build comparison data
  const metrics = attempts.map(a => ({
    attempt: a.attempt,
    branch: a.branch,
    git_ref: a.git_ref,
    timestamp: a.timestamp,
    tests_pass: a.metrics?.tests?.pass ?? null,
    tests_fail: a.metrics?.tests?.fail ?? null,
    tests_total: a.metrics?.tests?.total ?? null,
    loc_insertions: a.metrics?.loc_delta?.insertions ?? null,
    loc_deletions: a.metrics?.loc_delta?.deletions ?? null,
    complexity: a.metrics?.complexity?.total ?? null,
  }));

  // Identify best per metric
  const bestPerMetric = {};
  const worstPerMetric = {};
  const metricKeys = ['tests_pass', 'tests_fail', 'loc_insertions', 'loc_deletions', 'complexity'];
  const direction = {
    tests_pass: 'higher',
    tests_fail: 'lower',
    loc_insertions: 'lower',
    loc_deletions: 'lower',
    complexity: 'lower',
  };

  for (const key of metricKeys) {
    let bestIdx = -1, worstIdx = -1, bestVal = null, worstVal = null;
    for (let i = 0; i < metrics.length; i++) {
      const val = metrics[i][key];
      if (val === null) continue;
      if (bestVal === null || (direction[key] === 'higher' ? val > bestVal : val < bestVal)) {
        bestVal = val; bestIdx = i;
      }
      if (worstVal === null || (direction[key] === 'higher' ? val < worstVal : val > worstVal)) {
        worstVal = val; worstIdx = i;
      }
    }
    if (bestIdx !== -1 && bestIdx !== worstIdx) {
      bestPerMetric[key] = bestIdx;
      worstPerMetric[key] = worstIdx;
    }
  }

  const result = {
    checkpoint: name,
    scope,
    attempts: metrics,
    best_per_metric: bestPerMetric,
    worst_per_metric: worstPerMetric,
    attempt_count: metrics.length,
  };

  output(result, { formatter: formatCompareResult });
}
```

### Formatter Skeleton

```javascript
function formatCompareResult(result) {
  const lines = [];
  lines.push(banner('TRAJECTORY COMPARE'));
  lines.push('');
  lines.push(`  Checkpoint: ${color.bold(result.checkpoint)} (scope: ${result.scope})`);
  lines.push(`  Attempts: ${result.attempt_count}`);
  lines.push('');

  const headers = ['Attempt', 'Tests Pass', 'Tests Fail', 'LOC +/-', 'Complexity'];
  const rows = result.attempts.map((a, idx) => [
    `#${a.attempt}`,
    a.tests_pass !== null ? String(a.tests_pass) : '-',
    a.tests_fail !== null ? String(a.tests_fail) : '-',
    a.loc_insertions !== null ? `+${a.loc_insertions}/-${a.loc_deletions}` : '-',
    a.complexity !== null ? String(a.complexity) : '-',
  ]);

  // Map column indices to metric keys for colorFn
  const colToMetric = [null, 'tests_pass', 'tests_fail', null, 'complexity'];
  // LOC column (3) needs special handling since it's a composite

  lines.push(formatTable(headers, rows, {
    showAll: true,
    colorFn: (value, colIdx, rowIdx) => {
      if (colIdx === 0) return String(value); // Attempt label
      const metric = colToMetric[colIdx];
      if (!metric) {
        // LOC column — color by net delta comparison
        if (result.best_per_metric.loc_insertions === rowIdx) return color.green(String(value));
        if (result.worst_per_metric.loc_insertions === rowIdx) return color.red(String(value));
        return String(value);
      }
      if (result.best_per_metric[metric] === rowIdx) return color.green(String(value));
      if (result.worst_per_metric[metric] === rowIdx) return color.red(String(value));
      return String(value);
    },
  }));

  lines.push('');
  lines.push(summaryLine(`Best attempt per metric highlighted in green`));
  lines.push(actionHint('trajectory choose <attempt-N>'));

  return lines.join('\n');
}
```

### Test Pattern

```javascript
// Source: derived from trajectory checkpoint test pattern
describe('trajectory compare', () => {
  let tmpDir;

  function initGitForCompare(dir) {
    fs.mkdirSync(path.join(dir, '.planning', 'memory'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dummy.txt'), 'hello');
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"',
      { cwd: dir, stdio: 'pipe' }
    );
  }

  function writeTrajectoryEntries(dir, entries) {
    const trajPath = path.join(dir, '.planning', 'memory', 'trajectory.json');
    fs.writeFileSync(trajPath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  test('compare shows metrics for multiple attempts', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      { id: 'tj-001', category: 'checkpoint', checkpoint_name: 'my-feat', scope: 'phase', attempt: 1,
        metrics: { tests: { total: 100, pass: 95, fail: 5 }, loc_delta: { insertions: 50, deletions: 10 }, complexity: { total: 15 } },
        tags: ['checkpoint'], timestamp: '2026-03-01T01:00:00Z' },
      { id: 'tj-002', category: 'checkpoint', checkpoint_name: 'my-feat', scope: 'phase', attempt: 2,
        metrics: { tests: { total: 100, pass: 100, fail: 0 }, loc_delta: { insertions: 30, deletions: 5 }, complexity: { total: 12 } },
        tags: ['checkpoint'], timestamp: '2026-03-01T02:00:00Z' },
    ]);
    const result = runGsdTools('trajectory compare my-feat', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.attempt_count, 2);
    assert.strictEqual(output.best_per_metric.tests_pass, 1); // attempt 2 (index 1) has more passing
    assert.strictEqual(output.best_per_metric.complexity, 1); // attempt 2 has lower complexity
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual git diff comparison | Structured metrics in journal entries | Phase 46 (2026-02-28) | Metrics auto-collected at checkpoint time |
| No trajectory system | Full checkpoint/pivot/compare/choose lifecycle | v7.1 (2026-02-28) | Structured exploration with decision journals |

**Key architecture insight:** The compare command is intentionally a *read-only* command. All metric collection happens at checkpoint time (Phase 46). This design decision means compare is fast (just JSON parsing) and deterministic (metrics don't change between comparisons).

## Data Structures Reference

### Journal Entry Schema (from checkpoint command)

```json
{
  "id": "tj-abc123",
  "timestamp": "2026-03-01T02:14:10.000Z",
  "category": "checkpoint",
  "text": "Checkpoint: my-feat (attempt 1)",
  "scope": "phase",
  "checkpoint_name": "my-feat",
  "attempt": 1,
  "branch": "trajectory/phase/my-feat/attempt-1",
  "git_ref": "abc1234...",
  "description": "First approach using X",
  "metrics": {
    "tests": { "total": 680, "pass": 680, "fail": 0 },
    "loc_delta": { "insertions": 150, "deletions": 30, "files_changed": 4 },
    "complexity": { "total": 45, "files_analyzed": 3 }
  },
  "tags": ["checkpoint"]
}
```

### Abandoned Entry Schema (from pivot command — EXCLUDE from compare)

```json
{
  "id": "tj-def456",
  "category": "checkpoint",
  "checkpoint_name": "my-feat",
  "attempt": 2,
  "branch": "archived/trajectory/phase/my-feat/attempt-2",
  "metrics": null,
  "reason": { "text": "JWT approach too complex" },
  "tags": ["checkpoint", "abandoned"]
}
```

### Compare Output Schema (what compare should produce)

```json
{
  "checkpoint": "my-feat",
  "scope": "phase",
  "attempt_count": 2,
  "attempts": [
    {
      "attempt": 1,
      "branch": "trajectory/phase/my-feat/attempt-1",
      "git_ref": "abc1234",
      "timestamp": "2026-03-01T01:00:00Z",
      "tests_pass": 95,
      "tests_fail": 5,
      "tests_total": 100,
      "loc_insertions": 50,
      "loc_deletions": 10,
      "complexity": 15
    },
    {
      "attempt": 2,
      "branch": "trajectory/phase/my-feat/attempt-2",
      "git_ref": "def5678",
      "timestamp": "2026-03-01T02:00:00Z",
      "tests_pass": 100,
      "tests_fail": 0,
      "tests_total": 100,
      "loc_insertions": 30,
      "loc_deletions": 5,
      "complexity": 12
    }
  ],
  "best_per_metric": {
    "tests_pass": 1,
    "tests_fail": 1,
    "loc_insertions": 1,
    "loc_deletions": 1,
    "complexity": 1
  },
  "worst_per_metric": {
    "tests_pass": 0,
    "tests_fail": 0,
    "loc_insertions": 0,
    "loc_deletions": 0,
    "complexity": 0
  }
}
```

## Open Questions

1. **Should compare accept no name and list all unique checkpoint names?**
   - What we know: Pivot requires a name. List shows all.
   - What's unclear: Should `trajectory compare` (no args) list available names for comparison?
   - Recommendation: Require a name (like pivot). Show available names in error message if not found.

2. **Should abandoned attempts be optionally included?**
   - What we know: They typically have null metrics.
   - What's unclear: Users might want to see why an attempt was abandoned alongside comparison.
   - Recommendation: Exclude by default (they have no metrics). Could add `--include-abandoned` later if needed.

3. **Net LOC as separate metric?**
   - What we know: `loc_delta` stores insertions and deletions separately.
   - What's unclear: Should compare show insertions, deletions, AND net (insertions - deletions)?
   - Recommendation: Show `+insertions/-deletions` as one column (compact), compute net internally for best/worst determination.

## Sources

### Primary (HIGH confidence)
- `src/commands/trajectory.js` — checkpoint, list, pivot command implementations (direct code inspection)
- `src/lib/format.js` — formatTable with colorFn option, color utilities (direct code inspection)
- `src/lib/output.js` — dual-mode output pattern (direct code inspection)
- `src/lib/ast.js` — computeComplexity function signature and return type (direct code inspection)
- `src/lib/git.js` — diffSummary function for LOC metrics (direct code inspection)
- `src/router.js` — trajectory switch block pattern (direct code inspection)
- `.planning/phases/47-*/47-01-SUMMARY.md` — pivot implementation decisions (direct doc)
- `.planning/phases/47-*/47-02-SUMMARY.md` — selectiveRewind fix, 728 tests passing (direct doc)

### Secondary (MEDIUM confidence)
- Journal entry schema inferred from checkpoint command code — consistent with test assertions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are in the codebase, directly inspected
- Architecture: HIGH — patterns directly copied from list/pivot commands in same file
- Pitfalls: HIGH — derived from code inspection of null handling patterns and test patterns
- Data structures: HIGH — journal schema verified from checkpoint command + test assertions

**Research date:** 2026-03-01
**Valid until:** 2026-03-15 (stable codebase, patterns won't change within milestone)
