# Phase 183: Plan-Local Workspace Ownership - Research

**Researched:** 2026-04-01
**Domain:** JJ workspace isolation, reconcile/finalize ownership boundaries, and single-writer planning-state promotion
**Confidence:** HIGH

## User Constraints

<user_constraints>
- Shared `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` must update only through one explicit finalize path after reconcile.
- Workspace execution artifacts stay plan-local until finalize; execution and reconcile must not directly mutate authoritative shared planning files.
- Finalize should auto-run by default for routine well-evidenced work, but ambiguity, conflict, missing proof, or policy violations must stop for human review.
- Promotion granularity is one workspace at a time as an atomic unit; do not design partial per-workspace promotion inside this phase.
- Inspection is summary-first by default, with direct proof review required for major completion claims or risky areas.
- First clearly containable direct shared-planning write may be auto-repaired, but repeated or serious violations must quarantine that workspace.
- Shared milestone/phase progress must not be declared complete before finalize.
- Keep scope on ownership/finalize behavior only; do not add new task-management or settings surfaces.
- Treat `effective_intent` as the planning-alignment contract. Treat `jj_planning_context` only as advisory capability context, not as live routing authority.
- Low-overlap sibling continuation is only worth mentioning as a manual preference because the context explicitly allows healthy isolated siblings to continue when another workspace is quarantined.
</user_constraints>

## Phase Requirements

<phase_requirements>
- **JJ-02:** Plan-local outputs are written in the assigned workspace until reconcile rather than mutating shared `.planning/` artifacts directly.
- **FIN-01:** System updates `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` through one explicit single-writer finalize path after reconcile.
</phase_requirements>

## Summary

This phase should be planned as a **single-writer ownership boundary** implementation, not as generic JJ workspace work and not as partial-wave recovery. The repo already has the right building blocks: `workspace prove` establishes workspace-root truth, `workspace reconcile` is already preview-oriented, `execute-plan.md` already says plan-local outputs stay in the assigned workspace, and canonical state updates already flow through dedicated command surfaces (`verify:state complete-plan`, `roadmap update-plan-progress`, `requirements mark-complete`). The missing piece is an orchestration-level finalize step that consumes workspace-local results from a trusted main checkout and is the only place allowed to promote shared planning truth.

JJ's current docs and local `jj 0.39.0` help strongly support this boundary. Multiple workspaces are normal and useful, but stale working copies are also normal when one workspace rewrites another workspace's working-copy commit. That makes workspaces excellent execution sandboxes and bad authorities for shared planning state. The planner should therefore preserve this split: workspaces own local edits, summaries, proof, and reconcile diagnostics; main-checkout finalize owns shared `.planning` mutations.

The best plan shape is: define a workspace result manifest/eligibility contract, add one finalize command family under `execute:` orchestration, route all shared planning writes through existing canonical mutators, and add tests that prove shared planning files remain untouched before finalize. Do **not** solve deterministic sibling ordering or full partial-wave recovery here beyond the already-locked “healthy isolated siblings may still continue” boundary; that belongs to Phase 184.

**Primary recommendation:** Add an `execute:` finalize surface that runs from trusted main-checkout state, consumes workspace-local reconcile/summary/proof metadata, atomically promotes exactly one workspace at a time into shared planning artifacts via existing mutation commands, and rejects or quarantines boundary violations before any shared write occurs.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| JJ CLI | local `0.39.0` | Workspace lifecycle, root resolution, stale recovery, workspace inspection | Official supported backend already used by the repo; docs and local help cover the required primitives |
| Node.js | local `v25.8.2`, repo contract `>=18` | Finalize coordinator and manifest parsing | Existing runtime; no new dependency surface needed |
| Existing bGSD command surfaces | current repo | Canonical shared-state mutation | `verify:state complete-plan`, `roadmap update-plan-progress`, and `requirements mark-complete` already centralize authoritative updates |
| Existing workflow surfaces | current repo | Execution/finalize contract | `workflows/execute-phase.md` and `workflows/execute-plan.md` already encode workspace-proof and workspace-local output rules |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/commands/workspace.js` | current repo | Workspace add/list/forget/cleanup/reconcile entrypoint | Extend for richer reconcile metadata, but keep reconcile preview-oriented |
| `src/lib/jj-workspace.js` | current repo | Workspace proof, health inspection, stale/divergent classification | Reuse for finalize eligibility and quarantine decisions |
| `src/commands/state.js` | current repo | Canonical `STATE.md` mutation | Finalize should call this instead of writing markdown ad hoc |
| `src/commands/roadmap.js` | current repo | Canonical `ROADMAP.md` progress mutation | Finalize should reuse for phase progress updates |
| `src/commands/phase.js` | current repo | Canonical `REQUIREMENTS.md` completion mutation | Finalize should mark requirement completion through this surface |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `execute:` finalize orchestrator | `workspace finalize-*` commands | Reject for primary path: finalize is orchestration/shared-state semantics, not raw workspace lifecycle |
| Reusing canonical mutation commands | Direct markdown edits from finalize | Reject: duplicates business rules and reintroduces multi-writer drift |
| Workspace-local manifests + reconcile preview | Let executor/shared workspaces update `.planning` directly | Reject: breaks JJ-02 and FIN-01 single-writer ownership |

## Architecture Patterns

### Recommended Project Structure
- Keep workspace execution and inspection under `src/commands/workspace.js` / `src/lib/jj-workspace.js`.
- Add a dedicated finalize coordinator under `src/commands/execute/` or equivalent execution orchestration module.
- Store workspace-local result metadata next to the plan summary/proof inside the workspace checkout, not in shared main-checkout planning files.
- Reuse existing canonical planning mutators for `STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md`.

### Pattern 1: Preview first, promote later
1. Executor writes summary/proof only inside the assigned workspace.
2. `workspace reconcile` inspects health and result metadata without mutating shared planning files.
3. Finalize runs from trusted main checkout.
4. Finalize validates proof, boundary compliance, and workspace health.
5. Only then does finalize promote shared planning state.

### Pattern 2: Single-writer finalize coordinator
- Make finalize the only code path that may call shared planning mutators.
- Centralize these writes in one orchestration transaction order:
  1. validate workspace eligibility
  2. record/consume summary + proof metadata
  3. update `STATE.md`
  4. update `ROADMAP.md`
  5. mark requirements complete
  6. emit structured finalize report
- If any precondition fails, do not partially mutate shared planning state.

### Pattern 3: Workspace result manifest
Define one machine-readable per-workspace result bundle with fields such as:

```json
{
  "plan_id": "183-01",
  "workspace_name": "183-01",
  "workspace_root": "/tmp/gsd-workspaces/bgsd-oc/183-01",
  "summary_path": ".planning/phases/183-plan-local-workspace-ownership/183-01-SUMMARY.md",
  "verification_route": "light",
  "proof_status": {
    "behavior": "satisfied",
    "regression": "not-required",
    "human": "not-required"
  },
  "shared_planning_violation": "none",
  "reconcile_status": "healthy"
}
```

This should be produced or normalized before finalize so finalize/verifier/reporting do not infer eligibility from prose.

### Pattern 4: Boundary-violation triage
- First containable shared-planning write attempt: repair, record, continue only if post-repair evidence is clean.
- Repeated/serious violation: quarantine workspace, block finalize for that workspace, preserve artifacts for inspection.
- Healthy isolated siblings may still continue as a manual-safe preference because the context explicitly permits it, but deterministic sibling finalization remains Phase 184 work.

### Anti-Patterns to Avoid
- Letting executor prompts continue to say “Update STATE.md and ROADMAP.md” in workspace mode.
- Writing shared planning markdown directly from workspace-local code.
- Treating `workspace reconcile` as the shared-state mutator.
- Promoting progress before proof and summary inspection.
- Solving sibling finalize ordering and partial-wave determinism in this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shared planning writes | New ad hoc markdown patcher inside finalize | Existing `state`, `roadmap`, and `requirements` mutation commands | Preserves one business-rule source for canonical planning state |
| JJ integration | New JS JJ SDK layer | JJ CLI (`workspace add/root/list/update-stale/status/op log`) | Official CLI already covers the needed behavior |
| Workspace health inference | Custom string guessing in many places | `inspectWorkspace()` + normalized result manifest | Reuses existing stale/divergent/missing classification |
| Promotion granularity | Partial file-by-file shared-state promotion | Atomic per-workspace finalize | Locked by context; avoids ambiguous canonical state |
| Progress authority | Live shared `.planning` updates during execution | Summary/proof inspection plus explicit finalize | Required by JJ-02 and FIN-01 |

## Common Pitfalls

### Pitfall 1: Workspace mode still mutates shared planning files indirectly
**What goes wrong:** Executors running inside a JJ workspace still update `.planning/STATE.md` or `.planning/ROADMAP.md` because old prompts or helper calls assume single-checkout execution.
**Why it happens:** Current Mode B prompt text still says “Update STATE.md and ROADMAP.md,” while workspace mode guidance only constrains output by prose.
**How to avoid:** Make workspace-mode executor contract explicit: workspace-local summaries/proof only, no shared planning mutation; move all shared updates into finalize.
**Warning signs:** Workspace summaries exist before finalize and shared planning files also changed in the main checkout.

### Pitfall 2: Reconcile becomes a hidden finalize
**What goes wrong:** `workspace reconcile` starts mutating canonical state because it already inspects workspace readiness.
**Why it happens:** Preview and promotion are adjacent concerns.
**How to avoid:** Keep reconcile preview-only and make finalize a separate command boundary.
**Warning signs:** Reconcile output includes changed requirement/roadmap/state effects instead of diagnostics only.

### Pitfall 3: Stale workspace behavior is treated as exceptional corruption
**What goes wrong:** A healthy parallel workspace gets over-classified as broken when another workspace rewrites its working-copy commit.
**Why it happens:** JJ stale behavior is normal in multi-workspace use.
**How to avoid:** Treat stale as a first-class recoverable state and rely on `jj workspace update-stale` semantics.
**Warning signs:** Recovery flow discards workspace breadcrumbs or forces full re-execution for ordinary stale cases.

### Pitfall 4: Boundary violations are either ignored or over-punished
**What goes wrong:** The system either quietly tolerates direct shared-state writes or quarantines every small containable slip.
**Why it happens:** No explicit repair-vs-quarantine threshold.
**How to avoid:** Encode the locked policy: auto-repair first clearly containable violation; quarantine repeated or serious violations.
**Warning signs:** No durable violation record, or every minor slip halts the whole wave.

### Pitfall 5: This phase drifts into Phase 184 determinism work
**What goes wrong:** Planning tries to solve final shared-state order independence and partial-wave recovery now.
**Why it happens:** Ownership and finalization are adjacent to determinism.
**How to avoid:** Limit Phase 183 to ownership boundary, manifest, eligibility, and single-writer finalize path.
**Warning signs:** Plans start introducing finalize ordering algorithms or durable sibling recovery stores.

## Code Examples

Verified patterns from official and repo sources.

### Example 1: Official JJ workspace root lookup
```bash
jj workspace root --name 183-01
```
Use this as the authoritative intended-root lookup before or during finalize eligibility checks.

### Example 2: Existing repo reconcile is preview-only
```js
output({
  reconciled: inspected.status === 'healthy',
  mode: 'preview',
  workspace: inspected,
  status: inspected.status,
  diagnostics: inspected.diagnostics,
  recovery_allowed: inspected.recovery_allowed,
  recovery_preview: inspected.recovery_preview,
}, raw);
```
Source: `src/commands/workspace.js`. Preserve this preview contract; do not turn it into the canonical mutator.

### Example 3: Existing repo canonical roadmap mutation
```js
const isComplete = summaryCount >= planCount;
const status = isComplete ? 'Complete' : summaryCount > 0 ? 'In Progress' : 'Planned';
roadmapContent = roadmapContent.replace(planCountPattern, `$1${planCountText}`);
```
Source: `src/commands/roadmap.js`. Finalize should reuse this path instead of editing `ROADMAP.md` by hand.

### Example 4: Existing repo requirement completion mutation
```js
const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqId}\\*\\*)`, 'gi');
reqContent = reqContent.replace(checkboxPattern, '$1x$2');
```
Source: `src/commands/phase.js`. Finalize should mark requirements through this command surface.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-checkout execution directly updating planning files | JJ workspace execution with proof-first isolation and later reconcile/finalize boundary | v19.0 hardening phases 181-183 | Shared planning truth can stay trustworthy during parallel work |
| Treat workspace output location as prompt convention | Explicit workflow/tests requiring plan-local outputs inside assigned workspace | Phase 181 shipped contract | Gives this phase a firm containment baseline |
| Let execution own progress mutation | Main-checkout finalize as sole writer | Current roadmap/architecture direction | Eliminates multi-writer ambiguity for `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` |
| Treat stale workspace as abnormal failure | Treat stale as normal JJ recoverable state via `jj workspace update-stale` | Current JJ docs and local `jj 0.39.0` help | Makes workspace isolation practical without data loss panic |

## Open Questions

1. Should the finalize entrypoint be `execute:finalize-wave`, `execute:finalize-phase`, or a narrower per-workspace `execute:finalize-plan` with orchestration wrappers? I recommend an `execute:` family, but exact surface naming is still a planning choice.
2. Where should the workspace result manifest live for lowest ambiguity: alongside the workspace-local summary, or under a dedicated workspace-local reconcile metadata file? Either is viable if it remains non-authoritative until finalize.
3. What is the smallest explicit heuristic for “major completion claim” / “risky area” proof escalation that remains planner-visible without expanding scope into Phase 182 again?

## Sources

### Primary (HIGH confidence)
- Jujutsu working copy/workspaces docs: https://docs.jj-vcs.dev/latest/working-copy/
- Jujutsu config docs (`snapshot.auto-update-stale`): https://jj-vcs.github.io/jj/latest/config/
- Local JJ help verified on `jj 0.39.0`: `jj help workspace add`, `jj help workspace root`, `jj help workspace update-stale`
- Repo sources: `src/commands/workspace.js`, `src/lib/jj-workspace.js`, `src/commands/state.js`, `src/commands/roadmap.js`, `src/commands/phase.js`

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/phases/183-plan-local-workspace-ownership/183-CONTEXT.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/phases/181-workspace-root-truth-safe-fallback/181-RESEARCH.md`
- `.planning/phases/182-risk-routed-hardening-proof-policy/182-RESEARCH.md`
- `workflows/execute-phase.md`
- `workflows/execute-plan.md`
- `tests/workflow.test.cjs`
- `tests/integration.test.cjs`

### Tertiary (LOW confidence)
- None needed for primary recommendations.

## Metadata

**Confidence breakdown:** HIGH for JJ workspace/stale semantics, existing repo command boundaries, and the recommendation to keep finalize as the sole writer. MEDIUM only for exact finalize command naming and exact manifest-file location because those are not yet implemented.

**Research date:** 2026-04-01

**Valid until:** Revalidate when JJ workspace semantics change, when finalize surfaces ship, or when canonical state mutation commands are redesigned.
