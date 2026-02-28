# Feature Landscape: v7.1 Trajectory Engineering

**Domain:** Structured exploration system for AI-driven development workflows
**Researched:** 2026-02-28
**Overall confidence:** HIGH (git primitives proven, decision journal patterns well-established, comparison metrics available via existing ast.js)

## Executive Summary

Trajectory engineering adds a structured exploration layer on top of existing git operations and state management. The core insight: AI agents frequently explore dead ends, but current tools have no mechanism to capture *why* an approach failed or *what signals* differentiated a winning approach. The result is repeated exploration of known dead-ends across sessions.

This feature set builds four commands (checkpoint, pivot, compare, choose) on top of existing git.js branching + memory.js decision stores + ast.js complexity metrics. The decision journal is the centerpiece — it's what makes this more than "git branch with extra steps." MIT's EnCompass research (NeurIPS 2025) validates the core pattern: branchpoints + backtracking + parallel exploration = better agent outcomes. The difference: EnCompass operates at the LLM call level; GSD operates at the task/plan/phase level with git-backed code state.

**Key dependencies on existing modules:**
- `git.js`: execGit, branchInfo, diffSummary, structuredLog — all needed, no changes required
- `worktree.js`: parsePlanId, getWorktreeConfig — reusable patterns, may need minor extensions
- `memory.js`: decisions store — extend schema for trajectory entries (backward compatible)
- `state.js`: stateExtractField, cmdStatePatch — track active trajectory in STATE.md
- `ast.js`: computeComplexity — key metric for compare command
- `stuck-detector.js`: isStuck detection — natural trigger for suggesting pivot

---

## Table Stakes

Features users expect from an exploration system. Missing = system feels like "just git branching."

| Feature | Why Expected | Complexity | Depends On | Notes |
|---------|--------------|------------|------------|-------|
| Named checkpoint creation | Users need semantic names, not just git SHAs | Low | git.js (execGit, branchInfo) | `git tag` + metadata file, not `git stash` — stashes are unnamed and fragile |
| Checkpoint listing with metadata | Must see what was saved and when | Low | git.js (execGit), fs | List tags/branches with associated context files |
| Rewind to checkpoint (pivot) | Core value prop — rollback code state | Med | git.js (execGit) | `git checkout` or `git reset` to tagged commit, preserve `.planning/` |
| Reason capture on pivot | Without "why," pivots are just git resets | Low | memory.js (decisions store) | Structured entry: what failed, why, what signals indicated failure |
| Comparison metrics: test results | Tests are the primary objective signal | Med | existing test runner integration | Parse test output for pass/fail/skip counts per attempt |
| Comparison metrics: LOC delta | Quick size comparison between approaches | Low | git.js (diffSummary) | Already computes insertions/deletions between refs |
| Comparison metrics: complexity | Cyclomatic complexity per approach | Med | ast.js (computeComplexity) | Already implemented, just needs cross-ref collection |
| Choose winner and archive losers | Must merge back cleanly, preserve alternatives | Med | git.js (execGit), worktree.js patterns | `git merge` winner branch, tag/archive loser branches |
| Decision journal append | Every checkpoint/pivot/choose writes a structured record | Low | memory.js, fs | JSON append to `.planning/memory/trajectories.json` |
| Session-portable journal | Journal survives session boundaries | Low | memory.js (sacred store) | Add `trajectories` as a sacred (never-compacted) store |

---

## Differentiators

Features that set this apart from "just use git branches." Not expected, but high value.

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---------|-------------------|------------|------------|-------|
| Dead-end detection from journal | Agents read journal before starting — skip known-bad approaches | Med | memory.js (trajectories store) | Query: "has this approach been tried before?" Return: attempt count + failure reasons |
| Signal-based comparison matrix | Automated table comparing attempts across multiple dimensions | Med | ast.js, git.js, test runner | Aggregate: tests, LOC, complexity, files changed, duration — render as formatTable |
| Stuck→Pivot integration | When stuck-detector fires, auto-suggest pivot to last checkpoint | Low | stuck-detector.js, checkpoint store | Wire stuck detection → recovery → checkpoint lookup |
| Multi-level trajectories | Same commands work at task, plan, and phase level | Med | state.js (phase/plan tracking) | Checkpoint name includes scope: `phase-45/plan-01/attempt-2` |
| Agent-consumable decision trail | init commands inject relevant trajectory context | Med | init.js integration | `init execute-phase` includes "previous attempts" section from journal |
| Attempt branch naming convention | Predictable `trajectory/<scope>/<name>/attempt-N` pattern | Low | git.js (execGit) | Enables discovery without explicit tracking |
| Metrics snapshot at checkpoint | Auto-capture test count, complexity, LOC at each checkpoint | Med | ast.js, git.js | Stored in checkpoint metadata — enables trend analysis |
| Context bridging across attempts | Carry forward lessons learned from failed attempts into next attempt context | Med | memory.js, workflow injection | Key insight from each pivot becomes "what NOT to do" context |
| Comparison visualization (TTY) | Human-readable comparison table with color-coded winners | Low | format.js (formatTable, color) | Green for best metric, red for worst, dim for equal |
| Automatic archival tagging | Losers get `archived/trajectory/<name>` tags, not deleted | Low | git.js (execGit) | Preserve for future reference; `git tag` is cheap |

---

## Anti-Features

Features to explicitly NOT build. Each represents a trap that would increase complexity without proportional value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full git worktree per attempt | Disk-expensive (~2-4GB each), unnecessary for sequential exploration | Use branches on main worktree. Worktrees are for *parallel* plans, not sequential attempts at the same task |
| Automatic pivot without human signal | AI shouldn't autonomously abandon approaches — human-in-the-loop is a core principle | Stuck-detector *suggests* pivot, human/workflow decides |
| Diff viewer / code comparison UI | Out of scope for CLI tool; `git diff` already exists | Provide metrics comparison (LOC, complexity, tests) not code-level diff |
| Undo/redo stack | Git already is an undo system; adding another layer causes confusion | Checkpoints + named branches are the undo mechanism |
| Automatic "best approach" selection | Metrics inform but don't decide — context matters beyond numbers | Compare command presents data; Choose command requires explicit selection |
| Database for trajectory storage | SQLite/etc. is explicitly out of scope; JSON files work fine for this volume | `.planning/memory/trajectories.json` — same sacred store pattern as decisions |
| Cross-repository trajectory sharing | Trajectories are project-specific; sharing adds complexity with no clear value | Each project has its own trajectory journal |
| Visual branch graph rendering | ASCII art branch graphs are fragile and low-value compared to `git log --graph` | Provide structured JSON; let tools render |
| Parallel attempt exploration | Running multiple approaches simultaneously requires worktree + orchestrator changes far beyond scope | Sequential exploration: checkpoint → try → pivot if bad → try again |
| Trajectory "playback" / replay | Recording and replaying exact agent actions is fragile and version-sensitive | Record *decisions and signals*, not actions |

---

## Feature Dependencies

```
                          ┌─────────────────────┐
                          │   Decision Journal   │ (trajectories.json)
                          │  (sacred store in    │
                          │   memory.js)         │
                          └──────────┬──────────┘
                                     │
                    writes to ───────┼──────── reads from
                    │                │                │
            ┌───────┴──────┐  ┌─────┴──────┐  ┌─────┴──────────┐
            │  Checkpoint  │  │    Pivot    │  │ Dead-End Check │
            │  (git tag +  │  │ (rewind +  │  │ (journal query │
            │  metadata)   │  │  record)   │  │  before start) │
            └───────┬──────┘  └─────┬──────┘  └────────────────┘
                    │               │
                    └───────┬───────┘
                            │
                     ┌──────┴───────┐
                     │   Compare    │
                     │ (metrics     │
                     │  across      │
                     │  attempts)   │
                     └──────┬───────┘
                            │
                     ┌──────┴───────┐
                     │   Choose     │
                     │ (merge +     │
                     │  archive)    │
                     └──────────────┘

Dependencies on existing modules:
  Checkpoint → git.js (tag/branch), state.js (current position), ast.js (metrics snapshot)
  Pivot      → git.js (checkout/reset), memory.js (write reason), stuck-detector.js (trigger)
  Compare    → git.js (diffSummary per ref), ast.js (computeComplexity per ref), test output parsing
  Choose     → git.js (merge + tag), memory.js (write outcome), state.js (update position)
  Journal    → memory.js (new 'trajectories' sacred store, same CRUD pattern as decisions)
```

### Execution Order (build dependencies)

1. **Decision Journal store** — everything writes to it, build first
2. **Checkpoint command** — foundation for pivot/compare/choose
3. **Pivot command** — depends on checkpoint existing
4. **Compare command** — needs 2+ checkpoints/attempts to compare
5. **Choose command** — final step, depends on compare data
6. **Integrations** — stuck→pivot, init context injection, dead-end detection

---

## Detailed Feature Specifications

### F1: Decision Journal (trajectories store)

**What:** New sacred memory store `trajectories` following the existing `decisions`/`lessons` pattern in memory.js.

**Schema per entry:**
```json
{
  "id": "traj-001",
  "scope": "phase-45/plan-01",
  "type": "checkpoint|pivot|compare|choose",
  "name": "direct-import-approach",
  "attempt": 1,
  "timestamp": "2026-02-28T10:00:00Z",
  "git_ref": "trajectory/phase-45/plan-01/attempt-1",
  "metrics": {
    "tests_pass": 42,
    "tests_fail": 3,
    "tests_skip": 0,
    "loc_added": 150,
    "loc_removed": 20,
    "complexity_total": 35,
    "complexity_max_fn": 8,
    "files_changed": 5
  },
  "context": "Trying direct import rewriting approach",
  "signals": ["3 test failures in edge cases", "complexity within bounds"],
  "outcome": null,
  "parent_checkpoint": null,
  "superseded_by": null
}
```

**Complexity:** Low — extends existing memory.js pattern. Add `trajectories` to VALID_STORES and SACRED_STORES constants. Same JSON read/write/query.

**Depends on:** memory.js (existing cmdMemoryWrite/cmdMemoryRead)

### F2: Checkpoint Command

**What:** `gsd-tools trajectory checkpoint <name> [--scope <scope>] [--context <text>]`

**Behavior:**
1. Capture current git ref (HEAD SHA)
2. Create git tag or branch: `trajectory/<scope>/<name>/attempt-N`
3. Auto-collect metrics: run ast.js computeComplexity on changed files, capture test status if available, compute LOC delta from last checkpoint
4. Write journal entry (type: checkpoint)
5. Update STATE.md with active trajectory info

**CLI output:**
```json
{
  "created": true,
  "name": "direct-import",
  "scope": "phase-45/plan-01",
  "attempt": 1,
  "git_ref": "trajectory/phase-45/plan-01/direct-import/attempt-1",
  "metrics": { "tests_pass": 42, "loc_delta": 130, "complexity": 35 }
}
```

**Complexity:** Medium — git operations + metrics collection + journal write. ~200 LOC estimated.

**Depends on:** git.js (execGit, branchInfo), ast.js (computeComplexity), memory.js (trajectories store), state.js

### F3: Pivot Command

**What:** `gsd-tools trajectory pivot <checkpoint-name> [--reason <text>] [--signals <json>]`

**Behavior:**
1. Record why current approach is being abandoned (required `--reason`)
2. Capture signals that indicated failure (test failures, complexity explosion, etc.)
3. Auto-checkpoint current state as "abandoned" (preserves work for future reference)
4. Rewind code to named checkpoint: `git checkout <ref>` or `git reset --hard <ref>`
5. Write journal entry (type: pivot) with reason + signals
6. Increment attempt counter for the trajectory
7. Create new branch for next attempt: `trajectory/<scope>/<name>/attempt-N+1`
8. Update STATE.md

**Complexity:** Medium — git reset logic needs safety checks (dirty files warning, uncommitted work). ~250 LOC estimated.

**Depends on:** git.js (execGit, branchInfo), checkpoint command (for auto-snapshot), memory.js (trajectories store)

**Integration with stuck-detector:** When `StuckDetector.isStuck(taskId)` fires, recovery suggestions include "pivot to last checkpoint" with the checkpoint name and reason template.

### F4: Compare Command

**What:** `gsd-tools trajectory compare [--scope <scope>] [--attempts <N,M>]`

**Behavior:**
1. Load all journal entries for the scope
2. For each attempt, collect metrics (from journal or recompute from git refs)
3. Build comparison matrix
4. Identify winner per metric dimension
5. Output structured comparison with formatted table

**CLI output (JSON):**
```json
{
  "scope": "phase-45/plan-01",
  "attempts": [
    { "name": "direct-import", "attempt": 1, "status": "abandoned", "metrics": {...} },
    { "name": "direct-import", "attempt": 2, "status": "active", "metrics": {...} }
  ],
  "comparison": {
    "tests_pass": { "best": 2, "values": [42, 45] },
    "complexity_total": { "best": 1, "values": [35, 42] },
    "loc_added": { "best": 2, "values": [150, 120] }
  },
  "recommendation": "Attempt 2 wins on 2/3 metrics"
}
```

**TTY output:** Color-coded comparison table via format.js.

**Complexity:** Medium — aggregation + formatting. ~200 LOC estimated.

**Depends on:** memory.js (read trajectories), ast.js (recompute if needed), git.js (diffSummary per ref), format.js (table rendering)

### F5: Choose Command

**What:** `gsd-tools trajectory choose <attempt-N> [--scope <scope>] [--reason <text>]`

**Behavior:**
1. Verify the chosen attempt's branch exists and is valid
2. Merge the winning branch back to the base branch (or current branch)
3. Tag all non-chosen attempts as `archived/trajectory/<scope>/<name>/attempt-N`
4. Write journal entry (type: choose) with winning attempt + reason
5. Clean up trajectory branches (keep tags for reference)
6. Record final comparison metrics in journal
7. Update STATE.md (clear active trajectory)

**Complexity:** Medium-High — merge logic needs conflict handling (reuse worktree.js patterns). ~300 LOC estimated.

**Depends on:** git.js (execGit, merge), worktree.js (parseMergeTreeConflicts, isAutoResolvable patterns), memory.js (trajectories store)

### F6: Dead-End Detection

**What:** `gsd-tools trajectory check-dead-ends [--approach <description>]`

**Behavior:**
1. Query journal for entries matching the current scope
2. Search for similar approaches (keyword match on context/signals fields)
3. Return: count of previous attempts, failure reasons, recommended alternatives

**CLI output:**
```json
{
  "dead_ends_found": 1,
  "matches": [
    {
      "approach": "direct-import",
      "attempts": 2,
      "failure_reasons": ["edge case failures in module resolution"],
      "last_attempt": "2026-02-27T14:00:00Z"
    }
  ],
  "recommendation": "Avoid direct-import pattern — failed 2x on module resolution"
}
```

**Complexity:** Low — journal query + string matching. ~100 LOC.

**Depends on:** memory.js (read trajectories)

### F7: Init Context Injection

**What:** Extend `init execute-phase` and `init execute-plan` to include trajectory context.

**Behavior:**
1. Check if any trajectory entries exist for the current scope
2. If yes, include a "Previous Attempts" section in the init output
3. Include: approach names, attempt counts, failure signals, dead-end warnings

**Complexity:** Low — extends existing init commands. ~50 LOC.

**Depends on:** init.js (existing patterns), memory.js (read trajectories)

---

## MVP Recommendation

**MVP = Journal + Checkpoint + Pivot + Compare (4 features)**

Prioritize:
1. **Decision Journal store** (F1) — foundation, ~30 min to implement given existing memory.js patterns
2. **Checkpoint command** (F2) — core primitive, everything builds on this
3. **Pivot command** (F3) — the "exploration" part; without pivot, checkpoint is just bookmarking
4. **Compare command** (F4) — makes exploration data-driven instead of gut-feel

**Defer to post-MVP:**
- Choose command (F5): Can be done manually with `git merge` + journal entry until automated
- Dead-end detection (F6): High value but needs real journal data to be useful
- Init context injection (F7): Optimization; agents can manually query trajectories

**Rationale:** The MVP lets you checkpoint, try something, pivot when it fails with recorded reasoning, and compare the results. That's the complete "explore" loop. Choose and dead-end detection are "optimize" features that build on a populated journal.

---

## Prioritization Matrix

| Feature | User Value | Build Cost | Risk | Dependencies | Priority |
|---------|-----------|------------|------|-------------|----------|
| F1: Decision Journal | HIGH (everything writes to it) | LOW (~50 LOC) | LOW | memory.js only | **P0** |
| F2: Checkpoint | HIGH (core primitive) | MED (~200 LOC) | LOW | git.js, ast.js | **P0** |
| F3: Pivot | HIGH (core value prop) | MED (~250 LOC) | MED (git reset safety) | git.js, F1, F2 | **P0** |
| F4: Compare | HIGH (data-driven decisions) | MED (~200 LOC) | LOW | F1, ast.js, git.js | **P0** |
| F5: Choose | MED (automation convenience) | MED-HIGH (~300 LOC) | MED (merge conflicts) | F1-F4, git.js | **P1** |
| F6: Dead-End Detection | MED (prevents repeat mistakes) | LOW (~100 LOC) | LOW | F1 only | **P1** |
| F7: Init Injection | MED (context efficiency) | LOW (~50 LOC) | LOW | F1, init.js | **P1** |
| Stuck→Pivot integration | MED (seamless recovery) | LOW (~30 LOC) | LOW | F3, stuck-detector | **P2** |
| Multi-level scoping | MED (flexibility) | MED | LOW | All commands | **P2** |
| Comparison visualization | LOW (nice TTY output) | LOW | LOW | format.js | **P2** |

---

## Estimated Total Scope

| Category | Estimated LOC | New Files | Modified Files |
|----------|-------------|-----------|----------------|
| F1: Journal store | ~50 | 0 (extend memory.js) | memory.js, constants.js |
| F2: Checkpoint | ~200 | 1 (trajectory.js) | router.js |
| F3: Pivot | ~250 | 0 (in trajectory.js) | router.js |
| F4: Compare | ~200 | 0 (in trajectory.js) | router.js |
| F5: Choose | ~300 | 0 (in trajectory.js) | router.js |
| F6: Dead-End Detection | ~100 | 0 (in trajectory.js) | — |
| F7: Init Injection | ~50 | 0 | init.js |
| Tests | ~500 | 1 (trajectory.test.cjs) | — |
| **Total** | **~1,650** | **2 new files** | **5 modified files** |

New command module: `src/commands/trajectory.js` (~1,100 LOC) following existing command module patterns.

---

## Sources

- **Git branching:** Official git-scm.com documentation (git tag, git branch, git stash) — HIGH confidence
- **ADR/MADR pattern:** adr.github.io/madr/ (MADR 4.0.0, Context/Decision/Consequences structure) — HIGH confidence
- **EnCompass framework:** MIT CSAIL, NeurIPS 2025, arxiv.org/pdf/2512.03571 — HIGH confidence for the branchpoint/backtracking/parallel exploration pattern
- **AWS ADR best practices:** docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/ — MEDIUM confidence (enterprise-oriented, adapted for CLI context)
- **Decision journal schema:** Adapted from MADR + GSD's existing memory.js decisions store pattern — HIGH confidence (both proven in production)
- **Comparison metrics:** Existing ast.js computeComplexity + git.js diffSummary — HIGH confidence (already tested in production, 669+ tests)
- **Stuck→pivot integration:** Existing stuck-detector.js `_findLastGoodState()` has a TODO comment: "In a full implementation, would track state snapshots" — this feature completes that story
