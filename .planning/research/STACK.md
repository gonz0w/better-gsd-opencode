# Stack Research: v7.1 Trajectory Engineering

**Researched:** 2026-02-28
**Focus:** Stack additions needed for checkpoint/pivot/compare/choose workflow, decision journals, metrics collection
**Overall confidence:** HIGH

## Executive Summary

**No new runtime dependencies required.** All trajectory engineering features are implementable with the existing stack: Node.js built-ins (`child_process`, `fs`, `path`, `crypto`) + existing `git.js` `execGit()` wrapper + existing `ast.js` complexity metrics. The decision journal is a JSON file (following the `memory.js` dual-store pattern). Branch operations use the same `execFileSync('git', args)` pattern proven in `git.js` and `worktree.js`.

This is a code-and-architecture milestone, not a dependency milestone.

## Recommended Stack Additions

### New Runtime Dependencies: NONE

The existing stack covers every requirement:

| Requirement | Existing Capability | Module |
|---|---|---|
| Git branch create/checkout/merge | `execGit(cwd, ['branch', ...])` | `src/lib/git.js` |
| Git tag for checkpoints | `execGit(cwd, ['tag', ...])` | `src/lib/git.js` |
| Git diff between attempts | `diffSummary(cwd, {from, to})` | `src/lib/git.js` |
| Complexity metrics | `computeComplexity(filePath)` | `src/lib/ast.js` |
| LOC counting | `git diff --shortstat` via `execGit` | `src/lib/git.js` |
| Test result parsing | Existing `test-run` slash command | `commands/misc.js` |
| Decision journal storage | JSON file in `.planning/memory/` | `src/commands/memory.js` pattern |
| State serialization | `JSON.stringify/parse` + markdown patches | `src/commands/state.js` |
| Unique attempt IDs | `crypto.randomUUID()` (Node 19+) or `Date.now()` fallback | Node.js built-in |
| File hashing for integrity | `crypto.createHash('sha256')` | Node.js built-in |

### New Dev Dependencies: NONE

The existing esbuild pipeline handles bundling of any new `src/` modules.

## Git Operations Inventory for Trajectory Engineering

All operations below use the proven `execGit(cwd, args)` pattern from `git.js`. No shell spawning, no new dependencies.

### Checkpoint (snapshot code state + metadata)

```javascript
// 1. Create lightweight tag at current HEAD
execGit(cwd, ['tag', tagName])                    // e.g., 'gsd/checkpoint/task-42-01/baseline'

// 2. Optionally create a branch for the attempt
execGit(cwd, ['branch', branchName])               // e.g., 'gsd/trajectory/task-42-01/attempt-1'

// 3. Capture HEAD SHA for the journal
execGit(cwd, ['rev-parse', 'HEAD'])
```

**Why tags over stash:** Tags are named, persistent, branch-agnostic, and show up in `git log --all`. Stash is a stack (unnamed, single-branch, easy to lose). Tags also work across sessions — stash doesn't survive `git stash clear`. Tags are the correct primitive for named checkpoints. [HIGH confidence — well-established git pattern]

**Why lightweight tags over annotated:** Annotated tags are for releases. Lightweight tags are metadata-free pointers — exactly what we need for cheap, disposable checkpoints. We store the rich metadata (reasoning, context, metrics) in the decision journal JSON, not in git objects. [HIGH confidence]

### Pivot (abandon approach, rewind to checkpoint)

```javascript
// 1. Record current attempt state before rewinding
execGit(cwd, ['rev-parse', 'HEAD'])                // Capture the "abandoned" SHA
execGit(cwd, ['diff', '--shortstat', checkpointRef, 'HEAD'])  // Delta from checkpoint

// 2. Save current work on a named branch (archive, don't delete)
execGit(cwd, ['branch', archiveBranch])            // e.g., 'gsd/archive/task-42-01/attempt-1'

// 3. Reset to checkpoint (hard reset — code rewinds)
execGit(cwd, ['reset', '--hard', checkpointTag])

// Safety: branchInfo() check for dirty files before hard reset
// Safety: archive branch created before any destructive operation
```

**Why `reset --hard` over `checkout`:** We want to rewind the working directory to the checkpoint state. `checkout` changes branches; `reset --hard` changes HEAD position on the current branch. Since we've already archived the work on a branch, a hard reset is safe and correct. [HIGH confidence]

### Compare (metrics across attempts)

```javascript
// For each attempt branch:
execGit(cwd, ['diff', '--shortstat', baseRef, attemptRef])     // LOC delta
execGit(cwd, ['diff', '--numstat', baseRef, attemptRef])       // Per-file delta
execGit(cwd, ['log', '--oneline', `${baseRef}..${attemptRef}`]) // Commit count

// Complexity: checkout attempt → run computeComplexity() → checkout back
// Or: use `git show <ref>:<file>` to read file at specific ref without checkout
execGit(cwd, ['show', `${attemptRef}:${filePath}`])
```

**`git show <ref>:<file>` for diffless metrics:** This lets us read any file at any commit without switching branches. We can compute complexity/LOC for multiple attempts without checkout churn. [HIGH confidence — standard git plumbing]

**Test metrics:** The `test-run` command already parses test output (pass/fail/skip counts). For comparison, we need to store the metrics at checkpoint time. The journal captures `{tests_pass, tests_fail, tests_skip}` as part of the attempt record.

### Choose (merge winner, archive rest)

```javascript
// 1. Merge the winning attempt
execGit(cwd, ['merge', winnerBranch, '--no-ff',
  '-m', `trajectory: chose attempt ${n} for ${taskId}`])

// 2. Already-archived branches stay as-is (named refs)
// 3. Clean up tags (optional)
execGit(cwd, ['tag', '-d', checkpointTag])          // Remove checkpoint tag if desired
```

**Leverages existing worktree merge pattern:** `cmdWorktreeMerge` in `worktree.js` already handles merge-tree dry-run, conflict detection, auto-resolution of lockfiles. The trajectory `choose` command can reuse `parseMergeTreeConflicts()` and `isAutoResolvable()`. [HIGH confidence — proven in v4.0]

## Decision Journal Storage Format

### Why JSON (not Markdown)

| Criterion | JSON | Markdown |
|---|---|---|
| Agent consumption | Native parse, zero ambiguity | Regex parsing, fragile |
| Human readability | Readable with `jq` or formatted output | Native |
| Queryable | Direct field access | Regex search |
| Append-safe | Array push + write | Section append, conflict-prone |
| Already proven | `memory.js` stores decisions/lessons as JSON | STATE.md is markdown |

**Decision:** JSON primary store (`.planning/memory/trajectory.json`), with optional markdown report generation for human review. Follows the dual-store pattern established in v2.0.

### Journal Entry Schema

```json
{
  "id": "traj-1709123456789",
  "scope": "task",
  "scope_id": "42-01",
  "phase": "45",
  "created": "2026-02-28T12:00:00Z",
  "checkpoint": {
    "name": "baseline",
    "tag": "gsd/checkpoint/45-42-01/baseline",
    "sha": "abc123def456",
    "metrics": {
      "tests_pass": 669,
      "tests_fail": 0,
      "tests_skip": 3,
      "complexity_total": 142,
      "loc_delta": 0,
      "files_changed": 0
    }
  },
  "attempts": [
    {
      "number": 1,
      "branch": "gsd/trajectory/45-42-01/attempt-1",
      "started": "2026-02-28T12:01:00Z",
      "ended": "2026-02-28T12:30:00Z",
      "outcome": "abandoned",
      "reason": "Approach created circular dependency between git.js and trajectory.js",
      "metrics": {
        "tests_pass": 665,
        "tests_fail": 4,
        "tests_skip": 3,
        "complexity_total": 158,
        "loc_delta": 247,
        "files_changed": 5,
        "commits": 3
      },
      "signals": ["test_regression", "complexity_increase"]
    },
    {
      "number": 2,
      "branch": "gsd/trajectory/45-42-01/attempt-2",
      "started": "2026-02-28T12:31:00Z",
      "ended": "2026-02-28T13:15:00Z",
      "outcome": "chosen",
      "reason": "Clean separation of concerns, all tests pass, lower complexity",
      "metrics": {
        "tests_pass": 675,
        "tests_fail": 0,
        "tests_skip": 3,
        "complexity_total": 148,
        "loc_delta": 189,
        "files_changed": 4,
        "commits": 4
      },
      "signals": ["all_tests_pass", "complexity_stable"]
    }
  ],
  "decision": {
    "chosen_attempt": 2,
    "rationale": "Attempt 2 maintained test health while adding new functionality",
    "merged_sha": "def789abc012"
  }
}
```

### Storage Location

`.planning/memory/trajectory.json` — Array of journal entries. Follows `memory.js` conventions:
- Sacred data (like `decisions.json` and `lessons.json`) — never auto-compacted
- Readable by `memory read --store trajectory`
- Queryable by phase, scope, outcome

## Metrics Collection Strategy

### What to Collect

| Metric | Source | Collection Method |
|---|---|---|
| Test pass/fail/skip | Test runner output | Parse `node --test` output (existing `test-run` command) |
| Total complexity | AST analysis | `computeComplexity()` from `ast.js` over source files |
| LOC delta | Git diff | `git diff --shortstat checkpoint..HEAD` |
| Files changed | Git diff | `git diff --numstat checkpoint..HEAD` |
| Commit count | Git log | `git log --oneline checkpoint..HEAD \| wc -l` |
| Duration | Wall clock | `Date.now()` delta between attempt start/end |

### What NOT to Collect

| Metric | Why Skip |
|---|---|
| Code coverage % | Requires coverage tool integration, out of scope |
| Build time | Not relevant for CLI tool with no build step at runtime |
| Memory usage | Not meaningful for short-lived CLI process |
| Performance benchmarks | No existing perf framework, marginal value |

### Collection Without Checkout Churn

For comparing attempts without switching branches, use `git show <ref>:<file>` to read files at specific commits. The `computeComplexity()` function in `ast.js` accepts `{code: string}` via the options parameter on `extractSignatures()` — we can pass code read from `git show` directly without writing temp files.

```javascript
// Read file at specific commit
const code = execGit(cwd, ['show', `${ref}:${filePath}`]).stdout;
// Compute complexity without checkout
const result = extractSignatures(filePath, { code });
```

**Note:** `computeComplexity()` currently reads from disk. For trajectory comparison, either:
1. Add `{code}` option to `computeComplexity()` (preferred — 3-line change), or
2. Use `git stash` + checkout + measure + restore (fragile, slow)

Option 1 is clearly better. [HIGH confidence]

## Branch Naming Convention

```
gsd/checkpoint/<phase>-<plan>/<name>          # Tags for checkpoints
gsd/trajectory/<phase>-<plan>/attempt-<N>     # Branches for attempts
gsd/archive/<phase>-<plan>/attempt-<N>        # Renamed after trajectory closes
```

**Why `gsd/` prefix:** Avoids collision with user branches. Easy to list/cleanup: `git branch --list 'gsd/*'` or `git tag --list 'gsd/*'`.

**Why hierarchical:** `git branch --list 'gsd/trajectory/45-*'` shows all trajectories for phase 45. Clean namespace.

## New Source Module Plan

| Module | Purpose | Depends On |
|---|---|---|
| `src/lib/trajectory.js` | Core trajectory logic (checkpoint, pivot, compare, choose) | `git.js`, `ast.js` |
| `src/commands/trajectory.js` | CLI command handlers for `trajectory checkpoint/pivot/compare/choose` | `trajectory.js`, `output.js`, `format.js`, `memory.js` pattern |

**Two new modules, following existing patterns.** `trajectory.js` is a lib (pure logic, tested independently). `commands/trajectory.js` is the CLI interface (routes args, formats output). Matches the `git.js`/`worktree.js` split and the `lib/` vs `commands/` convention.

**Router addition:** One new lazy loader in `router.js`:
```javascript
function lazyTrajectory() { return _modules.trajectory || (_modules.trajectory = require('./commands/trajectory')); }
```

## What NOT to Add

| Temptation | Why Resist |
|---|---|
| **isomorphic-git** | 500KB+ JavaScript git implementation. We already have `execGit()` calling the real git binary — faster, smaller, more correct. Adding isomorphic-git would double the bundle for zero benefit. |
| **nodegit** | Native libgit2 bindings. Requires C++ compilation, platform-specific binaries. Breaks single-file deploy. Our `execFileSync` pattern is 301 lines and covers everything. |
| **simple-git** | Promise-based git wrapper. Adds async complexity we don't need (CLI is synchronous). Our `execGit` is 28 lines and does the same thing. |
| **diff / jsdiff** | Text diff library. We don't need unified diffs — we need `--numstat` and `--shortstat` numbers from git. Git's diff is better than any JS reimplementation. |
| **sloc / cloc** | Lines-of-code counter libraries. `git diff --shortstat` gives us LOC deltas. `computeComplexity()` gives us complexity. No need for a third tool. |
| **SQLite / better-sqlite3** | For trajectory journal storage. JSON file + memory.js pattern is proven, zero deps, and sufficient for the expected data volume (~10-50 entries per milestone). |
| **uuid** | For trajectory IDs. `Date.now()` + scope gives unique-enough IDs. `crypto.randomUUID()` available in Node 19+. No need for a 3rd-party UUID. |
| **chalk / kleur** | For colored output. `format.js` already has ~2KB inline picocolors-pattern color utility. |

## Compatibility Notes

### Git Version Requirements

- **Git 2.38+** — Required for `git merge-tree --write-tree` (already required since v4.0 worktree feature)
- **Git 2.23+** — `git switch`/`git restore` available but we use `reset --hard` which works on all versions
- No new git version requirements beyond what v4.0 already established

### Node.js Version Requirements

- **Node.js 18+** — Already the minimum (package.json `engines`). `crypto.createHash()` available since Node.js 0.x. `crypto.randomUUID()` added in Node.js 19 — use `Date.now()` fallback for Node 18.
- No new Node.js version requirements

### Bundle Size Impact

- **Estimated addition:** ~300-500 lines across two new modules (`trajectory.js` + `commands/trajectory.js`)
- **Bundle impact:** ~2-4KB added to the ~1000KB bundle. Negligible.
- **No new bundled dependencies**

### Integration with Existing Systems

| Existing System | Integration Point |
|---|---|
| `git.js` `execGit()` | All git operations go through this. No changes needed to `execGit`. |
| `git.js` `branchInfo()` | Used for safety checks (dirty files, detached HEAD) before trajectory operations |
| `git.js` `diffSummary()` | Used for LOC/file metrics between checkpoint and attempt HEAD |
| `ast.js` `computeComplexity()` | Needs minor enhancement: accept `{code}` option to compute without disk read |
| `memory.js` pattern | `trajectory.json` follows same sacred-store pattern as `decisions.json` |
| `state.js` `cmdStateAddDecision()` | Trajectory decisions auto-recorded in STATE.md decisions section |
| `worktree.js` merge pattern | `parseMergeTreeConflicts()` and `isAutoResolvable()` reusable for trajectory merge |
| `format.js` | Comparison table output uses `formatTable()`, attempt status uses `progressBar()` |
| `output.js` | Standard `output(result, {formatter})` dual-mode pattern |
| `router.js` | New lazy-loaded command module, new command routes |

## Sources

- Node.js `child_process` documentation (Context7, HIGH confidence)
- Git documentation: `git-tag(1)`, `git-branch(1)`, `git-reset(1)`, `git-merge-tree(1)`, `git-show(1)`, `git-diff(1)` — all stable plumbing commands
- Existing codebase: `src/lib/git.js` (301 lines), `src/commands/worktree.js` (791 lines), `src/lib/ast.js` (1192 lines), `src/commands/memory.js` (307 lines) — direct code review
- Community consensus: branches > stash for named checkpoints, lightweight tags > annotated for disposable snapshots (Stack Overflow, Reddit r/git, Software Engineering SE — multiple sources agree)
