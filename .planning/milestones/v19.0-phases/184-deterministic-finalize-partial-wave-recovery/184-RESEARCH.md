# Phase 184: Deterministic Finalize & Partial-Wave Recovery - Research

**Researched:** 2026-04-01
**Domain:** Deterministic JJ workspace finalize orchestration, partial-wave recovery, and inspectable shared-state promotion
**Confidence:** HIGH

## User Constraints

<user_constraints>
- Preserve the original planned wave order as the canonical finalize order.
- Later healthy siblings may finish work, but they must stop at a staged-ready state and must not promote shared state past the first earlier unhealthy sibling.
- Shared state must remain explicitly `recovery-needed` until all earlier gating siblings are resolved.
- Produce one canonical recovery summary per wave/workspace that names current status, exact gating sibling, blocking reason, next command, and deeper proof artifacts.
- Recovery and finalize reruns happen from trusted main-checkout state, not from inside a target workspace.
- Default inspection is summary-first, with direct proof review required for risky or shared-state completion claims.
- Preserve already-healthy staged work on rerun; do not require re-execution just because another sibling blocked promotion.
- Scope is deterministic finalize/recovery behavior only; do not expand into new task-management systems, cmux polish, or rework Phase 183 ownership boundaries.
- Treat `effective_intent` as the default source of objective/milestone/outcome alignment. Treat `jj_planning_context` only as capability context, not live routing authority.
- Any mention of low-overlap sibling continuation is manual preference only when explicit overlap evidence exists; do not recommend heuristic sibling routing.
</user_constraints>

## Phase Requirements

<phase_requirements>
- **FIN-02:** Healthy sibling workspaces can reconcile and report useful status even when another workspace in the same wave fails, goes stale, or needs recovery.
- **FIN-03:** Final shared planning state is deterministic regardless of the order in which healthy workspaces finish or are finalized.
- **FIN-04:** System preserves inspectable recovery metadata when a workspace becomes stale, divergent, or finalize fails partway through.
</phase_requirements>

## Summary

This phase should be planned as a **wave-level deterministic promotion layer** on top of Phase 183's single-workspace finalize boundary. The repo already has the right base pieces: workspace-local result manifests, preview-only `workspace reconcile`, a trusted-main `execute:finalize-plan` coordinator, JJ-backed stale/divergent diagnostics, and canonical mutators for `STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md`. What is missing is the sibling-aware orchestration that turns several independently healthy workspaces into one stable shared result without letting completion order leak into the final state.

The strongest pattern is a **two-step staged/finalize pipeline**. Reconcile each completed sibling independently, normalize each result into durable staged metadata, then run a deterministic finalize pass from trusted main checkout that walks siblings in canonical planned order and stops at the first earlier unhealthy or policy-blocked sibling. Later healthy siblings remain staged-ready instead of being discarded or promoted out of order. Shared state becomes `recovery-needed` rather than falsely complete, and reruns recompute promotion from trusted disk truth plus staged manifests instead of relying on operator memory or prior completion timing.

JJ's current docs confirm that stale workspaces are normal in multi-workspace flows, `jj workspace update-stale` is the supported recovery step, and `jj op log` / `--at-op` give durable inspection surfaces for deeper proof. That means the planner should not invent new VCS recovery logic. Instead, add one canonical wave recovery summary that points to JJ-backed evidence, records the gating sibling and exact blocker, and tells the operator the next command to run. Determinism should come from ordered manifest consumption and recomputation, not from hoping healthy siblings finish in the same order every time.

**Primary recommendation:** Add a wave-scoped finalize coordinator that consumes durable per-sibling staged manifests in canonical plan order, promotes only the longest healthy prefix into shared state, leaves later healthy siblings staged-ready behind the first blocker, and emits one canonical recovery summary that names the gating sibling, blocker, next command, and proof links.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| JJ CLI | local `0.39.0` | Workspace status, stale recovery, conflict detection, operation-log evidence | Official supported backend already used by the repo; docs and local runtime cover the needed recovery primitives |
| Node.js | local `v25.8.2`, repo contract `>=18` | Deterministic finalize coordinator and manifest/recovery-summary generation | Existing runtime; no new dependency surface required |
| Existing `workspace reconcile` + `execute:finalize-plan` surfaces | current repo | Reconcile diagnostics plus trusted-main promotion | Already establishes preview-first reconcile and main-checkout-only promotion |
| Existing canonical mutators (`verify:state`, `plan:roadmap`, `plan:requirements`) | current repo | Authoritative shared-state updates | Reuses current business rules instead of re-implementing markdown mutation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/jj-workspace.js` | current repo | Normalize health, result manifests, recovery previews, shared-planning violation checks | Extend with staged-ready and wave gating metadata instead of duplicating workspace inspection logic |
| `jj workspace update-stale` | JJ `0.39.0` | Official stale-workspace recovery | Use when a workspace is stale and recovery is automation-safe |
| `jj op log` / `--at-op` | JJ `0.39.0` | Deep recovery evidence and history inspection | Link from the canonical recovery summary when operator needs proof beyond the summary |
| File-based staged manifest + wave recovery summary | current repo pattern | Durable rerun inputs and inspectable operator surface | Use for idempotent reruns and deterministic finalize recomputation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canonical planned wave order | Finalize in completion order | Reject: violates FIN-03 because shared state would depend on sibling timing |
| Explicit staged-ready barrier | Re-run healthy siblings after blocker recovery | Reject: wastes completed work and violates the locked preserve-progress decision |
| Canonical wave recovery summary | Make operators inspect raw manifests / JJ output directly | Reject: violates the locked summary-first inspection contract |
| Explicit recovery-needed shared state | Report partial success as if finalize completed | Reject: hides blockers and misstates wave completion |
| JJ CLI recovery primitives | Custom JS JJ state machine / SDK layer | Reject: unnecessary dependency and higher correctness risk |

## Architecture Patterns

### Recommended Project Structure
- Keep workspace health inspection in `src/lib/jj-workspace.js` and `src/commands/workspace.js`.
- Add a wave-aware finalize coordinator under the execute/orchestration path, not under raw workspace lifecycle helpers.
- Persist one per-sibling staged manifest next to workspace-local summary/proof artifacts.
- Persist one canonical wave recovery summary under shared `.planning/` so operators have a single inspection entrypoint from trusted main checkout.
- Continue routing all shared planning writes through existing canonical mutators.

### Pattern 1: Reconcile → stage → deterministic finalize
1. `workspace reconcile {plan_id}` stays preview-only and produces normalized per-sibling readiness metadata.
2. Healthy siblings write or refresh a durable staged manifest from trusted main checkout metadata plus workspace-local artifact references.
3. The wave finalize coordinator sorts siblings by canonical planned order, not completion order.
4. It promotes only the contiguous healthy prefix.
5. The first earlier unhealthy/quarantined/finalize-failed sibling becomes the gating sibling.
6. All later healthy siblings stay `staged_ready` and are not re-executed.
7. Shared state is marked `recovery-needed` until the gating sibling is resolved and finalize is rerun.

### Pattern 2: Ordered prefix promotion, not independent per-sibling promotion
- Treat a wave as an ordered list with three zones:
  1. `finalized` — healthy prefix already promoted
  2. `staged_ready` — healthy but blocked behind an earlier gating sibling
  3. `recovery_needed` — stale, divergent, missing-proof, quarantined, or finalize-failed siblings
- Determinism comes from recomputing these zones from disk truth on every rerun.
- Never let a later sibling change shared milestone truth before every earlier sibling is finalized or explicitly still eligible in order.

### Pattern 3: Canonical recovery summary as the operator contract
Use one shared summary with at least:

```json
{
  "wave_id": "184-wave-01",
  "status": "recovery-needed",
  "gating_sibling": "184-01",
  "blocking_reason": "stale",
  "next_command": "jj -R /path/to/workspace workspace update-stale",
  "staged_ready": ["184-02", "184-03"],
  "finalized": [],
  "proof_artifacts": {
    "summary": ".planning/phases/.../184-01-SUMMARY.md",
    "jj_op_log": "jj -R /path/to/workspace op log --limit 10",
    "reconcile_preview": "workspace reconcile 184-01"
  }
}
```

This summary should be regenerated on every finalize/recovery rerun so it remains canonical, not appended ad hoc.

### Pattern 4: Idempotent rerun from trusted main checkout
- Reruns should reload all sibling manifests, recompute canonical order, and derive shared-state effects again from current truth.
- Finalized siblings must remain finalized.
- Staged-ready siblings must stay promotable without re-execution.
- Recovery summaries must be overwritten with current truth, not layered as manual incident notes.

### Pattern 5: Failure taxonomy must drive next-command clarity
Use a small explicit blocker taxonomy and map each to one next action:
- `stale` → `jj workspace update-stale`
- `divergent` → manual `jj resolve` / conflict resolution
- `proof_missing` → regenerate proof artifact in the workspace
- `quarantine` → inspect policy violation and repair before finalize
- `finalize_failed` → rerun finalize from trusted main checkout after fixing the shared-state failure cause

### Anti-Patterns to Avoid
- Calling `execute:finalize-plan` independently for siblings and assuming wave-level determinism emerges automatically.
- Encoding promotion order from “who finished first” timestamps.
- Treating stale JJ workspaces as corruption that requires re-execution.
- Using `snapshot.auto-update-stale` as a substitute for explicit recovery-needed state.
- Appending human prose status notes instead of regenerating a canonical machine-readable recovery summary.
- Editing shared planning markdown directly inside new wave-finalize code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workspace recovery | Custom stale/divergence recovery engine | JJ CLI (`workspace update-stale`, `status`, `resolve`, `op log`, `--at-op`) | Official supported semantics already exist |
| Shared-state mutation | New markdown patcher for finalize/recovery | Existing `verify:state`, `plan:roadmap`, and `plan:requirements` commands | Keeps one source of truth for planning rules |
| Sibling ordering | Timestamp- or heuristic-based ordering | Canonical planned wave order from phase/plan metadata | Required for FIN-03 determinism |
| Recovery inspection | Ad hoc logs spread across artifacts | One canonical recovery summary with links to deeper proof | Matches locked operator contract |
| Rerun memory | Infer progress from old console output | Durable staged manifests plus recomputation from trusted main checkout | Preserves healthy work and supports idempotent recovery |
| JJ integration | New SDK or repo-introspection layer | Existing JJ CLI invocations and current repo helpers | Less surface area, lower drift risk |

## Common Pitfalls

### Pitfall 1: Completion order leaks into shared state
**What goes wrong:** Later healthy siblings promote shared state before earlier blocked siblings are resolved.
**Why it happens:** The system finalizes each healthy workspace independently instead of enforcing ordered prefix promotion.
**How to avoid:** Introduce a wave-level finalize pass that sorts by canonical plan order and stops at the first blocker.
**Warning signs:** Re-running finalize with a different sibling completion order changes `STATE.md`, `ROADMAP.md`, or requirement completion.

### Pitfall 2: Healthy work is lost when one sibling blocks
**What goes wrong:** Operators must re-run already-healthy siblings after fixing a stale/divergent blocker.
**Why it happens:** Finalize stores only promoted state, not staged-ready state.
**How to avoid:** Persist durable staged manifests for healthy but blocked siblings and recompute from them on rerun.
**Warning signs:** Recovery instructions say to re-execute a sibling that already has valid summary/proof artifacts.

### Pitfall 3: Stale is treated as exceptional corruption
**What goes wrong:** Ordinary JJ stale workspaces are escalated as mysterious failure, or cleanup deletes them too early.
**Why it happens:** Multi-workspace JJ semantics are misunderstood.
**How to avoid:** Treat stale as a first-class recoverable status and point operators to `jj workspace update-stale`.
**Warning signs:** Recovery output lacks an update-stale command or tells operators to rebuild the workspace from scratch.

### Pitfall 4: Recovery-needed is implied, not explicit
**What goes wrong:** Shared state looks complete even though an earlier sibling is still blocking wave completion.
**Why it happens:** Partial-wave success is recorded only in logs or local manifests.
**How to avoid:** Make `recovery-needed` a canonical shared-state marker and keep it until the wave is fully promotable.
**Warning signs:** Phase progress appears complete while a recovery summary still names a blocking sibling.

### Pitfall 5: Recovery summary becomes a stale narrative
**What goes wrong:** Operators read old blocker information or wrong next commands.
**Why it happens:** The summary is appended manually instead of regenerated from current manifests and JJ diagnostics.
**How to avoid:** Treat the summary as canonical generated state, overwritten on every rerun.
**Warning signs:** Summary timestamps lag reconcile/finalize attempts or disagree with current workspace status.

### Pitfall 6: Auto-updating stale workspaces hides required operator semantics
**What goes wrong:** JJ config silently refreshes stale workspaces, but bGSD loses the explicit recovery-needed story required by this phase.
**Why it happens:** `snapshot.auto-update-stale` is mistaken for a complete product-level recovery design.
**How to avoid:** Keep bGSD recovery state authoritative even if JJ auto-update is optionally enabled.
**Warning signs:** A stale sibling disappears from recovery reporting without any canonical summary update.

### Pitfall 7: Wave-level finalize does partial shared writes on failure
**What goes wrong:** Some shared planning artifacts update before finalize fails, leaving ambiguous truth.
**Why it happens:** Promotion is implemented as a sequence of writes without a recomputation/report boundary.
**How to avoid:** Compute the full intended promotion set first, then apply canonical mutators in one ordered pass and emit recovery metadata if any step fails.
**Warning signs:** `STATE.md` and `ROADMAP.md` disagree about whether a plan or phase completed after a failed finalize rerun.

## Code Examples

Verified patterns from official and repo sources.

### Example 1: Official JJ workspace root lookup
```bash
jj workspace root --name 184-02
```
Use this as the canonical workspace-location lookup for proof links and recovery commands.

### Example 2: Official stale recovery command
```bash
jj -R /path/to/workspace workspace update-stale
```
JJ documents this as the supported recovery step when a workspace becomes stale.

### Example 3: Official operation-log evidence
```bash
jj -R /path/to/workspace op log
jj -R /path/to/workspace log --at-op=<operation-id>
```
Use these as deeper proof artifacts linked from the canonical recovery summary rather than inventing custom low-level evidence stores.

### Example 4: Current repo reconcile stays preview-only
```js
output({
  reconciled: inspected.status === 'healthy',
  mode: 'preview',
  workspace: inspected,
  status: inspected.status,
  result_manifest: inspected.result_manifest,
  diagnostics: inspected.diagnostics,
  recovery_allowed: inspected.recovery_allowed,
  recovery_preview: inspected.recovery_preview,
}, raw);
```
Source: `src/commands/workspace.js`. Keep reconcile diagnostic-only; add wave staging/finalize on top of it.

### Example 5: Current repo finalize uses canonical mutators
```js
execCanonical(cwd, ['verify:state', 'complete-plan', '--phase', parsed.phase, '--plan', parsed.plan, ...]);
execCanonical(cwd, ['plan:roadmap', 'update-plan-progress', parsed.phase]);
execCanonical(cwd, ['plan:requirements', 'mark-complete', ...requirements]);
```
Source: `src/commands/misc/finalize.js`. Wave finalize should keep this pattern and widen it to deterministic sibling promotion rather than writing markdown directly.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Assume healthy siblings must wait or be re-executed after any blocker | Preserve healthy work as staged-ready and rerun deterministic promotion later | Current phase context / v19.0 direction | Better operator efficiency without sacrificing deterministic shared state |
| Treat stale workspaces as unusual failure | JJ docs treat stale as normal multi-workspace behavior with `workspace update-stale` recovery | Current JJ docs, verified on local `0.39.0` | Recovery design should model stale explicitly, not as corruption |
| Use raw logs/manifests for debugging partial-wave issues | Use one canonical summary with links to JJ op-log and reconcile evidence | Current phase context | Faster operator triage and less reconstruction work |
| Rely on completion timing to infer final order | Recompute from canonical planned order plus durable manifests | Required for FIN-03 | Same final shared state regardless of finish order |
| Manual stale updates only | JJ also supports optional `[snapshot] auto-update-stale = true` | Present in current JJ docs | Helpful capability, but not a substitute for explicit bGSD recovery-needed semantics |

## Open Questions

1. Should the wave-level surface be a new `execute:finalize-wave` command, or should execution orchestration call `execute:finalize-plan` through a higher-order ordered coordinator? I recommend a wave-scoped coordinator that may delegate per-plan promotion internally.
2. What exact status name should represent “healthy but blocked behind an earlier sibling” (`staged_ready`, `ready_blocked`, etc.)? The concept is locked; only naming remains open.
3. Where should the canonical recovery summary live for easiest operator discovery and future cmux integration: phase-level shared artifact, wave-level artifact, or both with one canonical source?
4. Should finalize-failed be represented as a sibling status in the same blocker taxonomy as stale/divergent/quarantine, or as a separate wave-level failure wrapper around an otherwise healthy sibling?

## Sources

### Primary (HIGH confidence)
- Jujutsu working copy docs: https://docs.jj-vcs.dev/latest/working-copy/
- Jujutsu operation log docs: https://docs.jj-vcs.dev/latest/operation-log/
- Jujutsu config docs (`snapshot.auto-update-stale`): https://docs.jj-vcs.dev/latest/config/
- Jujutsu CLI reference (`workspace`, `util exec`, `--at-op`): https://docs.jj-vcs.dev/latest/cli-reference/
- Local JJ runtime verified with `jj --version` → `0.39.0`
- Repo sources: `src/commands/misc/finalize.js`, `src/commands/workspace.js`, `src/lib/jj-workspace.js`, `workflows/execute-phase.md`, `workflows/execute-plan.md`
- Repo tests: `tests/finalize.test.cjs`, `tests/workspace.test.cjs`, `tests/workspace-ownership.test.cjs`

### Secondary (MEDIUM confidence)
- `.planning/INTENT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/research/JJ-WORKSPACE-PARALLEL-EXECUTION-BACKLOG.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/SUMMARY.md`
- `.planning/research/PITFALLS.md`
- `.planning/phases/183-plan-local-workspace-ownership/183-RESEARCH.md`
- `.planning/phases/184-deterministic-finalize-partial-wave-recovery/184-CONTEXT.md`

### Tertiary (LOW confidence)
- None used for core claims.

## Metadata

**Confidence breakdown:** HIGH for JJ workspace/stale/op-log semantics and current repo finalize/reconcile surfaces; HIGH for the need to use canonical plan order and explicit recovery-needed state because both are locked by phase context and requirements; MEDIUM for exact command naming and artifact placement because the concept is clear but the final surface naming is still open.

**Research date:** 2026-04-01

**Valid until:** Next JJ workspace-semantics upgrade or the next finalize-surface redesign in this repo; otherwise re-check by 2026-05-15.
