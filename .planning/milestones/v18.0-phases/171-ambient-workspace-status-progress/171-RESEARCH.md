# Phase 171: Ambient Workspace Status & Progress - Research

**Researched:** 2026-03-31
**Domain:** Trustworthy workspace status, compact context, and progress for attached `cmux` sessions
**Confidence:** HIGH

## User Constraints

- Keep Phase 171 workspace-scoped and trust-first. It may reuse the attached adapter from Phase 170, but it must not reopen targeting proof, multi-workspace routing, or non-`cmux` fallback behavior.
- Honor the locked context from `171-CONTEXT.md`: primary state uses action-first precedence (`Input needed` > `Blocked` > `Warning` > `Working` > `Complete` > `Idle`), `Blocked` remains a true hard-stop state, and compact context prefers workflow meaning over dense roadmap bookkeeping.
- Show exact progress only when the underlying source is trustworthy. When counts are weak, keep any activity hint visibly distinct from exact numeric progress instead of faking precision.
- Prefer existing plugin lifecycle signals, parsed planning state, and notification history over inventing a second orchestration model.
- Keep non-`cmux` and suppressed sessions quiet and unchanged, consistent with `CMUX-08` and the Phase 170 fail-open adapter boundary.

## Phase Requirements

- `CMUX-02` Users see a stable workspace state model (`Working`, `Input needed`, `Blocked`, `Idle`, `Warning`, `Complete`) derived from plugin lifecycle state.
- `CMUX-03` Users see a compact sidebar status pill with trustworthy workflow, phase, plan, or task context.
- `CMUX-04` Users see sidebar progress when signal quality is strong enough, and progress hides rather than guesses when it is not.

## Summary

Phase 171 should build one shared ambient snapshot layer, then wire that snapshot to the already-proven `cmux` adapter from Phase 170. The codebase already has the right ingredients: `src/plugin/project-state.js` and the parsers provide durable planning truth, `src/plugin/notification.js` exposes recent warning/critical events, `src/plugin/idle-validator.js` and `src/plugin/stuck-detector.js` surface the strongest transient warning signals, and `src/plugin/index.js` already owns the lifecycle hooks that can refresh sidebar state without making other subsystems `cmux`-aware.

The most important planning decision is to separate `state derivation` from `sidebar writes`. Phase 171 needs a pure, testable mapping layer that decides three things from existing signals: the primary user-facing state, the compact context label, and whether progress is `exact`, `activity-only`, or `hidden`. Only after that contract is stable should plugin lifecycle hooks call `cmuxAdapter.setStatus`, `clearStatus`, `setProgress`, and `clearProgress`.

**Primary recommendation:** add one plugin-local ambient snapshot helper that consumes `ProjectState`, session continuity, blocker sections, and recent notification history, then add one narrow sidebar sync layer in `src/plugin/index.js` that publishes or clears `cmux` metadata only on trusted lifecycle refresh points.

## Standard Stack

### Core
| Module | Purpose | Why It Is Standard For Phase 171 |
|--------|---------|-----------------------------------|
| `src/plugin/index.js` | Plugin composition root and lifecycle hook wiring | Best place to refresh attached `cmux` sidebar state from existing plugin events |
| `src/plugin/project-state.js` | Unified facade over state, roadmap, config, intent, and current plans | Strongest source for durable phase/plan/workflow context |
| `src/plugin/parsers/state.js` | Parses `STATE.md` fields, blockers, session continuity, and numeric progress | Best canonical source for current status, blockers, and exact progress |
| `src/plugin/parsers/roadmap.js` | Parses roadmap phase goal, completion, and plan counts | Best source for completion and structural fallback context |
| `src/plugin/notification.js` | Stores recent notification history with severity and dedupe | Existing warning/critical history is the safest transient overlay source |
| `https://www.cmux.dev/docs/api` | Official `cmux` sidebar metadata contract | Source of truth for `set-status`, `clear-status`, `set-progress`, `clear-progress`, and `sidebar-state` behavior |

### Supporting
| Module | Purpose | When To Use |
|--------|---------|-------------|
| `src/plugin/context-builder.js` | Existing compact project summary formatting | Reference for concise wording and trustworthy fallback context, not for first-task heuristics |
| `src/plugin/idle-validator.js` | Existing stale/paused and phase-complete signals | Use as a source of trusted `Idle`, `Input needed`, or `Complete` transitions |
| `src/plugin/stuck-detector.js` | Existing warning and critical loop/spinning signals | Use only as warning/blocker overlays, not as durable workflow truth |
| `src/plugin/cmux-targeting.js` | Attached-or-suppressed `cmux` adapter boundary from Phase 170 | Reuse directly; do not re-implement attachment or probe logic |
| `tests/plugin.test.cjs` | Broad plugin integration coverage | Best place to lock attached versus suppressed sidebar behavior |

### `cmux` facts that matter for planning
- `set-status` manages named sidebar status entries, so Phase 171 can keep separate stable keys for primary state and compact context.
- `set-progress` accepts numeric progress from `0.0` to `1.0`; it is appropriate only for exact, trusted progress.
- `clear-progress` exists and should be used whenever the snapshot deems progress untrustworthy.
- `sidebar-state` returns current status and progress metadata, which makes attached-session integration tests possible without adding new transport primitives.

## Architecture Patterns

### Recommended Project Structure
- Add a new plugin-local helper such as `src/plugin/cmux-sidebar-snapshot.js` that derives a stable ambient snapshot from existing planning and notification signals.
- Optionally add a tiny writer helper such as `src/plugin/cmux-sidebar-sync.js` if `src/plugin/index.js` becomes too noisy; keep the write path narrow and adapter-driven.
- Keep `src/plugin/cmux-targeting.js` transport-focused. Phase 171 should consume the attached adapter methods, not expand the targeting boundary.
- Do not make `idle-validator`, `stuck-detector`, `notification`, or parser modules `cmux`-aware. They remain signal sources only.

### Pattern 1: Derive Once, Write Second
Use a two-step contract:
1. `derive snapshot`: choose primary state, compact context, and progress mode (`exact`, `activity`, or `hidden`) from existing trusted signals.
2. `apply snapshot`: translate that snapshot into `cmux` status and progress writes, clearing stale metadata when the snapshot hides it.

This keeps the state model testable without requiring live `cmux` calls in every logic test.

### Pattern 2: Workflow Meaning Beats Bookkeeping
When both are available, prefer compact workflow labels such as `Planning`, `Executing`, or `Verifying` over raw `Phase 171 P02` text. Use phase/plan structure only when workflow meaning is absent but still trustworthy.

### Pattern 3: Exact Progress Is Earned
Treat `state.progress` and clearly derived roadmap/plan counts as exact progress. If the plugin can only prove that work is active, keep that as a distinct activity signal in status/context space rather than sending fake numeric progress.

### Pattern 4: Clear Stale Metadata Aggressively
If context or progress loses trust, explicitly call `clear-status` or `clear-progress` for the affected key. Do not leave old values in the sidebar after the signal has degraded.

### Pattern 5: Refresh on Trusted Lifecycle Boundaries
The safest refresh points already exist:
- plugin startup after the adapter is resolved
- `file.watcher.updated` after planning files change
- `session.idle` after idle validation has a chance to repair stale state
- `tool.execute.after` for active-work and warning overlays

Avoid inventing polling loops or new background workers.

### Anti-Patterns To Avoid
- Reusing `context-builder`'s first-task heuristic as if it were reliable current-task truth
- Turning warning notifications into a permanent `Blocked` state
- Using `set-progress` for non-exact activity hints just to keep the sidebar busy
- Recomputing `cmux` targeting or write-probe logic inside Phase 171
- Making every plugin subsystem perform its own `cmux` writes instead of reusing one sync boundary

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| status mapping | ad hoc inline `if` chains spread across hooks | one shared snapshot helper | keeps precedence, trust gates, and tests in one place |
| progress activity fallback | fake percentages such as `0.5` for "working" | explicit `activity` snapshot mode plus non-numeric status/context hint | avoids deceptive precision |
| transient warnings | separate warning state store | existing notifier history and stuck/idle signals | the plugin already captures these events |
| workspace writes | direct `cmux` CLI calls from validators and detectors | the attached adapter from `cmux-targeting.js` | preserves quiet fail-open behavior |
| context labels | dense structural codes by default | workflow-first labels with structural fallback only when trustworthy | matches locked Phase 171 UX intent |

## Common Pitfalls

### Pitfall 1: Weak heuristics masquerade as trustworthy context
**What goes wrong:** the sidebar shows a current task or exact progress using data that the plugin does not actually track.
**Why it happens:** `context-builder` already shows a helpful first-task summary, so it is tempting to treat that as live truth.
**How to avoid it:** only surface task or exact progress when the source is directly trustworthy; otherwise downgrade to workflow or phase context, or hide the field.
**Warning signs:** plans that say "show task 1/3" without adding a new trustworthy source for current-task position.

### Pitfall 2: Warning and blocked states collapse into one noisy bucket
**What goes wrong:** every degraded signal becomes `Blocked`, so users stop trusting the difference between a repair-required failure and a soft warning.
**Why it happens:** warning and blocker events both look attention-worthy.
**How to avoid it:** preserve the locked hard-stop rule for `Blocked`; use `Warning` for degraded trust, spinning, or advisory issues.
**Warning signs:** plans that map all warning/critical notifications directly to `Blocked`.

### Pitfall 3: Progress lingers after trust is gone
**What goes wrong:** a stale percent remains in the sidebar after the underlying state changed or became uncertain.
**Why it happens:** the write path sets progress but forgets to clear it on downgrade.
**How to avoid it:** make the snapshot explicit about `exact`, `activity`, and `hidden`, and clear stale progress whenever the mode is not exact.
**Warning signs:** plans that talk about setting progress but not about clearing it.

### Pitfall 4: Plugin hooks become `cmux`-specific
**What goes wrong:** validators or detectors start owning `cmux` formatting and write policy.
**Why it happens:** those modules already emit the signals Phase 171 needs.
**How to avoid it:** keep them as event sources only; all `cmux` formatting and writes stay behind one sync helper.
**Warning signs:** plans that modify many plugin subsystems just to add sidebar formatting strings.

## Code Examples

Verified patterns from current project code and official `cmux` docs.

### Recommended snapshot shape
```javascript
{
  status: {
    label: 'Input needed',
    reason: 'ready-to-plan',
    priority: 6,
  },
  context: {
    label: 'Planning',
    source: 'workflow',
    trustworthy: true,
  },
  progress: {
    mode: 'exact', // 'exact' | 'activity' | 'hidden'
    value: 0.4,
    label: 'Phase 171',
  },
}
```

### Exact progress versus activity-only handling
```javascript
if (snapshot.progress.mode === 'exact') {
  await cmuxAdapter.setProgress(snapshot.progress.value, { label: snapshot.progress.label });
} else {
  await cmuxAdapter.clearProgress();
}

if (snapshot.progress.mode === 'activity') {
  await cmuxAdapter.setStatus('bgsd.activity', 'Active');
} else {
  await cmuxAdapter.clearStatus('bgsd.activity');
}
```

### Workflow-first context fallback
```javascript
function deriveContext(state, continuity) {
  if (/verification/i.test(state.status || '') || /verify/i.test(continuity.nextStep || '')) {
    return { label: 'Verifying', source: 'workflow', trustworthy: true };
  }
  if (/ready to plan/i.test(state.status || '')) {
    return { label: 'Planning', source: 'workflow', trustworthy: true };
  }
  if (state.currentPlan && state.currentPlan !== 'Not started') {
    return { label: `Phase ${state.phase} P${String(state.currentPlan).padStart(2, '0')}`, source: 'structure', trustworthy: true };
  }
  return { label: null, source: 'none', trustworthy: false };
}
```

## Recommended Plan Slices

### Slice 1: Define the canonical ambient snapshot contract
**Goal:** Lock the stable state vocabulary, workflow-first context rules, and progress trust gates in one pure helper.

Likely modules:
- new `src/plugin/cmux-sidebar-snapshot.js`
- new `tests/plugin-cmux-sidebar-snapshot.test.cjs`

Done when:
- state precedence is deterministic and test-covered
- context degrades from workflow to structure to hidden based on trust
- progress is classified as `exact`, `activity`, or `hidden` without fake precision

### Slice 2: Wire the snapshot to attached `cmux` sidebar updates
**Goal:** Publish or clear sidebar metadata on trusted lifecycle transitions without changing suppressed or non-`cmux` behavior.

Likely modules:
- `src/plugin/index.js`
- optional new `src/plugin/cmux-sidebar-sync.js`
- `tests/plugin.test.cjs`

Done when:
- attached sessions publish state/context/progress through stable keys
- weak signals clear stale metadata
- suppressed adapters remain quiet and existing plugin hooks continue to work

## Verification Targets

### Must-prove behaviors
- `Ready to plan`, required replies, or equivalent human-gated states surface as `Input needed` instead of `Idle`.
- True blockers remain `Blocked`, while warning-only conditions stay `Warning`.
- Workflow labels such as `Planning` or `Verifying` beat raw structural labels when both are trustworthy.
- Exact progress only appears when numeric progress is trustworthy; activity-only cases do not use fake percentages.
- Attached `cmux` sessions clear stale context/progress when trust drops.
- Suppressed or non-`cmux` sessions remain fail-open and unchanged.

### Regression surfaces that should likely change
- `src/plugin/index.js`
- new `src/plugin/cmux-sidebar-snapshot.js`
- optional new `src/plugin/cmux-sidebar-sync.js`
- `tests/plugin.test.cjs`
- new `tests/plugin-cmux-sidebar-snapshot.test.cjs`

### Regression surfaces that should likely stay mostly unchanged
- `src/plugin/cmux-targeting.js`
- `src/plugin/idle-validator.js`
- `src/plugin/stuck-detector.js`
- `src/plugin/notification.js`

If planning expects broad changes in those modules, the phase is probably over-scoped.

## Open Planning Risks

- `STATE.md` does not currently expose a strong live current-task position, so task-level context may need to stay hidden or degrade to plan/workflow labels.
- `state.progress` is explicit when present, but not every active workflow updates it consistently. The plan should treat exact progress as opt-in and keep non-numeric activity distinct.
- Notification history is useful for warning overlays, but it is intentionally transient. The plan should use it for recent warnings, not as a durable source of completion or workflow truth.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/171-ambient-workspace-status-progress/171-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/MILESTONE-INTENT.md`
- `.planning/research/CMUX-FIRST-UX-PRD.md`
- `.planning/research/CMUX-FIRST-UX-BACKLOG.md`
- `.planning/phases/170-cmux-workspace-detection-safe-targeting/170-RESEARCH.md`
- `src/plugin/index.js`
- `src/plugin/project-state.js`
- `src/plugin/parsers/state.js`
- `src/plugin/parsers/roadmap.js`
- `src/plugin/context-builder.js`
- `src/plugin/notification.js`
- `src/plugin/idle-validator.js`
- `src/plugin/stuck-detector.js`
- `src/plugin/cmux-targeting.js`
- `tests/plugin.test.cjs`
- `tests/plugin-progress-contract.test.cjs`
- Official cmux API docs: `https://www.cmux.dev/docs/api`

### Secondary (MEDIUM confidence)
- Existing plugin-facing warning and completion hints inferred from `src/plugin/advisory-guardrails.js`

## Metadata

**Confidence breakdown:** existing durable state/progress sources: HIGH. warning and completion overlay reuse: HIGH. current-task fidelity: MEDIUM. exact progress coverage across all workflows: MEDIUM.

**Research date:** 2026-03-31

**Valid until:** 2026-04-30 or until the plugin adds a stronger current-task/status contract or `cmux` changes sidebar metadata semantics.
