# Phase 186: cmux Truthful Lifecycle Signals - Research

**Researched:** 2026-04-01
**Domain:** cmux workspace lifecycle projection and intervention signaling
**Confidence:** HIGH

## User Constraints

- Use the discuss handoff as the contract: `cmux` must tell the truth about workspace lifecycle without making operators poll panes or guess from sparse status.
- Keep the overview compact, but always include a lightweight inline progress or log hint so users can understand a workspace without changing focus.
- Reserve loud attention for states that require human action or recovery intervention; do not alert on every degraded-but-non-actionable condition.
- Keep quiet states (`running`, `reconciling`, `idle`, `complete`) visually quieter than intervention-required states.
- Do not add new lifecycle states beyond the roadmap-defined set: `running`, `blocked`, `waiting`, `stale`, `reconciling`, `finalize-failed`, `idle`, `complete`.
- Do not turn this into a dashboard, raw-log browser, or broad cmux UX redesign.
- Do not depend on live JJ workspace inventory as the source of truth; JJ planning context is advisory only.
- Preserve Phase 185’s single shared cmux refresh backbone and quiet fail-open behavior.
- Avoid event storms and noisy churn; semantic transitions matter more than repeated refreshes.

## Phase Requirements

- **CMUX-02:** User can see truthful workspace-scoped status, progress, and logs in cmux for `running`, `blocked`, `waiting`, `stale`, `reconciling`, `finalize-failed`, `idle`, and `complete` states.
- **CMUX-03:** User receives clear cmux attention signals when human input, stale-workspace recovery, or finalize intervention is required.

## Summary

Phase 186 should be implemented as a **semantic lifecycle projection layer** on top of the Phase 185 refresh backbone, not as another refresh path and not as a raw event stream. The repo already has the right runtime shape: one shared refresh cycle (`cmux-refresh-backbone`), one sidebar projection layer (`cmux-sidebar-sync` + `cmux-sidebar-snapshot`), one attention/log policy (`cmux-attention-sync` + `cmux-attention-policy`), and durable recovery/finalize metadata from Phase 184. The missing piece is a truthful classifier that turns current project state plus recent notifications into one explicit lifecycle state, one compact hint, one progress treatment, and one attention decision.

The standard pattern for this phase is: **classify first, then project**. Add one lifecycle derivation module that computes a workspace-scoped semantic snapshot with exact state, severity, hint text, progress mode, and attention needs. Reuse that same snapshot for sidebar pills, progress bars, log entries, and notifications so all cmux surfaces agree. Do not let sidebar and attention independently infer different meanings from the same raw state.

**Primary recommendation:** introduce a shared `deriveWorkspaceLifecycleSignal()` layer and make both `cmux-sidebar-sync` and `cmux-attention-sync` consume it, with transition-aware logging and latched intervention visibility that lingers in logs/history rather than inventing new lifecycle states.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js runtime | >=18 | Timers, AbortController, subprocess control | Already the repo baseline; official timer cancellation and abortable subprocess control are built in and current via Context7 |
| `cmux` CLI / socket API | current installed runtime | Sidebar status pills, progress bars, logs, notifications, sidebar-state inspection | Official cmux API already exposes the exact primitives this phase needs; no custom UI transport required |
| `src/plugin/cmux-refresh-backbone.js` | repo current | Single shared refresh cycle | Phase 185 already solved event-storm control; Phase 186 must layer semantics on top of it |
| `src/plugin/cmux-sidebar-snapshot.js` + `src/plugin/cmux-sidebar-sync.js` | repo current | Sidebar projection | Existing home for status/context/progress projection; extend rather than replace |
| `src/plugin/cmux-attention-sync.js` + `src/plugin/cmux-attention-policy.js` | repo current | Transition-aware logs and notifications | Existing attention memory, dedupe, and cooldown behavior should stay the downstream gate |
| `src/plugin/notification.js` | repo current | Recent warning/critical history | Existing ring buffer gives truthful recent recovery/failure context without inventing a second event store |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/jj-workspace.js` | repo current | Canonical recovery/finalize blocker taxonomy (`stale`, `finalize_failed`, `staged_ready`, gating sibling) | Reuse when local runtime metadata already contains these meanings; do not re-invent reconcile/finalize semantics |
| `src/commands/workspace.js` | repo current | Inventory/reconcile summary shape | Reuse the established status vocabulary and recovery summary contract as semantic input, not as a live dependency |
| `node:timers/promises` | Node >=18 | Optional linger expiry for quiet cleanup | Use only if lifecycle memory needs short non-blocking expiry timers |
| `AbortController` | Node >=18 | Cancel superseded linger cleanup waits | Use if linger expiry is implemented with promise timers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared lifecycle derivation module | Separate sidebar and attention heuristics | Reintroduces contradictory signals and drift |
| Semantic transition logging | Raw refresh-time logging | Causes event storms and noisy churn |
| Linger in logs/history and small in-memory lifecycle cache | New markdown state files or durable lifecycle store | Too heavy for runtime-only projection and violates phase scope |
| Existing cmux sidebar primitives | New dashboard surface | Explicitly out of scope |

## Architecture Patterns

### Recommended Project Structure
- Add a focused module such as `src/plugin/cmux-lifecycle-signal.js`.
- Keep `cmux-refresh-backbone.js` unchanged as the only refresh scheduler.
- Make `cmux-sidebar-snapshot.js` depend on lifecycle derivation instead of directly inferring labels from raw `STATE.md` text.
- Make `cmux-attention-sync.js` consume the same lifecycle snapshot for log and notify decisions.
- Keep lifecycle memory small and in-process, similar to existing attention memory.

### Pattern 1: Classify first, then project
Build one shared semantic object per refresh cycle, for example:

```js
{
  state: 'waiting',
  severity: 'needs-human',
  label: 'Waiting',
  hint: 'Checkpoint waiting for review',
  context: 'Phase 186 P01',
  progress: { mode: 'hidden' },
  attention: { notify: true, logLevel: 'warning' },
  linger: { mode: 'latched-until-change' }
}
```

Then project that one object into:
- status pill (`bgsd.state`)
- compact context pill (`bgsd.context`)
- lightweight activity/detail pill (`bgsd.activity`)
- progress bar or cleared progress
- cmux log entry on semantic transition
- cmux notification only when the classified state requires intervention

This keeps sidebar, progress, and attention truthful and consistent.

### Pattern 2: Use an explicit precedence table
Do not let overlapping regexes decide truth opportunistically. Use one ordered classifier:

1. `finalize-failed`
2. `waiting`
3. `stale`
4. `blocked`
5. `reconciling`
6. `running`
7. `complete`
8. `idle`

Prescriptive rules:
- `waiting` means human input/review/approval/auth checkpoint is required.
- `stale` means stale-workspace recovery is required.
- `finalize-failed` means finalize intervention is required.
- `blocked` is a non-waiting hard stop.
- `reconciling` is active recovery/finalization work that is not itself an alarm.
- `running` is healthy active execution/verification/planning work.
- `complete` and `idle` are quiet terminal states.

### Pattern 3: Separate intervention-required treatment from quiet-state treatment
For intervention-required states (`waiting`, `stale`, `finalize-failed`, and only truly blocking `blocked`):
- set a clear status pill with plain-English wording
- clear numeric progress if it would be misleading
- show a short imperative or outcome hint in `bgsd.activity`
- append a warning/error log on first semantic occurrence
- notify once per semantic occurrence using the existing cooldown/dedupe memory

For quiet states (`running`, `reconciling`, `idle`, `complete`):
- keep pills visually quiet
- use exact progress only when `state.progress` is trustworthy
- otherwise use a compact activity label/hint
- log only on state transition, not on every refresh
- do not notify

### Pattern 4: Linger without inventing new states
The roadmap-defined state must remain current truth. Linger should be implemented as **visibility policy**, not as extra lifecycle states.

Prescriptive policy:
- Keep intervention-required states latched until contradictory trustworthy evidence arrives.
- After recovery or completion, immediately switch the current state to the new truthful state.
- Preserve the previous intervention in recent cmux logs/history and keep the recovery/completion log visible.
- If any extra visual linger is used, keep it short and quiet (2-5 minutes, MEDIUM confidence) and never retain an active warning badge after the underlying condition is resolved.

This satisfies “users looked away” without turning old warnings into stale noise.

### Pattern 5: Reuse Phase 184 recovery taxonomy when available
Phase 184 already established canonical meanings for `stale`, `finalize_failed`, `staged_ready`, `gating_sibling`, and `recovery_summary` in `src/lib/jj-workspace.js` and `src/commands/workspace.js`. When those meanings are present in local runtime metadata, consume them directly. Do not create new phrase-level guesses for finalize or recovery semantics if canonical metadata is already available.

### Anti-Patterns to Avoid
- Re-deriving lifecycle meaning separately inside sidebar sync and attention sync.
- Logging on every refresh cycle instead of on semantic transitions.
- Showing numeric progress during `waiting`, `stale`, or `finalize-failed` and implying work is still advancing.
- Turning `reconciling` into a warning by default.
- Keeping a warning/error badge after the workspace has truthfully moved to `running` or `complete`.
- Adding new pseudo-states like `recovered`, `attention`, or `degraded` to the visible lifecycle contract.
- Depending on live global workspace inventory polling to know the current workspace state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Refresh orchestration | New polling loop or secondary refresh path | `src/plugin/cmux-refresh-backbone.js` | Phase 185 already solved bounded refresh and shared snapshot fan-out |
| cmux transport layer | Custom socket client or dashboard renderer | `src/plugin/cmux-cli.js` and `src/plugin/cmux-targeting.js` | Existing CLI bridge, availability checks, and trust/suppression rules are already tested |
| Lifecycle notification cooldowns | New spam filter | `src/plugin/cmux-attention-policy.js` + attention memory | Existing semantic dedupe/cooldown rules already fit transition-driven alerts |
| Runtime event store | Disk-backed lifecycle database | Small in-memory lifecycle cache plus `notification.js` history ring buffer | Phase scope is session-local truthful projection, not durable event sourcing |
| Recovery/finalize taxonomy | New reconcile/finalize wording | `src/lib/jj-workspace.js` / `src/commands/workspace.js` status and recovery summary contract | Repo already standardized these meanings in Phase 184 |
| Sidebar primitives | New custom status layout protocol | Official `cmux` commands: `set-status`, `clear-status`, `set-progress`, `clear-progress`, `log`, `notify`, `sidebar-state` | Official cmux API already exposes the intended primitives |

## Common Pitfalls

### Pitfall 1: Contradictory surfaces
**What goes wrong:** Sidebar shows `Working` while logs/notifications say `Waiting for input` or `Finalize failed`.
**Why it happens:** Sidebar and attention classify state independently.
**How to avoid:** Derive one lifecycle snapshot first, then fan it out to all cmux surfaces.
**Warning signs:** Duplicate regex tables, duplicate precedence logic, or different labels for the same refresh payload.

### Pitfall 2: Event-storm logging
**What goes wrong:** `cmux log` fills with repeated copies of the same warning or progress message.
**Why it happens:** Logging is tied to refresh frequency instead of semantic transitions.
**How to avoid:** Emit logs only when lifecycle state or normalized hint text changes.
**Warning signs:** A debounced burst still produces many identical log lines.

### Pitfall 3: Misleading progress during intervention states
**What goes wrong:** A workspace shows `75%` progress while actually waiting on review or stale recovery.
**Why it happens:** Numeric progress is treated as evergreen truth.
**How to avoid:** Hide or clear progress when the active lifecycle state is `waiting`, `stale`, `finalize-failed`, or `blocked`.
**Warning signs:** Attention-required states still render exact progress bars.

### Pitfall 4: Noisy alerts for non-actionable states
**What goes wrong:** `reconciling` or quiet warnings constantly notify the operator.
**Why it happens:** Alert routing follows “anything abnormal” instead of “action required.”
**How to avoid:** Restrict notifications to `waiting`, `stale`, and `finalize-failed`, with `blocked` only when it is truly actionable and not a quiet degraded condition.
**Warning signs:** Routine recovery/finalization emits desktop notifications during healthy flow.

### Pitfall 5: Linger implemented as stale badge persistence
**What goes wrong:** Resolved warnings stay visible as if still active.
**Why it happens:** Linger is applied to the current status pill instead of to log/history visibility.
**How to avoid:** Move to the new truthful state immediately; keep history in logs and, at most, a short quiet detail linger.
**Warning signs:** A recovered workspace still looks intervention-required minutes later.

### Pitfall 6: Inventing finalize/recovery semantics from phrases alone
**What goes wrong:** `finalize-failed` and stale recovery are inferred from brittle wording and drift from canonical repo behavior.
**Why it happens:** The implementation ignores Phase 184’s shared taxonomy.
**How to avoid:** Reuse `blocking_reason`, `recovery_summary`, and `finalize_failed` semantics whenever available.
**Warning signs:** New regexes duplicate meanings already represented in workspace metadata.

### Pitfall 7: Verifying only labels, not truthfulness
**What goes wrong:** Tests prove pills changed, but not that they changed for the correct semantic reason.
**Why it happens:** Verification checks surface output without proving source-to-sink mapping.
**How to avoid:** Add contract tests for lifecycle precedence, progress suppression rules, transition logging, and intervention cooldown behavior.
**Warning signs:** Tests only snapshot final sidebar strings with no scenario-based assertions.

## Code Examples

Verified patterns from repo and official sources.

### Repo pattern: one shared refresh payload fans out to both sinks
Source: `src/plugin/cmux-refresh-backbone.js`

```js
const payload = {
  ...projectState,
  notificationHistory: getNotificationHistory(),
};

await syncCmuxSidebar(currentCmuxAdapter, payload);
await syncCmuxAttention(currentCmuxAdapter, payload, {
  memory: attentionMemory,
  trigger,
});
```

Reuse this pattern exactly: lifecycle derivation should happen off the shared payload, not from a second read path.

### Repo pattern: existing transition-aware attention dedupe key
Source: `src/plugin/cmux-attention-policy.js`

```js
export function buildAttentionEventKey(event = {}) {
  return [
    normalizeText(event.workspaceId),
    normalizeText(event.kind),
    normalizeText(event.phase, 'none'),
    normalizeText(event.plan, 'none'),
    normalizeText(event.task, 'none'),
    normalizeText(event.identity, 'default'),
  ].join(':');
}
```

Phase 186 should keep this transition-key pattern and change `kind`/`identity` only when lifecycle meaning actually changes.

### Repo pattern: canonical recovery/finalize blocker taxonomy
Source: `src/lib/jj-workspace.js`

```js
function classifyBlockingReason(workspace) {
  if (workspace.result_manifest?.shared_planning_violation?.quarantine) return 'quarantine';
  if (workspace.status === 'finalize_failed' || workspace.result_manifest?.finalize_failed) return 'finalize_failed';
  if (!workspace.result_manifest?.summary_path && workspace.result_manifest?.inspection_level === 'direct-proof') return 'proof_missing';
  if (workspace.status === 'stale') return 'stale';
  if (workspace.status === 'divergent') return 'divergent';
  if (workspace.status === 'missing') return 'missing';
  if (workspace.status === 'failed') return 'failed';
  return null;
}
```

Reuse these meanings instead of inventing a separate finalize/recovery vocabulary in cmux.

### Official cmux pattern: sidebar status, progress, logs, and notifications
Source: https://www.cmux.dev/docs/api

```bash
cmux set-status build "compiling" --workspace workspace:2
cmux set-progress 0.5 --label "Building..."
cmux log --level warning --source bgsd "Waiting for input"
cmux notify --title "bGSD" --body "Checkpoint waiting for review"
cmux sidebar-state --workspace workspace:2
```

Phase 186 should stay within these official primitives.

### Official Node pattern: abortable promise timer for quiet linger cleanup
Source: Node.js timers docs via Context7 (`/nodejs/node`)

```js
import { setTimeout as delay } from 'node:timers/promises';

const controller = new AbortController();
delay(2000, undefined, { signal: controller.signal, ref: false })
  .catch((error) => {
    if (error.name !== 'AbortError') throw error;
  });

controller.abort();
```

Use this only if a short quiet linger cleanup timer is needed.

### Recommended repo-local lifecycle shape to add

```js
const signal = deriveWorkspaceLifecycleSignal(payload, { memory });

await syncStatusKey(cmuxAdapter, BGSD_STATE_KEY, signal.label);
await syncStatusKey(cmuxAdapter, BGSD_CONTEXT_KEY, signal.context);
await syncStatusKey(cmuxAdapter, BGSD_ACTIVITY_KEY, signal.hint);

if (signal.progress.mode === 'exact') {
  await cmuxAdapter.setProgress(signal.progress.value, { label: signal.progress.label });
} else {
  await cmuxAdapter.clearProgress();
}

if (signal.transition.changed) {
  await cmuxAdapter.log(signal.log.message, signal.log);
  if (signal.attention.notify) await cmuxAdapter.notify(signal.attention.payload);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw state text heuristics yielding `Input needed` / `Blocked` / `Warning` / `Working` | Explicit lifecycle classifier with exact roadmap states | Current best next step for Phase 186 | Makes state truthful and requirement-aligned |
| Refresh-time logging | Transition-time logging | Current best practice for bounded sidebar observability | Avoids event storms and noisy churn |
| Warning badge linger | Truthful current state + lingering logs/history | Current robust observability pattern | Preserves visibility without stale alarms |
| Separate projection heuristics | Shared classification layer reused by all sinks | Current best repo-local pattern | Prevents contradictory status/progress/log treatment |

## Open Questions

- Exact in-memory source for canonical `reconciling` detection may need a small repo-local adapter if current `ProjectState` does not already expose enough structured reconcile/finalize context. Confidence: MEDIUM.
- Exact quiet linger duration is a planning choice, not an official cmux requirement. Recommended range is short (2-5 minutes) and should never retain an intervention badge after resolution. Confidence: MEDIUM.

## Sources

### Primary (HIGH confidence)
- Node.js timers docs via Context7: https://github.com/nodejs/node/blob/main/doc/api/timers.md
- Node.js child_process docs via Context7: https://github.com/nodejs/node/blob/main/doc/api/child_process.md
- cmux API reference: https://www.cmux.dev/docs/api
- cmux changelog: https://cmux.com/docs/changelog
- Repo source: `src/plugin/cmux-refresh-backbone.js`
- Repo source: `src/plugin/cmux-sidebar-snapshot.js`
- Repo source: `src/plugin/cmux-sidebar-sync.js`
- Repo source: `src/plugin/cmux-attention-sync.js`
- Repo source: `src/plugin/cmux-attention-policy.js`
- Repo source: `src/plugin/cmux-targeting.js`
- Repo source: `src/plugin/cmux-cli.js`
- Repo source: `src/plugin/notification.js`
- Repo source: `src/lib/jj-workspace.js`
- Repo source: `src/commands/workspace.js`
- Repo tests: `tests/plugin-cmux-sidebar-snapshot.test.cjs`
- Repo tests: `tests/plugin-cmux-attention-policy.test.cjs`
- Repo tests: `tests/plugin-cmux-refresh-backbone.test.cjs`

### Secondary (MEDIUM confidence)
- Project cmux skill reference: `.agents/skills/cmux-skill/SKILL.md`
- Phase 184 verification and summaries: `.planning/phases/184-deterministic-finalize-partial-wave-recovery/184-VERIFICATION.md`, `184-01-SUMMARY.md`, `184-02-SUMMARY.md`, `184-03-SUMMARY.md`
- Phase 185 research and summaries: `.planning/phases/185-cmux-coordination-backbone/185-RESEARCH.md`, `185-01-SUMMARY.md`, `185-02-SUMMARY.md`

### Tertiary (LOW confidence)
- Exact linger duration recommendation is based on repo constraints and observability practice rather than an official cmux or Node mandate.

## Metadata

**Confidence breakdown:** HIGH for official Node timer/abort APIs, HIGH for official cmux sidebar primitives, HIGH for repo-local refresh/attention/recovery contracts, MEDIUM for exact `reconciling` detection strategy if more structured runtime input is needed, MEDIUM for exact quiet linger duration.

**Research date:** 2026-04-01

**Valid until:** Re-check if cmux sidebar API, plugin `ProjectState` shape, or workspace recovery/finalize metadata contracts change.
