# Architecture Research: v7.1 Trajectory Engineering

**Domain:** CLI-based trajectory engineering for AI-driven planning workflows  
**Researched:** 2026-02-28  
**Overall confidence:** HIGH  
**Mode:** Integration architecture for existing 34-module codebase

## Executive Summary

Trajectory engineering adds four commands (checkpoint, pivot, compare, choose) and a decision journal to an existing 34-module CLI (18 lib + 13 commands + router + index). The core question is: **how do code state snapshots (git) bond with reasoning state (decisions, metrics, context)?**

The answer: **a thin `src/lib/trajectory.js` library module owns the data model and git operations, `src/commands/trajectory.js` handles CLI routing, and the decision journal extends the existing `memory.js` sacred store pattern.** Git operations use existing `git.js` primitives (execGit, branchInfo, diffSummary). State integration uses existing `state.js` field helpers. No new subsystem — this threads through existing modules.

## System Overview

### Current Architecture (34 modules)

```
src/index.js → src/router.js → src/commands/*.js (13 modules)
                                  ↓ imports
                               src/lib/*.js (18 modules)
```

### New Components for v7.1

```
NEW:  src/lib/trajectory.js     — Trajectory lifecycle, state machine, git operations
NEW:  src/commands/trajectory.js — CLI handlers: checkpoint, pivot, compare, choose, list, cleanup
MOD:  src/router.js             — Add trajectory command routing (lazy loader)
MOD:  src/lib/constants.js      — COMMAND_HELP entries for new commands
MOD:  src/commands/memory.js    — Add 'trajectories' to VALID_STORES + SACRED_STORES
MOD:  src/commands/init.js      — Inject trajectory context into init payloads
```

### Module Count Impact

| Before | After | Delta |
|--------|-------|-------|
| 18 lib | 19 lib | +1 (trajectory.js) |
| 13 commands | 14 commands | +1 (trajectory.js) |
| 34 total | 36 total | +2 |

## Component Responsibilities

### src/lib/trajectory.js (NEW — ~400 lines estimated)

**Responsibility:** Pure trajectory logic — data model, state machine, git operations for checkpoint/pivot/compare/choose. No CLI concerns (no output(), no formatting).

**Why a lib module, not just a command?** The trajectory logic needs to be testable independently of CLI routing. Other modules (init.js, stuck-detector.js) need to query trajectory state. Separating logic from CLI follows the git.js/worktree.js precedent.

**Key functions:**

```javascript
// State machine
createTrajectory(cwd, scope, name, opts)    // Initialize trajectory record
getActiveTrajectory(cwd, scope)              // Find active trajectory for scope
getTrajectoryState(cwd, trajectoryId)        // Current state of a trajectory

// Checkpoint
createCheckpoint(cwd, trajectoryId, name)    // Git tag + journal entry
collectMetrics(cwd, baseRef, currentRef)     // LOC, files, complexity
collectCheapMetrics(cwd, baseRef, currentRef) // LOC + files only (fast)

// Pivot  
archiveAttempt(cwd, trajectoryId, attemptN)  // Branch current work
rewindToCheckpoint(cwd, checkpointRef, opts) // Selective file reset
startNewAttempt(cwd, trajectoryId)           // Increment attempt, new branch

// Compare
compareAttempts(cwd, trajectoryId)           // Aggregate metrics across attempts
detectSignals(metrics)                       // Flag regressions/improvements

// Choose
mergeAttempt(cwd, trajectoryId, attemptN)    // Merge winner, archive rest
cleanupTrajectory(cwd, trajectoryId)         // Remove tags/branches
```

**Depends on:** `git.js` (execGit, branchInfo, diffSummary), `ast.js` (computeComplexity), `fs`

### src/commands/trajectory.js (NEW — ~350 lines estimated)

**Responsibility:** CLI command handlers — parse args, call lib/trajectory.js, format output.

**Commands:**

| Command | Handler | Calls |
|---------|---------|-------|
| `trajectory checkpoint <name>` | `cmdTrajectoryCheckpoint` | `createTrajectory`, `createCheckpoint`, `collectMetrics` |
| `trajectory pivot <checkpoint> --reason <text>` | `cmdTrajectoryPivot` | `archiveAttempt`, `rewindToCheckpoint`, `startNewAttempt` |
| `trajectory compare [--scope <scope>]` | `cmdTrajectoryCompare` | `compareAttempts`, `detectSignals` |
| `trajectory choose <attempt-N> [--reason <text>]` | `cmdTrajectoryChoose` | `mergeAttempt`, `cleanupTrajectory` |
| `trajectory list [--scope <scope>]` | `cmdTrajectoryList` | `getActiveTrajectory`, journal query |
| `trajectory check-dead-ends [--approach <desc>]` | `cmdTrajectoryDeadEnds` | Journal keyword search |
| `trajectory cleanup [--scope <scope>]` | `cmdTrajectoryCleanup` | `cleanupTrajectory` |

**Depends on:** `lib/trajectory.js`, `lib/output.js`, `lib/format.js`

### Decision Journal (extends memory.js)

**Storage:** `.planning/memory/trajectory.json` — array of journal entries. Sacred store (never auto-compacted).

**Integration approach:** Minimal change to `memory.js`:
1. Add `'trajectories'` to `VALID_STORES` array
2. Add `'trajectories'` to `SACRED_STORES` array
3. All existing `cmdMemoryWrite/Read/List` work automatically

**Journal read/write in trajectory.js:** Direct `fs.readFileSync/writeFileSync` on the JSON file (same pattern as memory.js internals), not routing through the CLI command interface.

## Data Flow

### Checkpoint Flow

```
User: gsd-tools trajectory checkpoint "baseline"
  ↓
router.js → commands/trajectory.js cmdTrajectoryCheckpoint
  ↓
lib/trajectory.js createTrajectory()
  ├── git.js branchInfo() → check for dirty files, get current branch
  ├── git.js execGit(['rev-parse', 'HEAD']) → capture SHA
  ├── git.js execGit(['tag', tagName]) → create checkpoint tag
  ├── collectCheapMetrics() → git diff --shortstat
  └── Write journal entry to .planning/memory/trajectory.json
  ↓
commands/trajectory.js → output(result, {formatter})
```

### Pivot Flow

```
User: gsd-tools trajectory pivot "baseline" --reason "test regressions"
  ↓
router.js → commands/trajectory.js cmdTrajectoryPivot
  ↓
lib/trajectory.js
  ├── getActiveTrajectory() → find current trajectory
  ├── branchInfo() → safety check (dirty files → refuse)
  ├── collectMetrics() → snapshot current attempt state
  ├── Write journal entry (type: pivot, outcome: abandoned)
  ├── git commit .planning/ → protect journal from reset
  ├── archiveAttempt() → git branch gsd/archive/...
  ├── rewindToCheckpoint()
  │   ├── git checkout <checkpointRef> -- src/ test/ bin/  (selective)
  │   └── .planning/ stays untouched (NOT reset)
  └── startNewAttempt() → increment counter, new branch
  ↓
output(result, {formatter})
```

### Compare Flow

```
User: gsd-tools trajectory compare
  ↓
commands/trajectory.js cmdTrajectoryCompare
  ↓
lib/trajectory.js
  ├── Read journal for active trajectory
  ├── For each attempt:
  │   ├── git diff --shortstat checkpointRef..attemptRef → LOC delta
  │   ├── git diff --numstat → file list
  │   ├── git show <ref>:<file> → read code without checkout
  │   ├── ast.js computeComplexity() with {code} option → complexity
  │   └── Read cached test results from journal
  ├── detectSignals() → flag regressions/improvements
  └── Build comparison matrix
  ↓
output(result, {formatter: formatComparisonTable})
```

### Choose Flow

```
User: gsd-tools trajectory choose 2 --reason "clean approach, all tests pass"
  ↓
commands/trajectory.js cmdTrajectoryChoose
  ↓
lib/trajectory.js
  ├── Read journal → verify attempt 2 exists
  ├── git merge-tree --write-tree base winner → dry-run conflict check
  │   └── If conflicts: return error (reuse worktree.js patterns)
  ├── git merge winner --no-ff -m "trajectory: chose attempt 2"
  ├── For non-chosen attempts: tag as gsd/archive/...
  ├── Remove trajectory branches and checkpoint tags
  ├── Write journal entry (type: choose)
  └── Update STATE.md trajectory field
  ↓
output(result, {formatter})
```

## Patterns to Follow

### Pattern 1: Selective Checkout (not reset --hard)

**What:** Reset source files to checkpoint state without touching `.planning/`.
**When:** Pivot command needs to rewind code but preserve journal/state.
**Why:** `git reset --hard` resets everything including the journal. Selective checkout is surgical.

```javascript
function rewindToCheckpoint(cwd, checkpointRef, opts) {
  // Get list of source directories to rewind
  const sourceDirs = opts.sourceDirs || ['src/', 'test/', 'bin/'];
  
  // Selective checkout — only rewind source code
  for (const dir of sourceDirs) {
    execGit(cwd, ['checkout', checkpointRef, '--', dir]);
  }
  // .planning/ is untouched — journal, state, config all preserved
}
```

### Pattern 2: Metrics Without Checkout (git show)

**What:** Read file contents at any git ref without switching branches.
**When:** Compare command needs complexity metrics for multiple attempts.
**Why:** Checking out each branch to measure it is slow and disruptive.

```javascript
function getFileAtRef(cwd, ref, filePath) {
  const result = execGit(cwd, ['show', `${ref}:${filePath}`]);
  if (result.exitCode !== 0) return null;
  return result.stdout;
}

function complexityAtRef(cwd, ref, filePath) {
  const code = getFileAtRef(cwd, ref, filePath);
  if (!code) return null;
  // computeComplexity needs enhancement to accept {code} option
  return computeComplexityFromCode(filePath, code);
}
```

### Pattern 3: Journal-First Operations

**What:** Write the journal entry before any destructive git operation.
**When:** Every command that modifies git state (checkpoint tag, pivot reset, choose merge).
**Why:** If the git operation fails, the journal still records what was attempted. If the git operation succeeds but the journal write fails, we have orphaned git state but no record of it.

```javascript
function pivotToCheckpoint(cwd, trajectoryId, reason) {
  // 1. Write journal entry FIRST
  writeJournalEntry({ type: 'pivot', reason, timestamp: new Date().toISOString() });
  
  // 2. Commit journal to protect it from reset
  execGit(cwd, ['add', '.planning/memory/trajectory.json']);
  execGit(cwd, ['commit', '-m', 'trajectory: record pivot decision']);
  
  // 3. NOW do the destructive operation
  archiveAttempt(cwd, trajectoryId);
  rewindToCheckpoint(cwd, checkpointRef);
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Full Worktree Per Attempt

**What:** Creating a separate git worktree for each exploration attempt.
**Why bad:** Worktrees consume disk (~2-4GB each for large projects). Sequential exploration doesn't need parallel isolation. Worktrees are for parallel plans (v4.0), not sequential attempts.
**Instead:** Use branches on the main worktree. Branches are free (just a ref pointer).

### Anti-Pattern 2: Journal in Markdown

**What:** Storing the decision journal as a markdown file with section headers.
**Why bad:** Markdown parsing is fragile (309+ regex patterns already). JSON is directly parseable by agents. Appending to markdown risks section boundary corruption.
**Instead:** JSON array in `.planning/memory/trajectory.json`, same as all other memory stores.

### Anti-Pattern 3: Global Trajectory State

**What:** Storing "current trajectory" in a global variable or top-level STATE.md field.
**Why bad:** Multiple scopes (task, plan, phase) may have independent trajectories. A global pointer can only track one.
**Instead:** Each trajectory record has a scope ID. `getActiveTrajectory(cwd, scope)` queries by scope.

### Anti-Pattern 4: Re-running Tests Inside Compare

**What:** The compare command runs the test suite for each attempt to get fresh metrics.
**Why bad:** Running tests N times for N attempts is expensive. Tests may have side effects. Results should be identical to when the attempt was active.
**Instead:** Capture test metrics at checkpoint/pivot time. Compare reads from journal, never re-runs.

## Scalability Considerations

| Concern | At 5 attempts | At 20 attempts | At 100+ attempts |
|---------|--------------|----------------|------------------|
| Journal size | ~2KB | ~8KB | ~40KB (fine) |
| Branch count | 5 gsd/* branches | 20 branches | Cleanup needed |
| Compare speed | Instant | <1s | Need pagination |
| Tag count | 5 tags | 20 tags | Cleanup needed |
| Agent context load | ~500 tokens | ~2000 tokens | Need summarization |

100+ attempts per scope is unrealistic. The practical limit is 5-10 before the developer chooses. The cleanup command handles post-choice garbage collection.

## Sources

- Existing codebase architecture: `src/router.js` (lazy loading pattern), `src/lib/git.js` (execGit pattern), `src/commands/worktree.js` (merge pattern), `src/commands/memory.js` (sacred store pattern)
- Git documentation: `git-checkout(1)` selective path reset, `git-show(1)` file-at-ref, `git-merge-tree(1)` dry-run merge
- v7.0 architectural decisions: "intelligence as data, not agents" — trajectory follows this by being CLI data for existing agents
