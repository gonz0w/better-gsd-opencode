---
name: git-integration
description: Git workflow patterns for bGSD — commit points (what to commit and when), commit message formats for initialization/task/plan/handoff, per-task commit rationale, example git log, and anti-patterns to avoid.
type: shared
agents: [executor, github-ci]
sections: [commit-points, commit-formats, example-log, anti-patterns, rationale]
---

## Purpose

Defines the git integration strategy for the bGSD framework. The core principle: **commit outcomes, not process.** The git log reads like a changelog of what shipped, not a diary of planning activity. Per-task atomic commits enable failure recovery, git bisect debugging, and granular attribution.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{phase}}` | Current phase identifier | `08-auth` |
| `{{plan}}` | Current plan number | `02` |

## Content

<!-- section: commit-points -->
### What to Commit

| Event | Commit? | Why |
|-------|---------|-----|
| PROJECT.md + ROADMAP created | YES | Project initialization |
| PLAN.md created | NO | Intermediate — commit with plan completion |
| RESEARCH.md created | NO | Intermediate |
| DISCOVERY.md created | NO | Intermediate |
| **Task completed** | **YES** | Atomic unit of work (1 commit per task) |
| **Plan completed** | **YES** | Metadata commit (SUMMARY + STATE + ROADMAP) |
| Handoff created | YES | WIP state preserved |
<!-- /section -->

<!-- section: commit-formats -->
### Commit Message Formats

**Task completion:**
```
{type}({{phase}}-{{plan}}): {task-name}

- [Key change 1]
- [Key change 2]
```

Types: `feat`, `fix`, `test`, `refactor`, `perf`, `chore`, `docs`, `style`.

**Plan completion (metadata):**
```
docs({{phase}}-{{plan}}): complete [plan-name] plan

Tasks completed: [N]/[N]
SUMMARY: .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md
```

**Project initialization:**
```
docs: initialize [project-name] ([N] phases)

[One-liner from PROJECT.md]
```

**Handoff (WIP):**
```
wip: [phase-name] paused at task [X]/[Y]

Current: [task name]
```
<!-- /section -->

<!-- section: example-log -->
### Example Git Log (Per-Task Commits)

```
# Phase 04 - Checkout
1a2b3c docs(04-01): complete checkout flow plan
4d5e6f feat(04-01): add webhook signature verification
7g8h9i feat(04-01): implement payment session creation

# Phase 02 - Auth
5y6z7a docs(02-02): complete token refresh plan
8b9c0d feat(02-02): implement refresh token rotation
1e2f3g test(02-02): add failing test for token refresh
7k8l9m feat(02-01): add JWT generation and validation
0n1o2p chore(02-01): install jose library

# Initialization
5c6d7e docs: initialize ecommerce-app (5 phases)
```

Each plan produces 2-4 commits (tasks + metadata). Clear, granular, bisectable.
<!-- /section -->

<!-- section: anti-patterns -->
### Anti-Patterns

**Don't commit (intermediate):** PLAN.md creation, RESEARCH.md, DISCOVERY.md, minor planning tweaks, "fixed typo in roadmap."

**Do commit (outcomes):** Each task completion (feat/fix/test/refactor), plan completion metadata (docs), project initialization (docs).

**Key principle:** Commit working code and shipped outcomes, not planning process.
<!-- /section -->

<!-- section: rationale -->
### Why Per-Task Commits

**Context engineering:** Git history becomes primary context source for future AI sessions. `git log --grep="{phase}-{plan}"` shows all work for a plan.

**Failure recovery:** Task 1 committed, Task 2 failed → next session sees task 1 complete, retries task 2. Can `git reset --hard` to last successful task.

**Debugging:** `git bisect` finds exact failing task. `git blame` traces to specific task context. Each commit independently revertable.

**Observability:** Granular attribution for solo developer + AI workflow. Atomic commits are git best practice.
<!-- /section -->

## Cross-references

- <skill:commit-protocol /> — Detailed staging and commit execution protocol

## Examples

See `references/git-integration.md` for the original comprehensive reference.
