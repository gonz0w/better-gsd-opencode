# Project Research Summary

**Project:** bGSD Plugin v7.1 — Trajectory Engineering
**Domain:** CLI-based structured exploration system for AI-driven development
**Researched:** 2026-02-28
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>

**Summary:** Trajectory engineering adds checkpoint/pivot/compare/choose commands to the existing 34-module CLI with zero new dependencies (~900-1650 LOC across 2 new modules). The decision journal extends memory.js as a 5th sacred store. The #1 risk is STATE.md coherence during pivot — selective file checkout (not `reset --hard`) must preserve `.planning/` while rewinding source code.

**Recommended stack:** No additions — existing git.js (execGit), ast.js (computeComplexity), memory.js (sacred stores), format.js (tables/color) cover all requirements.

**Architecture:** Two new modules (lib/trajectory.js + commands/trajectory.js) following existing lib/command split; journal as `trajectories` sacred store in memory.js; `gsd/` namespaced git tags+branches for checkpoints and attempts.

**Top pitfalls:**
1. `.planning/` state divergence on pivot — use selective `git checkout <ref> -- src/ test/ bin/`, never `reset --hard`
2. Losing uncommitted work during pivot — mandatory `branchInfo()` dirty-check before any branch operation
3. Worktree namespace collision — strict `gsd/trajectory/` prefix vs `worktree-*` dash pattern; cross-system guards

**Suggested phases:**
1. Foundation — journal store + STATE.md coherence design (must be first — everything writes to journal)
2. Checkpoint — git tag/branch creation + metrics snapshot (primitive everything builds on)
3. Pivot — selective rewind + archive branches (highest-risk phase, needs journal+checkpoint solid)
4. Compare — multi-attempt metrics aggregation + signal detection (needs 2+ attempts to test)
5. Choose — merge winner + cleanup losers (depends on compare for informed selection)
6. Integration — init context injection + dead-end detection + stuck→pivot wiring (only valuable with real journal data)

**Confidence:** HIGH overall | **Gaps:** `computeComplexity()` needs `{code}` option for git-show integration; multi-level scoping deferred to task-level only; test results need structured cache for compare metrics

</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

Trajectory engineering is a structured exploration layer for AI agents that frequently hit dead ends during development. The core problem: agents currently explore, fail, and lose all context about *why* an approach failed — leading to repeated exploration of known dead ends across sessions. The solution is four commands (checkpoint, pivot, compare, choose) backed by a persistent decision journal that captures reasoning alongside code state. MIT's EnCompass research (NeurIPS 2025) validates the branchpoint/backtracking/parallel exploration pattern; GSD applies it at the task/plan level with git-backed code state.

The recommended approach requires **zero new runtime dependencies**. Every capability maps to proven primitives already in the codebase: `git.js` execGit for branch/tag/diff operations (301 lines, battle-tested), `ast.js` computeComplexity for code metrics (1192 lines), `memory.js` for journal persistence as a 5th sacred store, and `format.js` for comparison output. Implementation adds 2 new modules (~750-1100 LOC for lib + commands) plus ~500 LOC of tests, modifying 4-5 existing modules minimally. Bundle impact is negligible: ~2-4KB added to the ~1000KB bundle.

The critical risk is **STATE.md coherence during pivot operations**. A naive `git reset --hard` reverts the entire working tree — including `.planning/` files containing the decision journal, session state, and progress tracking. This destroys the very reasoning trail that makes trajectory engineering valuable. The proven mitigation is selective file checkout (`git checkout <ref> -- src/ test/ bin/`) that rewinds source code while preserving planning state. Secondary risks include worktree namespace collisions (solved by strict `gsd/` prefix convention) and branch proliferation (solved by mandatory cleanup in `choose` command and phase-completion hooks). All prevention strategies use existing git plumbing — no new tools required.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

No new dependencies. The existing stack covers every trajectory engineering requirement without additions. This is a code-architecture milestone, not a dependency milestone.

**Core technologies (all existing):**
- **git.js `execGit()`:** All branch, tag, diff, merge, checkout, reset operations — proven 301-line wrapper around `execFileSync('git', args)`
- **git.js `branchInfo()`:** Dirty-file detection, current branch, detached HEAD check — critical safety pre-flight for pivot
- **git.js `diffSummary()`:** LOC delta, file count between refs — primary comparison metrics
- **ast.js `computeComplexity()`:** Cyclomatic complexity scoring — needs minor 3-line enhancement to accept `{code}` string option for `git show` integration
- **memory.js sacred store pattern:** `trajectories` added as 5th store alongside decisions/lessons/bookmarks/todos — same JSON read/write/query, never auto-compacted
- **worktree.js merge patterns:** `parseMergeTreeConflicts()` and `isAutoResolvable()` reusable for trajectory choose/merge operations
- **format.js `formatTable()`:** Comparison matrix rendering with color-coded winners

**Critical version requirements:** Git 2.38+ (already required since v4.0 for `merge-tree --write-tree`). Node.js 18+ (already minimum). No new version requirements.

### Expected Features

The feature set divides cleanly into MVP (complete exploration loop) and post-MVP (optimization).

**Must have (table stakes — MVP):**
- Decision journal store (trajectories as sacred memory store) — foundation, everything writes to it
- Checkpoint creation with named tags, auto-metrics capture, journal entry
- Pivot with reason capture, selective code rewind, attempt archival
- Compare with test/LOC/complexity metrics across attempts, signal detection
- Session-portable journal that survives session boundaries

**Should have (differentiators — complete v7.1):**
- Choose command with merge winner, archive losers, cleanup branches
- Dead-end detection from journal (query before starting: "has this been tried?")
- Signal-based comparison matrix with automated recommendation
- Stuck→pivot integration (stuck-detector suggests pivot to last checkpoint)

**Defer (v2+ / post-v7.1):**
- Multi-level trajectories (plan/phase level) — 95% of use is task-level
- Parallel attempt exploration (requires worktree orchestrator changes)
- Init context injection of trajectory data — can manually query until automated
- Trajectory "playback" / action replay — record decisions and signals, not actions

### Architecture Approach

Two new modules following the established lib/command split pattern. `src/lib/trajectory.js` (~400 LOC) owns the data model, state machine, and git operations — pure logic, testable independently. `src/commands/trajectory.js` (~350 LOC) handles CLI routing, arg parsing, and output formatting. The decision journal extends memory.js by adding `trajectories` to `VALID_STORES` and `SACRED_STORES` — all existing `cmdMemoryWrite/Read/List` work automatically. Module count grows from 34 → 36.

**Major components:**
1. **Trajectory State Machine** (lib/trajectory.js) — lifecycle management: create → checkpoint → attempt → pivot/choose; state transitions with validation
2. **CLI Command Handlers** (commands/trajectory.js) — 6-7 subcommands routed via lazy-loaded router entry; structured JSON output with TTY formatting
3. **Decision Journal** (memory.js extension) — `trajectories` sacred store at `.planning/memory/trajectory.json`; entries scoped by phase+plan+task
4. **Metrics Collection** — `collectMetrics()` aggregates test pass/fail, LOC delta, complexity delta, files changed; `collectCheapMetrics()` for fast-path (LOC + files only)
5. **Selective Rewind Engine** — `git checkout <ref> -- src/ test/ bin/` pattern that preserves `.planning/`; journal-first write order (record decision before destructive operation)

### Critical Pitfalls

1. **STATE.md divergence across trajectory branches** — `.planning/` files revert to checkpoint-era state during pivot, causing agents to operate on stale decisions, wrong progress, missing context. **Prevent:** Selective file checkout excluding `.planning/`; journal committed before any destructive git operation; round-trip test is #1 test case.

2. **Losing uncommitted work during pivot** — Agent is mid-edit, tests fail, pivot fires, `git checkout` destroys uncommitted changes. Unrecoverable. **Prevent:** Mandatory `branchInfo()` dirty-check as first operation in pivot; refuse with clear message if dirty; offer auto-commit WIP, never `--force`.

3. **Worktree namespace collision** — Trajectory branches collide with `worktree-*` pattern; `worktree cleanup` deletes trajectory branches; `worktree merge` picks up trajectory changes. **Prevent:** Strict `gsd/trajectory/` prefix (slash-separated) vs `worktree-` (dash-separated); cross-system namespace guards; filter `gsd/*` branches from worktree operations.

4. **Branch proliferation** — Unchecked trajectory creation leads to 90+ `gsd/*` branches polluting `git branch` output. **Prevent:** `choose` command deletes non-winning branches; phase-completion cleanup hook; configurable max branches per task (default 5); `trajectory list` command for visibility.

5. **Decision journal becomes second memory system** — Parallel persistence creates two places agents must query for decisions. **Prevent:** Journal IS a memory store (`trajectories` in VALID_STORES); entries follow same `{timestamp, ...}` pattern; `memory read --store trajectories` works natively.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested 6-phase structure following the natural user workflow: set up → snapshot → explore → evaluate → decide → learn.

### Phase 1: Foundation — Decision Journal + STATE.md Coherence
**Rationale:** Everything writes to the journal — it must exist and be tested before any command. STATE.md coherence (the #1 architectural risk) must be designed and proven here, not retrofitted.
**Delivers:** `trajectories` sacred store in memory.js; journal entry schema; selective checkout pattern for `.planning/` preservation; namespace convention (`gsd/trajectory/`, `gsd/checkpoint/`, `gsd/archive/`); worktree namespace guards.
**Addresses:** F1 (journal store), Pitfall 1 (state divergence), Pitfall 4 (worktree collision), Pitfall 8 (dual memory systems)
**Avoids:** Building commands on an unproven foundation; discovering state coherence issues after 3 phases of work

### Phase 2: Checkpoint + Metrics Collection
**Rationale:** Can't pivot without a checkpoint. Can't compare without metrics. This is the primitive everything builds on.
**Delivers:** `trajectory checkpoint <name>` command; git tag creation; auto-metrics collection (tests, LOC, complexity, files changed); journal entry on checkpoint; `collectMetrics()` and `collectCheapMetrics()` functions.
**Addresses:** F2 (checkpoint), metrics snapshot at checkpoint time
**Avoids:** Pitfall 11 (pre-commit hook conflict) — use lightweight `--no-verify` for checkpoint commits

### Phase 3: Pivot + Selective Rewind
**Rationale:** This is the highest-risk phase — git state manipulation with selective checkout. Must have journal and checkpoint solid first to provide a safety net. The core value proposition of the entire feature.
**Delivers:** `trajectory pivot <checkpoint> --reason <text>` command; selective file rewind; attempt archival; journal-first write pattern; dirty-file safety gate; attempt counter increment.
**Addresses:** F3 (pivot), stuck→pivot trigger point
**Avoids:** Pitfall 1 (state divergence via selective checkout), Pitfall 2 (data loss via mandatory dirty-check)

### Phase 4: Compare + Signal Detection
**Rationale:** Needs 2+ checkpoints/attempts to be testable. Makes exploration data-driven rather than gut-feel. Populates the journal with comparison data needed by choose.
**Delivers:** `trajectory compare` command; multi-attempt metrics aggregation; signal detection (test regression, complexity increase); comparison matrix (≤300 tokens); automated recommendation line.
**Addresses:** F4 (compare), F6 partial (dead-end data)
**Avoids:** Pitfall 7 (comparison bloat) — 3 default metrics only (tests, LOC, files); verbose opt-in

### Phase 5: Choose + Merge + Cleanup
**Rationale:** Depends on compare data to inform selection. Merge logic reuses proven worktree.js patterns (lower risk than it appears). Closes the exploration loop.
**Delivers:** `trajectory choose <attempt-N>` command; file-replacement merge (not `git merge`); archive non-winners as `gsd/archive/` tags; cleanup trajectory branches; final journal entry with rationale.
**Addresses:** F5 (choose), branch cleanup (Pitfall 3)
**Avoids:** Pitfall 6 (merge conflicts) — use `git checkout winner -- .` file replacement, not 3-way merge

### Phase 6: Integration — Agent Context + Dead-End Detection
**Rationale:** Only valuable after the journal has real data from phases 1-5. Extends existing init and stuck-detector patterns.
**Delivers:** Dead-end detection (`trajectory check-dead-ends`); init context injection (≤500 tokens per task); stuck→pivot wiring; `trajectory list` and `trajectory cleanup` commands.
**Addresses:** F6 (dead-end detection), F7 (init injection), Pitfall 5 (stale data), Pitfall 9 (context confusion)
**Avoids:** Pitfall 9 (context pollution) — task-scoped injection only; 500-token budget; comparison data is ephemeral

### Phase Ordering Rationale

- **Foundation first** because STATE.md coherence is the #1 risk identified across all research. Building commands on a flawed state model means redesigning everything later (HIGH recovery cost per pitfalls research).
- **Checkpoint before pivot** because pivot requires a checkpoint to rewind to — hard dependency.
- **Pivot before compare** because compare needs 2+ attempts to compare, and attempts are created via checkpoint→work→pivot cycles.
- **Compare before choose** because choose needs comparison data to make an informed selection.
- **Integration last** because dead-end detection and context injection only add value when the journal has real entries from the complete exploration loop.
- **Each phase can be tested independently** with real trajectory data generated by the previous phase's output.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Foundation):** STATE.md coherence design needs careful specification — which fields are branch-local vs trajectory-global? How does `state validate` handle active trajectories? Needs `/gsd-research-phase`.
- **Phase 3 (Pivot):** Selective checkout edge cases — what about files added/deleted since checkpoint? What about `.planning/` files created during the attempt? Needs careful test design.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Checkpoint):** Well-documented git tag/branch patterns; metrics collection uses existing ast.js/git.js directly.
- **Phase 4 (Compare):** Straightforward aggregation + formatting; reuses existing `formatTable` and `diffSummary`.
- **Phase 5 (Choose):** Reuses proven `parseMergeTreeConflicts()` and `isAutoResolvable()` from worktree.js.
- **Phase 6 (Integration):** Standard init injection follows existing intent/codebase injection patterns.
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new deps. Every operation verified against existing git.js (301 LOC), ast.js (1192 LOC), memory.js (307 LOC). All git commands are stable plumbing. |
| Features | HIGH | Clear user need (INTENT.md DO-21 through DO-26). Feature scope validated against EnCompass (NeurIPS 2025) branchpoint/backtracking pattern. MVP is 4 commands + journal. |
| Architecture | HIGH | Two new modules following proven lib/command split. Module interactions mapped to 10 existing integration points. Journal extends existing sacred store pattern. |
| Pitfalls | HIGH | 12 pitfalls identified from codebase analysis (34 modules, 669 tests, worktree.js integration surface), Kiro/Claude Code checkpoint architectures, and prior v2.0 pitfall research. Prevention strategies verified against git documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **`computeComplexity()` code-from-string option:** Currently reads from disk only. Needs `{code}` parameter to compute complexity from `git show <ref>:<file>` output. 3-line change to `ast.js`, but must be planned as an early task in Phase 2.
- **Multi-level scoping deferred:** Task-level trajectories cover 95% of use cases. Plan/phase-level scoping has unresolved questions (which files to rewind at each level, how scope nesting works). Recommend implementing task-level only, expanding after real usage validates the pattern.
- **Test results structured cache:** Compare command needs test metrics per attempt. Currently test output is plain text in `test-results.txt`. May need a structured JSON cache for reliable metric extraction. Can punt by storing test counts in journal at checkpoint time.
- **Cache invalidation after branch switch:** `cachedReadFile()` and `getPhaseTree()` cache file contents. After `pivot` switches code state, caches hold pre-switch content. Must call `invalidateFileCache()` after every branch-affecting operation. Easy fix but easy to forget.
- **Concurrent trajectory handling:** What happens if two trajectories are active at different scopes? Research assumes one active trajectory per scope, but scope interaction needs testing in Phase 1.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/git.js` (301 lines), `src/commands/worktree.js` (791 lines), `src/lib/ast.js` (1192 lines), `src/commands/memory.js` (307 lines), `src/commands/state.js` (716 lines), `src/lib/helpers.js` (cachedReadFile/invalidateFileCache), `src/router.js` (897 lines) — direct code review
- Git documentation: `git-tag(1)`, `git-branch(1)`, `git-reset(1)`, `git-checkout(1)`, `git-show(1)`, `git-diff(1)`, `git-merge-tree(1)` — all stable plumbing commands
- Node.js `child_process`, `crypto` documentation (Context7)
- MIT EnCompass framework (NeurIPS 2025, arxiv.org/pdf/2512.03571) — branchpoint/backtracking/parallel exploration pattern validation

### Secondary (MEDIUM confidence)
- Kiro checkpointing docs (2025) — shadow repository architecture, session-scoped cleanup
- Claude Code checkpoint feature (2025) — conversation state unwind consistency
- AWS ADR best practices — decision record structure (adapted for CLI)
- MADR 4.0.0 (adr.github.io/madr/) — Context/Decision/Consequences record pattern
- Community consensus: branches > stash for named checkpoints, lightweight tags > annotated for disposable snapshots (Stack Overflow, Reddit r/git, Software Engineering SE)

### Tertiary (LOW confidence)
- Multi-level trajectory scoping — inferred from task/plan/phase hierarchy, no direct precedent for 3-level exploration systems. Deferred to post-task-level validation.
- Context window pollution thresholds — 500-token per-task and 2000-token total budgets are estimates based on existing context-budget analysis, not empirically validated for trajectory data.
<!-- /section -->

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*
