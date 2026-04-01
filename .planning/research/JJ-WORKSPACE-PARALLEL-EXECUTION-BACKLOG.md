# JJ Workspace Parallel Execution Backlog

## Milestone

Make JJ workspace parallel execution a real, trustworthy execution mode instead of a prompt-only best effort.

The milestone should close the current gap between documented workspace-first execution and the actual subagent runtime by ensuring plans can run in isolated JJ workspaces and shared planning state is updated by one explicit reconciliation path.

## Planning Guidance

- This backlog is milestone-scoped, not implementation-ready at task level.
- Treat runtime-enforced workspace pinning and shared-state ownership as separate problems that both must be solved.
- Prefer a single-writer reconciliation model for shared planning artifacts over concurrent in-workspace mutation.
- Keep the existing sequential path safe and supported while parallel execution matures.
- Preserve backward compatibility for existing `.planning/` artifacts and supported single-user workflows.

## Problem Summary

Current workflow guidance assumes each runnable plan in a wave can execute inside its own JJ workspace, but the exposed subagent `Task()` interface does not reliably provide a workspace-specific `workdir` contract. As a result, workspace-parallel execution is described in prompts but not enforced by the runtime.

Even if workspace pinning exists, each plan executor still updates shared repo-level planning artifacts such as `STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md`. That makes concurrent plan execution unsafe because each plan can compute and write shared progress from a stale baseline.

This creates two different failure modes:

1. The orchestrator cannot reliably force a subagent to execute from the intended JJ workspace root.
2. Multiple plans can race to update shared planning state even if code changes reconcile cleanly.

## Epic 1: Runtime Workspace Pinning

### Outcome

When the workflow says a plan runs in workspace `X`, the subagent is actually launched with that workspace as its enforced execution root.

### Backlog

- Inventory the real task-spawn contract available to workflows and identify which currently documented spawn fields are advisory-only versus runtime-enforced.
- `Decision` Define the canonical way to pin a spawned subagent to a JJ workspace root.
- Add an explicit runtime contract for workspace-scoped subagent execution, ideally through a real `workdir` field.
- Validate that spawned agents resolve repo-relative reads, writes, git or JJ commands, and build commands against the intended workspace rather than the parent checkout.
- Define failure behavior when workspace creation succeeds but workspace-pinned spawn fails.

## Epic 2: Shared Planning State Ownership

### Outcome

Parallel plan execution no longer lets multiple executors mutate global planning artifacts independently.

### Backlog

- Inventory which plan outputs are safe to produce inside isolated workspaces versus which outputs must remain single-writer.
- `Decision` Define whether `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, bookmarks, and session continuity are always finalized from the main checkout.
- Define a no-shared-state execution mode for workspace-parallel plan executors.
- Ensure plan-local outputs such as code changes and `*-SUMMARY.md` remain workspace-safe and reconcileable.
- Define how partial-wave success is recorded without letting one failed plan block healthy siblings from reporting useful status.

## Epic 3: Reconcile and Finalize Pipeline

### Outcome

The orchestrator can reconcile completed workspaces in a deterministic order, then apply shared planning state updates exactly once from a trusted root.

### Backlog

- Define the canonical reconcile lifecycle: workspace add, execute, inspect, reconcile, finalize, cleanup.
- `Decision` Choose the single-writer finalize surface: workflow logic, one CLI command, or a small family of explicit finalize commands.
- Define what metadata must be collected from each completed workspace before finalization.
- Define deterministic finalize ordering so final shared state is stable regardless of wave completion order.
- Define recovery behavior for stale, divergent, or failed workspaces that should be preserved for inspection while healthy siblings continue.

## Epic 4: Shared-State Consistency Rules

### Outcome

Shared planning artifacts are derived from current truth instead of stale per-plan assumptions.

### Backlog

- Define which shared fields are recomputed from disk after reconcile rather than incrementally patched by each executor.
- `Research` Evaluate whether optimistic concurrency or revision checks are still needed after moving to a single-writer finalize step.
- Define how `ROADMAP.md` progress, `STATE.md` current position, and requirement completion are recalculated after one or more plans finish.
- Define what happens when reconciled code lands but shared-state finalization fails partway through.
- Define proof requirements showing the same final shared state regardless of reconcile order.

## Epic 5: Workflow and Documentation Alignment

### Outcome

Docs and workflows describe only behavior the runtime can actually guarantee.

### Backlog

- Audit workflow docs and expert docs for assumptions about `Task()` spawn fields that are not enforced today.
- `Decision` Choose whether model selection, workspace pinning, and other spawn controls are runtime contract, workflow convention, or both.
- Align `execute-phase` guidance with the true runtime behavior for workspace mode, failure fallback, and shared-state ownership.
- Add clear operator-facing guidance on when sequential fallback is expected and when workspace-parallel mode is fully supported.
- Remove or rewrite documentation that currently implies safe parallelism where only advisory prompting exists.

## Epic 6: Verification and Regression Proof

### Outcome

The project can prove that workspace-parallel execution is both real and safe.

### Backlog

- Add integration coverage for multi-plan same-wave execution in isolated JJ workspaces.
- Add regression tests showing shared planning state is finalized correctly after two or more parallel plans.
- Add tests for partial-wave outcomes: healthy sibling plus failed workspace, stale workspace, and divergent workspace.
- Add proof that sequential mode remains unchanged when workspace mode is disabled or unavailable.
- Add proof that healthy workspace reconciliation plus shared-state finalization produces the same end state independent of completion order.

## Cross-Cutting Unknowns

- Whether the host task runtime can add real workspace pinning directly, or whether bGSD needs a different spawn primitive.
- Whether `SUMMARY.md` should always be authored in the workspace and copied or reconciled back, or finalized only after reconcile.
- Whether requirement completion should remain plan-local input or move fully to post-reconcile derivation.
- Whether current session and bookmark behavior belongs in shared project state during parallel execution.

## Suggested Milestone Sequence

1. Runtime workspace pinning contract
2. Single-writer shared-state ownership model
3. Reconcile and finalize pipeline
4. Shared-state consistency rules
5. Workflow and documentation alignment
6. End-to-end parallel execution proof

## Suggested Acceptance Criteria for the Milestone Agent

- Workspace-parallel execution is enforced by runtime behavior, not only by prompt text.
- Shared planning artifacts are updated by one explicit reconciliation or finalize path rather than by competing plan executors.
- Healthy sibling plans can complete and reconcile even when another workspace in the wave needs recovery.
- Documentation and workflows match the true runtime contract for subagent spawning and workspace execution.
- Sequential execution remains the safe fallback and does not regress while parallel mode is hardened.
