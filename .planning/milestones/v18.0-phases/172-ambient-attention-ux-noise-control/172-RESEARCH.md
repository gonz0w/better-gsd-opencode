# Phase 172: Ambient Attention UX & Noise Control - Research

**Researched:** 2026-03-31
**Domain:** Trustworthy `cmux` ambient logs, notifications, and noise control for attached workspaces
**Confidence:** HIGH

## User Constraints

- Keep the Phase 170-171 trust gate intact. Only attached, write-proven `cmux` sessions may receive logs or notifications; suppressed or non-`cmux` sessions must stay silent.
- Honor the locked channel split from `172-CONTEXT.md`: sidebar logs are the default narrative surface, while notifications are the interruptive escalation surface.
- Stay quiet by default. Routine workflow starts and routine task completions should log, not notify.
- Escalate notifications for attention-worthy moments only: checkpoints, required user input, blockers, warnings, plan completion, phase completion, and terminal workflow completion.
- Do not expand scope into a notification center/history UI, user-configurable preferences, Phase 170 targeting changes, or Phase 171 state/progress redesign.
- Keep copy terse, one-line, and action-first so the sidebar remains glanceable.

## Phase Requirements

- `CMUX-05` Users see concise sidebar log entries for major lifecycle moments such as planner start, task completion, waiting for input, blocker detection, and state warnings.
- `CMUX-06` Users get `cmux` notifications for attention-worthy moments such as checkpoints, blockers, warnings, and completion events.
- `CMUX-09` Users do not get noisy or repetitive sidebar churn because non-essential updates are deduped and rate-limited.

## Summary

Phase 172 should be planned as an **attention-policy layer**, not as a general plugin rewrite. The project already has the right foundations: Phase 170 provides a trust-gated attached `cmux` adapter, and Phase 171 already splits durable sidebar snapshot derivation from sidebar writes. The missing piece is a second pure layer that classifies lifecycle moments into `log only`, `notify + log`, or `suppress`, then emits those actions only when a meaningful transition occurs.

The most important design choice is to keep **sidebar snapshot sync** and **attention event emission** separate. Snapshot sync is level-triggered and idempotent: it can run on startup, file changes, idle, and tool events. Attention emission must be edge-triggered: it should fire only when a semantic event first occurs, when severity meaningfully changes, or when a completion boundary is crossed. If Phase 172 reuses the refresh loop directly for logs and notifications, it will spam users.

`cmux` now provides exactly the primitives this phase needs: workspace-scoped `log`, `notify`, keyed status pills, progress, `sidebar-state`, and a built-in notification panel with unread badges and focused-window suppression. That means Phase 172 should reuse `cmux` as the delivery surface, reuse existing plugin signal sources as inputs, and add only one policy module plus one narrow writer module.

**Primary recommendation:** add a pure `cmux` attention policy helper that turns current plugin lifecycle/state signals into semantic events with dedupe keys and escalation rules, then wire a narrow attached-only writer that uses `cmuxAdapter.log(...)` and a newly added `cmuxAdapter.notify(...)` for first-occurrence attention moments and meaningful completion boundaries.

## Standard Stack

### Core
| Module / API | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| `src/plugin/cmux-targeting.js` | repo current | Trust-gated attached `cmux` adapter boundary | Already enforces workspace-safe targeting and write-path proof; Phase 172 must extend it, not bypass it |
| `src/plugin/cmux-sidebar-snapshot.js` | repo current | Durable state/context/progress derivation | Existing Phase 171 truth layer; attention UX should consume its outputs, not recreate state logic |
| `src/plugin/index.js` | repo current | Lifecycle hook orchestration | Already owns startup, file watcher, idle, and tool hooks that can feed attention events |
| `src/plugin/notification.js` | repo current | Existing dedupe/rate-limit/history patterns for local notifications | Best reference for noise-control mechanics and recent warning/critical signal history |
| `cmux` CLI / socket API (`log`, `notify`, `sidebar-state`) | current docs (2026-03-31) | Workspace-scoped delivery surface for logs and notifications | Official primitives already exist; no custom transport or UI needed |

### Supporting
| Module / API | Version | Purpose | When to Use |
|--------------|---------|---------|-------------|
| `src/plugin/idle-validator.js` | repo current | Emits phase-complete and state-sync moments | Use as a trusted source for completion and validation-warning events |
| `src/plugin/stuck-detector.js` | repo current | Emits spinning/error-loop warnings | Use as trusted warning/blocker signal input |
| `src/plugin/advisory-guardrails.js` | repo current | Emits warning/info advisory events | Use selectively for warning-class ambient attention, not for routine chatter |
| `src/plugin/project-state.js` and parser stack | repo current | Durable phase/plan/workflow context | Use to enrich log lines and completion dedupe keys |
| `cmux` notification panel / unread lifecycle | current docs (2026-03-31) | Built-in unread attention surface | Use instead of inventing history or inbox UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cmux notify` via attached adapter | OSC 777 / OSC 99 escape sequences | Official docs say CLI is the easiest integration; OSC is useful for simple scripts but weaker for workspace-scoped plugin routing |
| Dedicated attention policy module | Inline `if` chains inside `index.js` hooks | Faster short-term, but guarantees drift, duplicated dedupe logic, and poor testability |
| Semantic event dedupe keys | Time-only throttling | Time-only throttling still repeats “same meaning” events after each refresh cycle |

## Architecture Patterns

### Recommended Project Structure
- Add a pure helper such as `src/plugin/cmux-attention-policy.js`.
- Optionally add a tiny writer such as `src/plugin/cmux-attention-sync.js` if `index.js` would otherwise become noisy.
- Extend `src/plugin/cmux-targeting.js` and its client wrappers with `notify(...)` support so attention delivery stays behind the same attached/suppressed boundary as logs and status.
- Keep `idle-validator`, `stuck-detector`, `advisory-guardrails`, and `notification` as signal sources only. Do not make them `cmux`-aware.

### Pattern 1: Separate Level-Triggered Snapshot Sync from Edge-Triggered Attention
Use two independent flows:
1. **Snapshot sync** keeps current state/context/progress accurate.
2. **Attention sync** emits logs/notifications only for semantic event transitions.

This is the established safe pattern for this codebase because `refreshCmuxSidebar()` already runs often. Logs and notifications must not fire on every refresh.

### Pattern 2: Event Taxonomy Before Delivery
Normalize raw plugin signals into a small canonical event set before writing anything:
- `workflow-start`
- `planner-start`
- `executor-start`
- `task-complete`
- `waiting-input`
- `checkpoint`
- `warning`
- `blocker`
- `plan-complete`
- `phase-complete`
- `workflow-complete`
- `state-sync`

Delivery policy should then be simple and locked:
- **Log only:** starts, routine task completion, state-sync, low-value recoveries
- **Log + notify:** waiting-input, checkpoint, blocker, first warning, plan-complete, phase-complete, workflow-complete
- **Suppress:** duplicate, low-signal, or refresh-only events

### Pattern 3: Semantic Dedupe Keys, Not Raw String Dedupe
Deduplicate by event meaning, not just message text. Use keys built from:
- workspace ID
- event kind
- phase/plan/task boundary if present
- stable identity payload (for example blocker fingerprint or warning type)

Good examples:
- `plan-complete:172:02`
- `phase-complete:172`
- `waiting-input:ready-to-plan`
- `warning:stuck-spinning`

This prevents copy tweaks or context wording changes from bypassing dedupe.

### Pattern 4: Escalate on First Occurrence, Then Cool Down
For warnings and blockers:
- first occurrence: log + notify
- repeated unchanged condition: log rarely or suppress
- changed severity or cleared-then-recurred condition: notify again

Use a short dedupe window for burst suppression plus a longer reminder cadence only if the underlying semantic state is still unresolved.

### Pattern 5: Reuse Built-In `cmux` Attention Surfaces
`cmux` already gives this phase:
- sidebar log stream
- workspace-scoped notifications
- unread badge / notification panel
- desktop-alert suppression when the window/workspace is already in focus

That means Phase 172 does not need a custom inbox, unread state store, or focus-awareness layer.

### Anti-Patterns to Avoid
- Logging from every `refreshCmuxSidebar()` call
- Sending `cmux notify` for every task completion or every successful tool call
- Reusing `notification.js` message text wholesale as the public `cmux` copy contract
- Deduping purely by final rendered message string
- Adding a second targeting or write-probe path outside `cmux-targeting.js`
- Treating all warnings as blockers or all completions as equally interruptive

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| workspace notification delivery | direct shell calls sprinkled across modules | attached adapter methods in `cmux-targeting.js` | keeps trust gate, workspace scoping, and suppression behavior consistent |
| notification history / inbox | custom notification center UI | built-in `cmux` notification panel and unread badges | official `cmux` already provides lifecycle, unread, and jump-to-workspace behavior |
| ad hoc spam control | per-hook booleans and timers | one attention policy store with semantic dedupe keys + cooldowns | centralizes noise control and makes tests deterministic |
| severity mapping | custom unlimited event classes | official `cmux log` levels (`info`, `progress`, `success`, `warning`, `error`) + separate notify policy | delivery contract stays simple and matches `cmux` primitives |
| repeated state inference | another copy of state/progress heuristics | `cmux-sidebar-snapshot.js` + existing parser/project-state truth | avoids drift from Phase 171 trust logic |

## Common Pitfalls

### Pitfall 1: Refresh-driven spam
**What goes wrong:** every lifecycle refresh appends another log line or fires another notification for the same underlying condition.
**Why it happens:** the plugin already refreshes on startup, file changes, idle, and tool completion, so it is tempting to emit attention side effects there directly.
**How to avoid:** keep a last-emitted attention store keyed by semantic event identity and emit only on transitions.
**Warning signs:** plans that say “log when refresh detects X” instead of “log when X first occurs.”

### Pitfall 2: Routine success becomes interruptive noise
**What goes wrong:** users get pinged for starts, normal task completions, and every healthy state change.
**Why it happens:** it feels safer to notify on every milestone than to miss something important.
**How to avoid:** keep notifications exceptional. Routine success stays log-only unless it crosses plan, phase, or final workflow completion boundaries.
**Warning signs:** any event matrix where `task-complete` and `plan-complete` both notify the same way.

### Pitfall 3: Dedupe by text misses semantic duplicates
**What goes wrong:** slightly different wording produces repeated notifications for the same warning or blocker.
**Why it happens:** string dedupe is easy and already exists in `notification.js`.
**How to avoid:** dedupe by semantic key first, then optionally by rendered text as a second guard.
**Warning signs:** keys built from message text alone.

### Pitfall 4: Warning and blocker reminder loops never cool down
**What goes wrong:** the same unresolved warning re-notifies frequently enough that users start ignoring all alerts.
**Why it happens:** reminder cadence is added without a clear recurrence rule.
**How to avoid:** notify on first occurrence, then re-notify only after a materially longer cooldown or when severity/state changes.
**Warning signs:** a plan that introduces rate limiting but no state-change check.

### Pitfall 5: Attention policy bypasses the trust gate
**What goes wrong:** logs or notifications leak into the wrong workspace or appear when `cmux` is unavailable.
**Why it happens:** `notify` feels separate from sidebar transport, so authors may call it outside the adapter.
**How to avoid:** add `notify` to the same attached adapter contract and keep all `cmux` writes behind it.
**Warning signs:** direct `runCmuxCommand('notify', ...)` calls outside `cmux-targeting.js`.

## Code Examples

Verified patterns from current project code and official `cmux` docs.

### Attached adapter expansion for notifications
```javascript
return {
  setStatus(key, value, options = {}) { ... },
  clearStatus(key, options = {}) { ... },
  setProgress(progress, options = {}) { ... },
  clearProgress(options = {}) { ... },
  log(message, options = {}) { ... },
  notify(payload, options = {}) {
    return runAttached(
      'notify',
      () => cmux.notify({ ...options, workspace: normalizedVerdict.workspaceId, ...payload }),
      { payload, options },
    );
  },
};
```

### Canonical attention event shape
```javascript
{
  key: 'plan-complete:172:02',
  kind: 'plan-complete',
  log: {
    level: 'success',
    message: 'Plan 02 complete',
    source: 'bgsd',
  },
  notify: {
    title: 'bGSD',
    subtitle: 'Phase 172',
    body: 'Plan 02 complete',
  },
  interruptive: true,
  cooldownMs: 300000,
}
```

### Policy split: log-only vs notify
```javascript
function classifyEvent(event) {
  if (['checkpoint', 'waiting-input', 'blocker', 'warning', 'plan-complete', 'phase-complete', 'workflow-complete'].includes(event.kind)) {
    return { log: true, notify: true };
  }

  if (['planner-start', 'executor-start', 'task-complete', 'state-sync'].includes(event.kind)) {
    return { log: true, notify: false };
  }

  return { log: false, notify: false };
}
```

### Official `cmux` primitives this phase should use
```bash
cmux log --level success --source bgsd "Plan 02 complete"
cmux notify --title "bGSD" --subtitle "Phase 172" --body "Waiting for input"
cmux sidebar-state --workspace workspace:2
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Treat notifications as generic OS toasts with plugin-local routing | Use workspace-scoped `cmux notify` plus built-in unread panel/badges | Current `cmux` 2026 docs | Lets attention stay attached to the correct workspace without inventing custom history |
| Assume notifications always interrupt | `cmux` suppresses desktop alerts when the window is focused, the workspace is active, or the panel is open | Current `cmux` notifications docs | Supports quiet-by-default escalation without extra focus-detection logic in bGSD |
| Think logs are just debug output | `cmux log` is a first-class sidebar UX surface with levels and source labels | Current `cmux` API docs | Enables readable ambient narrative without turning everything into notifications |
| Emit attention from raw lifecycle hooks | Use semantic event normalization + edge-triggered dedupe | Current repo architecture after Phases 170-171 | Prevents refresh-cycle churn and keeps policy testable |
| Build custom inbox/history for attention UX | Reuse `cmux` notification panel and unread lifecycle | Current `cmux` notifications docs | Keeps this phase small and aligned with its explicit non-goals |

## Open Questions

- Exact reminder cadence for unresolved warnings and blockers is still delegated by `172-CONTEXT.md`. Recommendation: keep first-occurrence notifications immediate, then use a much longer cooldown for repeats.
- Whether `state-sync` should always log or only log when the repair is user-visible is a product choice; current evidence favors logging only meaningful repairs.
- Whether `workflow-start` should log for both planner and executor or only when background work begins is low-risk planning discretion.

## Sources

### Primary (HIGH confidence)
- https://www.cmux.dev/docs/api
- https://www.cmux.dev/docs/notifications
- https://www.cmux.dev/blog/zen-of-cmux
- `/Users/cam/DEV/bgsd-oc/.planning/research/CMUX-FIRST-UX-PRD.md`
- `/Users/cam/DEV/bgsd-oc/.planning/research/CMUX-FIRST-UX-BACKLOG.md`
- `/Users/cam/DEV/bgsd-oc/.planning/phases/172-ambient-attention-ux-noise-control/172-CONTEXT.md`
- `/Users/cam/DEV/bgsd-oc/src/plugin/cmux-targeting.js`
- `/Users/cam/DEV/bgsd-oc/src/plugin/cmux-sidebar-snapshot.js`
- `/Users/cam/DEV/bgsd-oc/src/plugin/index.js`

### Secondary (MEDIUM confidence)
- `/Users/cam/DEV/bgsd-oc/src/plugin/notification.js`
- `/Users/cam/DEV/bgsd-oc/src/plugin/idle-validator.js`
- `/Users/cam/DEV/bgsd-oc/src/plugin/stuck-detector.js`
- `/Users/cam/DEV/bgsd-oc/src/plugin/advisory-guardrails.js`
- `/Users/cam/DEV/bgsd-oc/tests/plugin-cmux-targeting.test.cjs`
- `/Users/cam/DEV/bgsd-oc/tests/plugin-cmux-sidebar-snapshot.test.cjs`

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:** HIGH for `cmux` delivery primitives, notification lifecycle, built-in unread behavior, and current repo architecture; MEDIUM for exact event taxonomy shape and reminder cadence because those are implementation choices constrained by context rather than explicit external standards.

**Research date:** 2026-03-31

**Valid until:** Re-check `cmux` API and notification docs before implementation if planning slips beyond the next milestone session or if `cmux` releases a sidebar/notifications API change.
