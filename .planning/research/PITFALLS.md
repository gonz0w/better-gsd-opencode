# Domain Pitfalls: Trajectory Engineering

**Domain:** Adding checkpoint/pivot/compare/choose exploration system to an existing Node.js CLI that manages git state and markdown planning documents
**Researched:** 2026-02-28
**Confidence:** HIGH — based on codebase analysis (34 src/ modules, 669 tests, git.js + worktree.js integration surfaces), Kiro checkpointing architecture, Claude Code checkpoint patterns, git branch management literature, and prior v2.0 pitfall research

## Compact Summary

The 9 pitfalls below distill into three failure modes:

1. **State coherence failures** (Pitfalls 1, 2, 5): Trajectory operations create divergent copies of `.planning/` files. If checkpoint/pivot/choose don't maintain bidirectional consistency between git branch state and planning document state, agents act on stale or contradictory information. This is THE critical risk for this codebase.

2. **Git complexity explosion** (Pitfalls 3, 4, 6): Every checkpoint creates a branch. Every pivot creates another. Without aggressive lifecycle management, the repo accumulates `traj-*` branches that pollute `git branch` output, confuse the existing worktree system, and make `branchInfo()` return unexpected data. Single-developer doesn't mean single-branch-count.

3. **Context window pollution** (Pitfalls 7, 8, 9): Decision journals, comparison metrics, and trajectory metadata are valuable for preventing re-exploration — but each token of trajectory history displaces a token of actual work context. The existing 200K-token context window and 50% target utilization leave ~100K tokens for work; a verbose decision journal can consume 10-20% of that.

---

## Critical Pitfalls

Mistakes that cause data loss, agent confusion, or features that make the system actively worse.

---

### Pitfall 1: .planning/ File State Divergence Across Trajectory Branches

**What goes wrong:**
`checkpoint` creates a git branch (snapshot of code + planning files). The developer continues working on the original branch — STATE.md gets updated, PLAN.md progress changes, decisions accumulate. When `pivot` rewinds to the checkpoint branch, the `.planning/` files revert to their checkpoint-time state: wrong current plan, wrong progress percentage, missing decisions, stale session continuity data. The agent now operates on a STATE.md that says "Plan 2 of 5, 40% complete" when the actual trajectory context is "Attempt 2 of approach B, starting fresh from checkpoint."

Worse: `compare` needs to read STATE.md from multiple branches to extract metrics. Each branch has its own STATE.md with its own position/progress. The comparison output shows conflicting "current state" data because it's reading per-branch STATE.md rather than a centralized trajectory record.

**Why it happens:**
The existing architecture stores ALL state in `.planning/` markdown files within the git tree. This design is perfect for linear execution (one branch, one timeline) but breaks down for branching timelines. Git handles code divergence natively but `.planning/` files contain cross-cutting concerns (overall project progress, session state, decisions) that shouldn't diverge.

Specifically in this codebase:
- `cmdStateLoad()` reads `.planning/STATE.md` from `cwd` — whatever branch is checked out
- `cmdStatePatch()` writes to `.planning/STATE.md` in the current branch
- `stateReplaceField()` operates on the content of the currently-checked-out STATE.md
- `cmdStateValidate()` compares STATE.md against `.planning/phases/` which are also branch-local

**Consequences:**
- Agent resumes from checkpoint and sees stale decisions — re-explores dead ends
- `state validate` fires false positives after pivot (STATE.md references plans that exist on the previous branch but not this one)
- `cmdStateAdvancePlan()` advances plan count on a trajectory branch, creating phantom progress
- `state update-progress` computes completion percentage from branch-local phase directories, producing incorrect overall progress

**Prevention:**
1. **Separate trajectory-scoped state from branch-local state.** Create `.planning/trajectory/` directory that is NOT part of the trajectory branches. Trajectory metadata (which checkpoint we're on, attempt count, decision journal) lives in the *original* branch only, or in a sidecar file outside git.
2. **`checkpoint` must snapshot STATE.md's current-position fields but NOT let them diverge.** When creating a checkpoint branch, strip the position/progress fields from the branch copy of STATE.md (or replace with a pointer: "Trajectory branch — see original branch for current state").
3. **`pivot` must NOT revert STATE.md to checkpoint state.** It reverts CODE, but carries forward the current STATE.md (or at minimum: current decisions, current blockers, current session continuity). Implement this as: `git checkout checkpoint-branch -- . ':!.planning/STATE.md' ':!.planning/memory/'` — exclude planning state from the revert.
4. **Test the round-trip:** checkpoint → work → update state → pivot → verify STATE.md is current, not stale. This is the #1 test case for the entire feature.

**Warning signs:**
- Agent says "I see we're on Plan 2" after pivot when we should be starting fresh
- `state validate` fires errors immediately after `pivot`
- Decision journal entries disappear after `pivot` (they were on the abandoned branch)
- `compare` shows two different "Current Plan" values from the same trajectory

**Detection:** After any trajectory operation, run `state validate` — if it reports position/progress issues, state divergence has occurred.

**Phase to address:** FIRST phase. This is the architectural foundation. Every other feature (pivot, compare, choose) depends on state coherence.

---

### Pitfall 2: Losing Uncommitted Work During Pivot/Rewind

**What goes wrong:**
Developer (or agent) is mid-edit when `pivot` fires. They've modified 3 source files and `.planning/PLAN.md` but haven't committed. `pivot` does `git checkout checkpoint-branch` which fails with "Your local changes to the following files would be overwritten" — or worse, with `--force` it silently destroys uncommitted work.

This is especially dangerous in this codebase because `execGit()` runs synchronously and the commit command (`cmdCommit()`) requires explicit invocation. There's no auto-save. The agent operates in a "modify files → test → commit" cycle, and the gap between "modify" and "commit" is exactly when pivot is most tempting (tests failed, want to try different approach).

**Why it happens:**
The existing `worktree.js` handles this for worktrees via `--force` flag in `cmdWorktreeRemove()` (line 399: `['worktree', 'remove', worktreePath, '--force']`). This is intentional for worktree cleanup but would be destructive for trajectory pivots. The worktree system creates isolated directories; trajectory engineering operates on the SAME working directory.

`execGit()` returns `{ exitCode, stdout, stderr }` — a failed checkout due to dirty state returns exitCode 1. If the pivot command doesn't check for this AND handle it gracefully, one of two things happens: (a) pivot fails silently, leaving the user confused, or (b) pivot forces the checkout, destroying work.

**Consequences:**
- Uncommitted code changes permanently lost
- Agent's in-progress work destroyed mid-task
- User trust in the tool destroyed after one data loss incident
- If auto-stash is used naively, stash pile-up creates its own confusion

**Prevention:**
1. **Pre-flight dirty check is MANDATORY before any branch-switching operation.** Use the existing `branchInfo()` which already detects `has_dirty_files` and `dirty_file_count`. If dirty: refuse to pivot and output a clear message: `"Cannot pivot: N uncommitted files. Commit or stash first."`
2. **Offer auto-commit, not auto-stash.** `git stash` creates invisible state that's easy to lose. Instead: `pivot` should offer: "Uncommitted changes detected. Options: (a) commit current work first, (b) discard changes, (c) abort pivot." For agent workflows, always choose (a) — commit with message `"wip: checkpoint before pivot to [name]"`.
3. **NEVER use `--force` for checkout in trajectory operations.** Unlike worktree removal (which operates on separate directories), trajectory checkout operates on the user's working directory. Force = data loss.
4. **Test: create dirty state → attempt pivot → verify pivot refuses AND work is preserved.** This must be a test case, not just documentation.

**Warning signs:**
- `pivot` command doesn't call `branchInfo()` before switching
- Any git checkout call that doesn't check for dirty files first
- Stash references appearing in trajectory metadata (means auto-stash was used)
- Agent outputs "pivot successful" without mentioning dirty file handling

**Phase to address:** Checkpoint & Pivot phase — the `pivot` command implementation. Build the dirty-check as the first operation, before any git operations.

---

### Pitfall 3: Branch Proliferation from Unbounded Trajectory Creation

**What goes wrong:**
Each `checkpoint` creates a branch. Each `pivot` may create another. A developer exploring 3 approaches to a problem creates 3 checkpoint branches + 3 attempt branches = 6 branches. Do this for 5 tasks in a phase = 30 branches. Over a milestone with 15 plans = potentially 90+ trajectory branches in the repo.

`git branch` output becomes noise. The existing `branchInfo()` function returns `branch` as the current branch name — but listing branches via `git branch` (which worktree.js uses for cleanup) returns ALL branches, including trajectory detritus. The existing worktree system creates branches with pattern `worktree-NN-MM-W` — if trajectory branches use a similar pattern, cleanup logic could collide.

**Why it happens:**
Git branches are cheap to create but expensive to manage mentally. The Kiro checkpointing system avoids this by using a "shadow repository" (separate bare git repo) that's cleaned up per session. Claude Code's checkpoints are session-scoped. Both recognized that persistent branches create persistent mess.

This codebase's trajectory system is designed to be persistent (decision journal survives sessions) — which means branches must also persist until explicitly cleaned up. But "persist until cleaned up" in practice means "persist forever" because cleanup is the first thing developers forget.

**Consequences:**
- `git branch` output becomes unusable
- `branchInfo()` upstream detection breaks on trajectory branches (they have no upstream)
- Disk usage grows (each branch retains its own tree objects)
- `worktree check-overlap` and `worktree merge` may accidentally discover trajectory branches
- Agent confusion: "Which branch should I be on?"

**Prevention:**
1. **Namespacing: all trajectory branches MUST use prefix `traj/`** (e.g., `traj/task-21-02/checkpoint-1`, `traj/task-21-02/attempt-2`). This makes them: (a) filterable with `git branch --list 'traj/*'`, (b) distinguishable from worktree branches (`worktree-*`), (c) groupable in git GUIs.
2. **`choose` command must delete non-winning branches.** When a trajectory is resolved (approach B wins), the `choose` command merges B and deletes the `traj/` branches for that task. This is the archival step. Without it, branches accumulate indefinitely.
3. **Automatic cleanup on phase/milestone completion.** When `cmdPhaseComplete()` or `cmdMilestoneComplete()` runs, add a step: prune all `traj/` branches whose task is in the completed phase. This mirrors how `cmdWorktreeCleanup()` prunes worktrees.
4. **Hard limit: configurable max trajectory branches per task (default: 5).** If a developer has 5 active attempts at one task, something is wrong. The 6th `checkpoint` should warn: "5 trajectory branches exist for this task. Clean up or increase limit."
5. **`trajectory list` command that shows ONLY trajectory branches** with age, task association, and committed/merged status. Like `worktree list` but for trajectories.

**Warning signs:**
- `git branch | wc -l` exceeds 20 in a single-developer repo
- `worktree merge` finds unexpected branches
- Agent asks "which branch am I on?" or "should I switch branches?"
- `git branch --list 'traj/*'` returns branches from 3+ tasks ago

**Phase to address:** Checkpoint phase (naming convention) and Choose phase (cleanup). Also: add cleanup hook to existing `cmdPhaseComplete()` and `cmdMilestoneComplete()`.

---

### Pitfall 4: Breaking Existing Worktree Functionality

**What goes wrong:**
The existing worktree system (`worktree.js`, 791 lines) manages branches with pattern `worktree-NN-MM-W` and operates on paths under `/tmp/gsd-worktrees/`. It has:
- `parsePlanId()` for branch naming
- `parseWorktreeListPorcelain()` for listing
- `isAutoResolvable()` for merge conflict handling
- `cmdWorktreeMerge()` with `merge-tree` dry-run

If trajectory engineering introduces its own branch creation, checkout operations, or merge logic, it can collide with worktree operations in several ways:

1. **Branch name collision.** A checkpoint branch `traj/worktree-21-02-1` (if poorly named) matches the worktree pattern. `cmdWorktreeList()` filters by path prefix, but `cmdWorktreeRemove()` finds branches by name pattern. An accidental match deletes the wrong branch.
2. **Concurrent branch switching.** If a worktree is active on branch `worktree-21-02-1` and the main repo pivots to a checkpoint, the worktree's state becomes ambiguous. `git worktree list` shows both; `merge-tree` dry-run may pick up changes from the trajectory.
3. **Merge conflict resolution collision.** `cmdWorktreeMerge()` uses `git merge-tree --write-tree` for dry-run and `git merge --no-ff` for actual merge. If a trajectory branch has been cherry-picked or partially merged, the merge-tree output includes those changes, creating phantom conflicts.
4. **Config interaction.** Worktree config lives in `.planning/config.json` under `worktree` key. Trajectory config must NOT overlap with this namespace.

**Why it happens:**
Both systems (worktree and trajectory) manage git branches, but for different purposes. Worktrees create isolated directories for parallel execution; trajectories create branches for sequential exploration. Without explicit boundary enforcement, they leak into each other's operations.

**Consequences:**
- Worktree merge picks up trajectory changes → corrupted merge
- `worktree cleanup` deletes trajectory branches → lost exploration data
- `worktree create` fails because the branch name is "already in use" by a trajectory
- 669 existing tests start failing because worktree test fixtures encounter trajectory branches

**Prevention:**
1. **Strict namespace separation:** Worktree branches = `worktree-*`. Trajectory branches = `traj/*`. Add an assertion in both systems: worktree operations MUST reject branches matching `traj/*`; trajectory operations MUST reject branches matching `worktree-*`.
2. **Filter trajectory branches from worktree list.** In `parseWorktreeListPorcelain()`, add: `if (wt.branch && wt.branch.startsWith('traj/')) continue;`
3. **Trajectory operations must check for active worktrees.** Before `pivot` does a branch switch, verify no worktree is currently active (via `git worktree list`). If a worktree exists, pivot should refuse or warn.
4. **Separate test suites.** Trajectory tests must NOT create branches that match worktree patterns. Worktree tests must NOT create branches that match trajectory patterns. Add cross-contamination assertions to both test suites.
5. **Add `trajectory` as a new top-level command** (like `worktree`), not as subcommands on existing commands. This maintains separation in the router and prevents argument parsing collisions.

**Warning signs:**
- Worktree tests start failing after trajectory code is added
- `worktree list` shows trajectory branches
- `worktree cleanup` deletes more branches than expected
- `worktree merge` reports conflicts on files that weren't modified in the worktree

**Phase to address:** FIRST phase (architecture). Define namespace conventions before writing any git operations. Add namespace guard to worktree.js as an early safety task.

---

### Pitfall 5: Stale Checkpoint Data Leading Agents to Re-Explore Dead Ends

**What goes wrong:**
The decision journal records "Approach A failed because tests X and Y broke." Three sessions later, a new agent resumes the project. The decision journal is in `.planning/trajectory/journal.md` or `memory/trajectories.json`. But:

1. **The agent doesn't load the journal.** Trajectory history isn't part of the `init execute-phase` output. The agent starts work, encounters the same problem, tries Approach A again, fails again, wastes 15 minutes rediscovering what was already known.
2. **The journal IS loaded but is stale.** The codebase changed since the checkpoint. Tests X and Y were fixed in a later plan. Approach A would actually work now, but the journal says "dead end." The agent avoids a viable approach based on outdated failure data.
3. **The journal is too verbose.** Every checkpoint, every pivot, every micro-decision is logged. The journal is 3,000 tokens. The agent reads all of it, consuming 3% of context for historical data that's mostly noise.

**Why it happens:**
Decision journals solve a real problem (preventing re-exploration) but create the same tension as cross-session memory: too little data = agents repeat mistakes; too much data = context pollution; stale data = agents make wrong decisions based on obsolete facts. This is literally Pitfall 2 from the v2.0 research ("Cross-Session Memory That Bloats Context") applied to trajectory data.

The existing memory system has this exact pattern: `SACRED_STORES = ['decisions', 'lessons']` are never pruned (memory.js line 8). If trajectory decisions join sacred stores, they accumulate forever.

**Consequences:**
- Agent wastes tokens re-exploring known-dead approaches (no journal loaded)
- Agent avoids viable approaches because journal says they failed (stale journal)
- Context window consumed by trajectory history instead of current work (verbose journal)
- Two agents in different sessions make contradictory decisions based on partial journal reads

**Prevention:**
1. **Trajectory journal must be part of `init execute-phase` output** — but ONLY the active task's trajectory data. Not the full journal. Maximum 500 tokens of trajectory context per task.
2. **Journal entries must be time-stamped and code-hash-stamped.** Each entry records the git commit hash at the time of the decision. When the journal is loaded, entries whose code-hash is more than N commits behind current HEAD are marked as `[possibly stale — codebase changed]`. The agent can still read them but knows to re-evaluate.
3. **Compaction: resolve > archive.** When `choose` picks a winner, the journal entry for that task should be compacted to: `"Tried A (failed: tests broke), tried B (succeeded: all tests pass). Chose B."` — one line. The per-attempt detail gets archived (moved to `.planning/trajectory/archive/`), not kept in the active journal.
4. **Token budget for trajectory context: 500 tokens per task, 2000 tokens total in any workflow.** Use the existing `context-budget` estimation. If trajectory context exceeds budget, oldest entries get summarized.
5. **Distinguish "definitively dead" from "failed this time."** A journal entry should classify: `dead_end: true` (approach is fundamentally wrong) vs `failed_attempt: true` (approach might work with different parameters). Agents should re-try `failed_attempt` entries but avoid `dead_end` entries.

**Warning signs:**
- Agent says "Let me try approach X" when journal says X was already tried
- `init execute-phase` output grows by >1000 tokens after trajectory feature ships
- Journal file exceeds 5KB
- Agent spends first 30 seconds reading trajectory history before starting work

**Phase to address:** Decision Journal phase. Design the compaction strategy and token budget BEFORE implementing persistence.

---

## Moderate Pitfalls

Mistakes that cause rework or wasted effort but don't corrupt data.

---

### Pitfall 6: Merge Conflicts When `choose` Merges Winning Attempt Back

**What goes wrong:**
Developer checkpoints at commit C, creates attempt A (3 commits) and attempt B (4 commits). Both modify some of the same files (both attempts solve the same problem, so they naturally touch the same code). `choose B` tries to merge attempt B back to the main branch, which has advanced past C. The merge hits conflicts in the files that both attempts modified.

This is especially tricky because the existing `cmdWorktreeMerge()` has sophisticated conflict handling: `merge-tree --write-tree` dry-run, `isAutoResolvable()` for lockfiles, and auto-resolution via `checkout --theirs`. But trajectory merges are conceptually different from worktree merges: worktree merges combine *parallel* work; trajectory merges replace *alternative* work. The winning attempt should fully replace the code at the divergence point — it's not a merge, it's a "take theirs completely."

**Why it happens:**
The merge-based mental model is wrong for trajectory resolution. When you choose attempt B, you want B's code state, not a merge of B with whatever happened on main after the checkpoint. But `git merge` tries to combine both sides.

**Prevention:**
1. **`choose` should NOT use `git merge`.** Instead: (a) record the winning branch name, (b) on the target branch, do `git checkout winning-branch -- .` to take all files from the winner, (c) commit with message `"choose: accept attempt B for task X"`. This is a "theirs wins entirely" strategy, not a merge.
2. **Or use `git merge -X theirs` equivalent:** which resolves all conflicts by taking the winning branch's version.
3. **Pre-flight: verify no work has been done on main after the checkpoint.** If main has advanced (new commits after the checkpoint), the merge is more complex. `choose` should warn: "Main branch has N commits since checkpoint. Merge may have conflicts." In this case, fall back to interactive merge or abort.
4. **Reuse `isAutoResolvable()` from worktree.js** for any remaining conflicts (lockfiles, baselines). Don't reinvent conflict classification.

**Warning signs:**
- `choose` attempts `git merge` and hits conflicts on files the winning attempt modified
- User has to manually resolve conflicts after `choose` (should be automatic for the winning attempt)
- `choose` output says "merged" but the code is a hybrid of both attempts (merge, not replacement)

**Phase to address:** Choose phase. Implement as `checkout --` file replacement, not `merge`.

---

### Pitfall 7: Context Window Pollution from Over-Engineered Comparison Metrics

**What goes wrong:**
`compare` is designed to show outcome metrics across attempts: test results, code complexity, LOC delta, etc. The temptation is to make comparison comprehensive — show everything: test counts, LOC, complexity scores, file lists, commit counts, duration, AST deltas, dependency changes, coverage. This is ~500 tokens per attempt. With 3 attempts = 1,500 tokens of comparison data. The agent reads all of it, reasons about each metric, and produces a 2,000-token analysis. Total: 3,500 tokens spent on comparison — more than most PLAN.md files.

Meanwhile, the actual decision factors are usually just: "Which attempt passes all tests?" and "Which is simpler?"

**Why it happens:**
Comparison metrics feel objectively valuable. Each metric seems cheap to add. But the aggregate cost — in tokens consumed and agent reasoning time — is substantial. This is the Verification Pitfall from v2.0 research applied to comparison: more metrics ≠ better decisions.

The existing `codebase complexity` and `codebase ast` commands already produce rich metrics. The temptation to pipe all of them into `compare` is strong but wrong.

**Consequences:**
- Agent spends more time comparing than building
- Comparison output exceeds context budget for the decision
- Marginal metrics (coverage delta, AST complexity) add noise without changing the decision
- The "decision" becomes an analysis exercise instead of a clear signal

**Prevention:**
1. **Compare output must be ≤300 tokens total.** Hard limit. This forces metric selection.
2. **Default metrics: test pass/fail, LOC delta, file count.** These three are the decision-relevant signals. Everything else is opt-in via `--verbose`.
3. **Decision signal, not data dump.** The compare output should end with a recommendation: `"Attempt B: all tests pass, +15 LOC vs +342 LOC for A. Recommended: B."` — one sentence. The agent doesn't need to reason about the data; the tool already did.
4. **Leverage existing commands, don't duplicate.** `compare` should call `git diff --stat` and the test runner, not reimplement LOC counting or complexity analysis.

**Warning signs:**
- Compare output exceeds 500 tokens
- Agent writes multi-paragraph analysis of comparison results
- Comparison includes metrics that never change the decision (e.g., commit count)
- `compare` takes >5 seconds to run (means it's running expensive analysis)

**Phase to address:** Compare phase — define the metric set (3 defaults) in the first task. Resist pressure to add more.

---

### Pitfall 8: Decision Journal Becomes a Second Memory System

**What goes wrong:**
The existing memory system has 4 stores: `decisions`, `bookmarks`, `lessons`, `todos` (memory.js). The trajectory decision journal is conceptually a 5th store. But if it's implemented as a separate system (e.g., `.planning/trajectory/journal.json`), the codebase now has TWO systems that record decisions:

1. `memory write --store decisions --entry '{"summary":"..."}'`
2. `trajectory journal add --entry '{"approach":"A", "outcome":"failed"}'`

Agents don't know which to query. Workflows inject `memory read --store decisions` but not `trajectory journal read`. Important trajectory decisions get recorded in the journal but never surface in the decisions memory store. Or vice versa: the agent records a trajectory outcome in memory/decisions instead of the journal, and `compare` can't find it.

**Why it happens:**
The memory system was designed before trajectory engineering was planned. The journal is a natural extension of decisions, but implementing it separately is easier than extending the existing memory system. This is the "second system" trap — building a parallel structure instead of extending the first.

**Consequences:**
- Agent queries wrong store for trajectory decisions
- Decisions duplicated across both systems (waste + divergence risk)
- `memory compact` doesn't know about journal entries
- `search-decisions` slash command doesn't search trajectory journal
- Token overhead of loading both systems

**Prevention:**
1. **Trajectory journal IS a memory store.** Add `trajectories` to `VALID_STORES` in memory.js. Entries follow the same `{ timestamp, ... }` pattern. This means `memory read --store trajectories` works, `memory compact` works, and the existing `search-decisions` command can be extended to search trajectories.
2. **OR: journal entries auto-copy to decisions store.** When `choose` resolves a trajectory, it writes a summary entry to `memory write --store decisions`. The detailed per-attempt data stays in trajectory-specific storage, but the outcome is in the canonical decisions store.
3. **NEVER create a parallel persistence mechanism.** No new JSON files, no new directories, no new read/write patterns. Use the existing `cmdMemoryWrite` / `cmdMemoryRead` infrastructure. If it needs extension, extend it.
4. **Add `trajectories` to `SACRED_STORES`** (like `decisions` and `lessons`). Trajectory outcomes should never be auto-compacted.

**Warning signs:**
- New JSON file created outside `.planning/memory/`
- New read/write code that doesn't use `cmdMemoryWrite`/`cmdMemoryRead`
- Agent asks "Where do I record this trajectory outcome?"
- `memory list` doesn't show trajectory entries

**Phase to address:** Decision Journal phase — first task: decide memory integration, not storage format.

---

### Pitfall 9: Agent Confusion from Multiple Active Trajectories in Context

**What goes wrong:**
An agent reads the init output which includes: current plan, current trajectory state (attempt 2 of 3), checkpoint data, journal entries for this task, AND journal entries from the previous task's trajectory. The agent's context now contains information about multiple exploration paths simultaneously. It conflates "Approach A failed for Task 5" with "Approach A failed for Task 6" and avoids Approach A for Task 6 when it might have worked.

Or: the agent is on trajectory attempt B for a task, but the context includes code snippets from attempt A (from the comparison output). The agent accidentally references attempt A's implementation patterns while building attempt B, creating a hybrid that doesn't match either approach.

**Why it happens:**
The existing `init execute-phase` output already includes plan context, phase context, decisions, and blockers. Adding trajectory context (journal, comparison data, attempt history) to this creates a multi-layered context that LLMs struggle with. LLMs are sequential reasoners; simultaneous awareness of multiple alternative timelines is inherently confusing.

This is "Context Confusion" from the Philschmid context engineering research: multiple valid-but-contradictory pieces of information in the same context window.

**Consequences:**
- Agent conflates decisions from different tasks' trajectories
- Agent references wrong attempt's code patterns
- Agent's confidence about approach viability is based on wrong trajectory data
- Increased hallucination rate from contradictory context

**Prevention:**
1. **Trajectory context is task-scoped, ALWAYS.** When working on Task 6, the agent sees ONLY Task 6's trajectory data. No journal entries from Task 5. No comparison data from Task 4. This requires the init output to filter trajectory data by current task ID.
2. **Only the ACTIVE trajectory is in context.** If we're on attempt B, don't inject attempt A's code, metrics, or reasoning into context. The journal entry for A should be one line: "Attempt A: failed (test X broke)." Not the full approach description.
3. **Comparison output is ephemeral.** `compare` produces output, the agent reads it, makes a decision, and the comparison data is NOT injected into subsequent init outputs. It's consumed once at decision time.
4. **Clear trajectory framing in init output.** Instead of mixing trajectory data into the general context, use a clear section: `## Active Trajectory\nTask: 21-02 | Attempt: 2/3 | Checkpoint: abc123 | Previous: A (failed: tests), B (in progress)`. This is ≤100 tokens and orients the agent without confusion.

**Warning signs:**
- Init output includes trajectory data from multiple tasks
- Agent references "attempt A showed that..." while building attempt B
- Agent context grows >5% from trajectory metadata
- Agent asks "Which attempt am I on?"

**Phase to address:** Architecture phase (context injection design) and Decision Journal phase (scoping rules).

---

## Minor Pitfalls

Annoyances that waste time but don't derail the project.

---

### Pitfall 10: Over-Engineering Multi-Level Trajectory Support

The spec says "works at task, plan, and phase level." In practice, 95% of trajectory exploration happens at task level (trying different implementations of a specific change). Plan-level trajectories (trying different plan decompositions) are rare. Phase-level trajectories (trying entirely different phase structures) are almost never needed — that's what the roadmap revision workflow handles.

**Prevention:** Implement task-level trajectories first. Plan-level and phase-level are stretch goals. Don't design for three levels upfront; design for one level well and ensure it can be extended later. The naming convention `traj/<scope>/<task-id>/...` supports future extension without current complexity.

---

### Pitfall 11: Checkpoint Command Conflicting with Existing Git Pre-Commit Checks

The existing `cmdCommit()` in misc.js has pre-commit safety checks (git trailers, agent attribution). If `checkpoint` creates commits (to snapshot state), those commits need to either: (a) go through the same pre-commit pipeline, which adds overhead to what should be a lightweight operation, or (b) bypass pre-commit, which creates commits without proper attribution.

**Prevention:** Checkpoint commits should use a lightweight commit path: `execGit(cwd, ['commit', '-m', 'checkpoint: <name>', '--allow-empty'])`. No pre-commit hooks, no trailers. Mark these commits with a `checkpoint:` prefix so they're identifiable. If pre-commit hooks are configured, use `--no-verify` ONLY for checkpoint commits.

---

### Pitfall 12: Test Suite Fragility from Git State Mutations

Trajectory tests will create branches, switch branches, create commits, and delete branches. The existing 669 tests run in temp directories with isolated git repos (per test fixture setup). But if trajectory tests don't properly isolate their git state, they can:
- Leave `traj/` branches in the test repo that affect subsequent tests
- Change HEAD to a trajectory branch, making subsequent tests run on wrong branch
- Create merge commits that change the git log output for other tests

**Prevention:** Every trajectory test must: (a) create its own temp directory with fresh git repo, (b) verify current branch on test teardown matches test setup, (c) delete all `traj/*` branches on teardown. Use the pattern from existing worktree tests. Add a `cleanup` helper that runs `git branch --list 'traj/*' | xargs git branch -D` on teardown.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Architecture / Foundation | STATE.md divergence across branches (P1), worktree collision (P4) | Separate trajectory state from branch-local state; enforce namespace guards |
| Checkpoint Implementation | Losing uncommitted work (P2), pre-commit hook conflict (P11) | Mandatory dirty check; lightweight checkpoint commits |
| Pivot Implementation | STATE.md revert to stale state (P1), dirty file loss (P2) | Exclude .planning/ from git checkout; pre-flight dirty check |
| Compare Implementation | Over-engineered metrics (P7), context pollution (P9) | 300-token output limit; 3 default metrics only |
| Choose Implementation | Merge conflicts (P6), branch cleanup (P3) | File replacement not merge; delete non-winning branches |
| Decision Journal | Second memory system (P8), stale data (P5), context pollution (P9) | Use existing memory stores; task-scoped context; 500-token budget |
| Multi-Level Support | Over-engineering (P10) | Task-level only in v7.1; plan/phase level deferred |
| Testing | Git state fragility (P12), worktree test collision (P4) | Per-test isolation; branch cleanup on teardown; namespace separation |

## Integration Gotchas with Existing Systems

| Existing System | Trajectory Feature | What Goes Wrong | Prevention |
|----------------|-------------------|----------------|------------|
| `worktree.js` branch naming | `checkpoint` branch creation | Name collision: `traj-*` looks like `worktree-*` to grep | Strict prefix: `traj/` (with slash) vs `worktree-` (with dash) |
| `worktree merge` dry-run | `choose` merge | `merge-tree` picks up trajectory branch changes | Filter `traj/` branches from worktree operations |
| `worktree cleanup` | trajectory branch cleanup | `git branch -D` deletes trajectory branches | Scope cleanup to `worktree-*` pattern only |
| `branchInfo()` upstream detection | trajectory branches | `rev-list HEAD...@{upstream}` fails on branches without upstream | Handle null upstream gracefully (already does, but verify) |
| `cmdCommit()` pre-commit checks | checkpoint commits | Pre-commit hooks slow down what should be instant snapshots | `--no-verify` for checkpoint-prefixed commits only |
| `STATE.md` update/patch | `pivot` branch switch | STATE.md reverts to checkpoint-era content | Exclude STATE.md from git checkout during pivot |
| `memory.js` stores | decision journal | Parallel persistence = two decision systems | Journal IS a memory store, or journal auto-copies to decisions |
| `cmdStateValidate()` | post-pivot state | Validator finds mismatches between STATE.md and phase files | Validator knows about active trajectories; suppress known-divergent checks |
| `init execute-phase` output | trajectory context | Output grows by 1000+ tokens with trajectory data | Task-scoped injection; 500-token trajectory budget |
| `cachedReadFile()` | branch switching | File cache returns pre-switch content | Call `invalidateFileCache()` after any branch switch |
| `getPhaseTree()` cache | branch switching | Phase tree cache returns pre-switch directory listing | Reset `_phaseTreeCache` after any branch switch |
| Snapshot tests (`state-read.json`) | new trajectory fields | Adding trajectory fields to state output breaks snapshots | Don't add trajectory fields to existing state output; use separate command |

## "Looks Done But Isn't" Checklist

- [ ] **Checkpoint "works":** Create checkpoint → modify 5 files → pivot back → ALL 5 files restored to checkpoint state AND STATE.md is still current (not reverted). The round-trip preserves planning state while reverting code state.
- [ ] **Pivot "safe":** With 3 uncommitted files, attempt pivot → pivot REFUSES with clear message. No data lost. Commit the files → pivot succeeds.
- [ ] **Compare "useful":** Compare output for 3 attempts is ≤300 tokens total. An agent reading the output can immediately identify the winner without additional analysis.
- [ ] **Choose "clean":** After choosing attempt B: (a) main branch has B's code, (b) all `traj/` branches for this task are deleted, (c) journal records the choice, (d) `git branch --list 'traj/*'` returns empty for this task.
- [ ] **Journal "compact":** After 5 tasks with trajectories (15 total attempts), the journal is ≤2000 tokens. Resolved tasks have one-line entries. Only the active task has detailed attempt data.
- [ ] **Worktree "unbroken":** All 669 existing tests pass. `worktree create`, `worktree list`, `worktree merge`, `worktree cleanup` work exactly as before. No trajectory branches appear in worktree output.
- [ ] **File cache "coherent":** After `pivot` switches branch, `cachedReadFile()` for STATE.md returns the new branch's content, not the cached pre-switch content. Explicitly test: `invalidateFileCache()` is called after every branch switch.
- [ ] **State validation "aware":** After `pivot`, `state validate` does NOT report false positives for trajectory-related state differences. Validator either knows about active trajectories or trajectory operations update state to be consistent.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|--------------|----------------|
| STATE.md divergence (P1) | HIGH | Redesign state separation; affects all trajectory commands |
| Lost uncommitted work (P2) | UNRECOVERABLE | Data is gone. Prevention is the only strategy. |
| Branch proliferation (P3) | LOW | `git branch --list 'traj/*' \| xargs git branch -D` + add cleanup to choose |
| Worktree collision (P4) | MEDIUM | Rename trajectory branches; add namespace guards to both systems |
| Stale journal (P5) | LOW | Add code-hash stamps; mark old entries as stale |
| Choose merge conflicts (P6) | LOW | Switch from `merge` to `checkout --` file replacement |
| Comparison bloat (P7) | LOW | Reduce metrics to 3 defaults; add token limit |
| Dual memory systems (P8) | MEDIUM | Migrate journal to memory store; delete separate persistence |
| Context confusion (P9) | LOW | Add task-scoping filter to init output |

## Sources

- **Codebase analysis:** `src/lib/git.js` (301 lines, execGit/branchInfo/diffSummary), `src/commands/worktree.js` (791 lines, full worktree lifecycle), `src/commands/state.js` (716 lines, state load/patch/validate), `src/commands/memory.js` (307 lines, 4-store memory system), `src/lib/helpers.js` (cachedReadFile/invalidateFileCache/getPhaseTree), `src/lib/output.js` (196 lines), `src/router.js` (897 lines, command routing)
- **Kiro checkpointing docs** (2025): Shadow repository architecture, session-scoped checkpoints, auto-cleanup on session end — validates the "don't persist branches forever" pattern — https://kiro.dev/docs/cli/experimental/checkpointing/
- **Claude Code checkpoint feature** (2025): Conversation history unwinds with checkpoint restore — validates the "state must unwind consistently" pattern
- **Git branch proliferation literature** (2025): Multiple sources confirm branches are cheap to create, expensive to manage; cleanup must be automated — https://pullpanda.io/blog/deleting-feature-branches-cleanup-strategies
- **Prior v2.0 PITFALLS.md:** Cross-session memory bloat (Pitfall 2), verification overhead (Pitfall 4) — same patterns apply to trajectory data
- **Philschmid context engineering** (2025): Context Confusion — "multiple valid-but-contradictory pieces of information" directly maps to multi-trajectory context

---
*Pitfalls research for: GSD Plugin v7.1 Trajectory Engineering*
*Researched: 2026-02-28*
