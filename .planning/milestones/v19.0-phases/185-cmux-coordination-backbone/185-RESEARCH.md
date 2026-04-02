# Phase 185: cmux Coordination Backbone - Research

**Researched:** 2026-04-01
**Domain:** Node.js event coalescing for cmux sidebar/attention refresh orchestration
**Confidence:** HIGH

## User Constraints

- Use one shared coordinated refresh cycle for all `cmux` refresh work; do not keep separate sidebar and attention refresh paths.
- Preserve quiet fail-open behavior when `cmux` is unavailable, unreachable, or untrusted.
- Recovery must be bounded and retryable; do not retry on every trigger.
- A planning-file change may break suppression backoff early and force a fresh availability check.
- Keep one immediate startup refresh, then route later bursts through the coordinated backbone.
- Do not add new npm dependencies or a JJ SDK layer.
- Do not redesign visible `cmux` UI beyond existing sidebar and attention surfaces.
- Do not define the full lifecycle/status vocabulary in `cmux`; Phase 186 owns that.
- Do not remove sequential fallback.
- Do not expand this into general multi-user coordination.

## Summary

The current plugin does duplicate work because each relevant hook independently calls `refreshCmuxSidebar()` and `refreshCmuxAttention()`, and each path invalidates parsers and rebuilds project state before doing its own cmux write. The established implementation pattern for this phase is not “more debouncing everywhere”; it is a **single-flight refresh coordinator** that accepts many triggers, collapses them into one pending cycle, does one parser invalidation plus one `getProjectState()` read, then fans that single snapshot out to both sidebar and attention sinks.

Within this repo, the standard stack is already present: Node `setTimeout`/`clearTimeout` or `node:timers/promises`, existing `cmux-cli` / `cmux-targeting` adapters, existing snapshot builders, existing attention memory, and existing notification cooldown logic. The right design is a small in-process coordinator module, not RxJS, not a job queue, and not a general event bus. Keep one in-flight run, one pending rerun bit, bounded suppression backoff, and explicit wake-on-planning-change behavior.

**Primary recommendation:** Add one `cmux-refresh-backbone` module that owns trigger intake, debounce, in-flight dedupe, bounded suppression retry, and single-snapshot fan-out to `syncCmuxSidebar()` and `syncCmuxAttention()`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js runtime | >=18 | Timers, AbortController, child-process control | Already required by repo; official timer cancellation and subprocess abort support are built in |
| `cmux` CLI / socket API | current installed runtime | Sidebar status, progress, logs, notifications, identify/capabilities/ping | Official cmux API already exposes exactly the metadata and detection primitives this phase needs |
| `src/plugin/cmux-targeting.js` | repo current | Availability, attachment proof, suppression reasons, retry eligibility | Existing trusted targeting contract; backbone should reuse it, not replace it |
| `src/plugin/cmux-sidebar-sync.js` | repo current | Deterministic sidebar writes from snapshot | Existing stable sink for status/progress |
| `src/plugin/cmux-attention-sync.js` | repo current | Deterministic attention log/notify policy | Existing stable sink for attention semantics |
| `src/plugin/parsers/index.js` + `getProjectState()` | repo current | Single parse invalidation + fresh runtime snapshot | Current source of truth; dedupe around it instead of re-reading twice |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:timers/promises` | Node >=16, available in repo runtime | Abortable debounce/backoff waits | Use if backbone is promise-driven rather than callback-timer driven |
| `AbortController` | Node >=18 repo baseline | Cancel pending timer wait or in-flight retry bookkeeping | Use for clean restart/rearm of scheduled refresh cycles |
| `src/plugin/cmux-attention-policy.js` | repo current | Duplicate/cooldown suppression for emitted attention events | Keep as downstream attention dedupe; do not move attention semantics into trigger intake |
| `src/plugin/file-watcher.js` | repo current | Debounced external planning-file wake signals | Reuse as one trigger source into backbone |
| `src/plugin/notification.js` | repo current | Existing dedupe/rate-limit behavior for context notifications | Keep notification controls downstream; backbone should reduce refresh churn before notify layer |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Small in-repo coordinator | RxJS stream pipeline | Overkill, new dependency, wider cognitive surface |
| Single-flight state machine | Queue of every trigger | Reintroduces burst amplification and stale work |
| Existing cmux adapter retry + backbone backoff | Per-hook retries | Causes repeated availability probes during storms |
| One fresh snapshot fan-out | Separate sidebar and attention reads | Duplicates parser invalidation and project-state parsing |

## Architecture Patterns

### Recommended Project Structure
- Add a focused module such as `src/plugin/cmux-refresh-backbone.js`.
- Keep `index.js` responsible only for wiring hooks to `backbone.enqueue(trigger)`.
- Keep `cmux-targeting.js` as the source of availability/attachment truth.
- Keep sidebar and attention modules as sink-specific projection layers.

### Pattern 1: Single-flight refresh coordinator
Use one coordinator object with these state fields:
- `timer`: scheduled debounce handle
- `inFlight`: current refresh promise or boolean
- `rerunRequested`: whether another cycle must run after the current one
- `latestTrigger`: merged trigger metadata for the next cycle
- `suppressionBackoffUntil`: timestamp for bounded quiet period
- `nextRetryAt`: bounded retry target

Operational rules:
1. Hooks never call sidebar/attention refresh directly.
2. Each hook enqueues a trigger into the coordinator.
3. Startup can request an immediate cycle.
4. Burst events reset/refresh the debounce window rather than spawning more work.
5. If a cycle is already running, mark `rerunRequested=true` and exit.
6. The cycle performs one parser invalidation, one fresh `getProjectState(projectDir)`, then invokes both sinks with the same snapshot.
7. If cmux is suppressed and retry is not yet due, stay quiet.
8. If a planning-file change arrives during backoff, allow an early re-check.

### Pattern 2: Snapshot then fan-out
Do **not** let sidebar sync and attention sync fetch state independently. Build one refresh payload:
- current cmux adapter (possibly retried once if policy allows)
- fresh project state
- notification history snapshot
- merged trigger detail only as needed for attention truthfulness

Then fan that payload out to both sinks. This is the core anti-churn move.

### Pattern 3: Trigger coalescing with minimal fidelity
Preserve only trigger detail that changes attention truth:
- startup
- planning-file external change
- `session.idle`
- `command.executed`
- `tool.execute.after` when tool context matters

Do not accumulate an unbounded trigger list. Keep a latest/merged summary.

### Pattern 4: Fail-open suppression with bounded re-entry
Suppression is already part of the targeting contract. The backbone should add scheduling discipline around it:
- unavailable/untrusted cmux => no sink writes
- bounded retry window => one re-probe after cooldown, not on every hook
- planning-file change => early wake path

### Anti-Patterns to Avoid
- Calling `invalidateAll(projectDir)` separately in sidebar and attention paths.
- Running two `getCurrentCmuxAdapter()` lookups for one logical cycle.
- Treating every trigger as queue-worthy work.
- Letting urgent attention create a second parse/read path.
- Encoding Phase 186 lifecycle vocabulary into Phase 185 trigger intake.
- Using `setInterval` polling for normal refresh flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce/backoff timing | Custom scheduler framework or dependency-heavy stream system | Node timers / `node:timers/promises` with clear state | Built-in, stable, enough for one-process coordination |
| cmux attachment detection | New heuristics for workspace/surface trust | Existing `resolveCmuxAvailability()` + suppression reasons | Already tested for managed/alongside/suppressed modes |
| Sidebar protocol | Custom sidebar serialization layer | Official `cmux` commands: `set-status`, `clear-status`, `set-progress`, `clear-progress`, `log`, `notify`, `sidebar-state` | Official cmux API already supports needed writes/reads |
| Attention dedupe | New notification spam filter | Existing `cmux-attention-policy.js` + notifier dedupe/rate limit | Behavior is already codified and tested |
| Event queue persistence | Disk-backed queue / generic workflow engine | In-memory single-flight coordinator | Phase scope is per-session runtime burst absorption only |

## Common Pitfalls

### Pitfall 1: Double invalidation and parse churn
**What goes wrong:** One logical trigger causes separate sidebar and attention refreshes, each invalidating caches and re-reading planning state.
**Why it happens:** Trigger ownership lives in hooks instead of one coordinator.
**How to avoid:** Invalidate once per cycle, read once per cycle, fan out the same snapshot.
**Warning signs:** Two refresh helpers remain exported/called from hooks; parser invalidation stays duplicated.

### Pitfall 2: Overlapping cycles during async refresh
**What goes wrong:** A second trigger starts a new cycle while the first is still resolving cmux or parsing state.
**Why it happens:** Debounce alone does not prevent overlap once async work begins.
**How to avoid:** Keep explicit `inFlight` and `rerunRequested` state; never run more than one cycle concurrently.
**Warning signs:** Multiple concurrent `resolveAvailability` or `setStatus` bursts in tests/logs.

### Pitfall 3: Backoff that never wakes early enough
**What goes wrong:** cmux recovers but the plugin stays quiet too long.
**Why it happens:** Suppression cooldown is time-only and ignores strong recovery signals.
**How to avoid:** Let planning-file changes break suppression backoff early, exactly as the context locks.
**Warning signs:** Recovery requires idle timeout or restart even after fresh planning-file activity.

### Pitfall 4: “Urgent” attention bypass creating a second path
**What goes wrong:** Attention becomes faster, but duplicate parse/process churn comes back.
**Why it happens:** Urgent events bypass the backbone instead of using priority within it.
**How to avoid:** If urgent handling is added, it may shorten debounce or force immediate shared-cycle execution, but must still share one snapshot.
**Warning signs:** Attention path can run without sidebar path or without shared snapshot build.

### Pitfall 5: Timers keeping runtime alive unnecessarily
**What goes wrong:** Background timers hold the Node process open or cause awkward teardown behavior.
**Why it happens:** Long-lived scheduled retry/debounce timers stay ref'ed.
**How to avoid:** Prefer short-lived `setTimeout` handles with cleanup; use promise timers with `{ ref: false }` when appropriate.
**Warning signs:** Tests hang on shutdown or plugin teardown leaves pending timers.

### Pitfall 6: Per-trigger retries hammering cmux
**What goes wrong:** Every hook retries `identify`/`capabilities`/write probe during instability.
**Why it happens:** Retry logic remains attached to hook frequency instead of cycle frequency.
**How to avoid:** Only the backbone decides when a retry-eligible suppression may re-probe.
**Warning signs:** resolve count scales with event storm size.

## Code Examples

Verified patterns from official sources.

### Abortable debounce/backoff timer (Node official)
Source: Node timers docs / `node:timers/promises`

```js
import { setTimeout as delay } from 'node:timers/promises';

const controller = new AbortController();
const wait = delay(200, undefined, { signal: controller.signal, ref: false })
  .catch((error) => {
    if (error.name !== 'AbortError') throw error;
  });

controller.abort(); // cancel superseded refresh wait
```

### Abortable subprocess control (Node official)
Source: Node child_process docs / `execFile`

```js
import { execFile } from 'node:child_process';

const controller = new AbortController();
execFile('cmux', ['identify', '--json'], { signal: controller.signal }, (error, stdout) => {
  if (error && error.name !== 'AbortError') throw error;
});
```

### Official cmux sidebar write surface
Source: cmux API reference

```bash
cmux set-status build "compiling" --workspace workspace:2
cmux set-progress 0.5 --label "Building..."
cmux log --level warning --source bgsd "Waiting for input"
cmux notify --title "bGSD" --body "Checkpoint waiting for review"
cmux sidebar-state --workspace workspace:2
```

### Repo-local backbone shape to follow
```js
backbone.enqueue({ hook: 'tool.execute.after', input });

// inside backbone
if (inFlight) {
  rerunRequested = true;
  latestTrigger = mergeTrigger(latestTrigger, trigger);
  return;
}

invalidateAll(projectDir);
const projectState = getProjectState(projectDir);
const payload = { ...projectState, notificationHistory: notifier.getHistory() };
await syncCmuxSidebar(adapter, payload);
await syncCmuxAttention(adapter, payload, { memory, trigger: latestTrigger });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-hook direct refresh calls | Single-flight coordinated cycle | Current SOTA for agent/runtime sidebar integrations | Cuts duplicate parse/process work and reduces event-storm amplification |
| Separate sink reads | One fresh snapshot fan-out | Current best practice for bursty UI state projection | Improves consistency between sidebar and attention outputs |
| Retry on every trigger | Bounded retry with wake signals | Current robust fail-open pattern | Faster quiet recovery with less churn |
| Extra libraries for reactive streams | Built-in AbortController + timer primitives | Mature in Node 18+ era | Lower dependency surface, simpler shutdown semantics |

## Open Questions

- Exact debounce interval and retry cooldown values remain planner-level tuning choices; no official cmux doc dictates them.
- Whether “urgent attention” should force immediate shared-cycle execution or use a shorter debounce is still discretionary, but it must not create a second read path.

## Sources

### Primary (HIGH confidence)
- Node.js timers docs: https://nodejs.org/api/timers.html
- Node.js child_process docs: https://nodejs.org/api/child_process.html
- cmux API reference: https://www.cmux.dev/docs/api
- Repo source: `src/plugin/index.js`
- Repo source: `src/plugin/cmux-targeting.js`
- Repo source: `src/plugin/cmux-sidebar-sync.js`
- Repo source: `src/plugin/cmux-attention-sync.js`
- Repo tests: `tests/plugin.test.cjs`

### Secondary (MEDIUM confidence)
- Project cmux skill reference: `.agents/skills/cmux-skill/SKILL.md`
- Repo source: `src/plugin/file-watcher.js`
- Repo source: `src/plugin/notification.js`
- Repo source: `src/plugin/idle-validator.js`

### Tertiary (LOW confidence)
- General single-flight/coalescing terminology from ecosystem practice; no single official JavaScript spec source was authoritative for the exact pattern name.

## Metadata

**Confidence breakdown:** HIGH for Node timer/subprocess APIs, HIGH for cmux sidebar API surface, HIGH for current repo behavior and constraints, MEDIUM for exact debounce/backoff tuning, MEDIUM for “single-flight” naming as architecture shorthand.

**Research date:** 2026-04-01

**Valid until:** Re-check when `cmux` API, Node baseline, or plugin hook contract changes.
