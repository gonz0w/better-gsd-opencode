# Phase 185: cmux Coordination Backbone - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Replace the plugin's repeated per-hook `cmux` refresh calls with one coordinated refresh backbone that can absorb bursty runtime activity without creating duplicate parse or process churn.
- **Expected User Change:** Before: `cmux` status refresh work could fan out from multiple hooks, causing duplicate refresh attempts and noisy failure handling during parallel activity. After: users get one debounced, bounded `cmux` refresh path that projects fresh runtime state once per cycle and stays quiet when `cmux` cannot be trusted. Examples: a burst of `tool.execute.after` and watcher events coalesces into one coordinated cycle; sidebar and attention consume the same fresh runtime snapshot instead of triggering separate reads; unattached or unreachable `cmux` sessions suppress noisy refresh work rather than surfacing repeated non-fatal churn.
- **Non-Goals:**
  - Define the full workspace lifecycle/status vocabulary shown in `cmux`; that belongs to Phase 186.
  - Redesign the visible `cmux` UI beyond what the existing sidebar and attention surfaces already support.
  - Remove sequential fallback or expand this phase into general multi-user coordination behavior.
</phase_intent>

<domain>
## Phase Boundary
This phase delivers the runtime coordination layer for `cmux` refreshes: one debounced, bounded backbone that turns plugin events into a trustworthy refresh cycle and preserves quiet fail-open behavior when `cmux` is absent, unreachable, or untrusted.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Refresh ownership — Locked. Use one shared coordinated cycle for `cmux` refresh work so event sources enqueue the same backbone and one fresh runtime read can drive both sidebar and attention behavior instead of independent repeated refresh paths.
- Failure suppression — Locked, then revised in stress test. Keep quiet fail-open behavior with a bounded retry window after the system detects unavailable, unreachable, or untrusted `cmux`, rather than retrying on every trigger or staying dead until restart.

### Medium Decisions
- Wake-from-backoff signal — Locked after stress-test reassessment. A planning file change is strong enough to break `cmux` suppression backoff early and re-check attachment/availability before the next scheduled retry.
- Backpressure rule — Untouched. Planner may choose the minimal bounded policy that preserves one trustworthy coordinated refresh path without reintroducing duplicate parse or process storms.
- Trigger fidelity — Untouched. Planner may preserve only the trigger detail needed to keep attention logic truthful without turning this phase into a full lifecycle-signals design.

### Low Defaults and Open Questions
- Startup default — Defaulted. Keep one immediate startup refresh, then route later activity bursts through the coordinated backbone.

### Agent's Discretion
- Whether urgent attention behavior gets any special treatment beyond the shared coordinated cycle is delegated. If implemented, it must not add a second parse/read path or undermine the one-cycle backbone.
</decisions>

<specifics>
## Specific Ideas
- Current plugin hooks call `refreshCmuxSidebar()` and `refreshCmuxAttention()` separately across startup, watcher, command, idle, and tool events in `src/plugin/index.js`; Phase 185 should collapse that fan-out into one backbone.
- The backbone should be debounced and bounded, not an unbounded queue.
- The coordinated cycle should operate from fresh runtime state and avoid duplicate sidebar/attention reads where possible.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Original decision: one strict shared cycle for all sidebar and attention updates.
  - Stress-test revision: the user raised concern that urgent attention should not be delayed purely for coordination cleanliness.
  - Follow-on clarification: any urgent nuance is delegated, not locked; implementation must still avoid a second parse/read path.
- Original decision: bounded retry after fail-open suppression.
  - Stress-test revision: bounded retry alone could hide recovery for too long.
  - Follow-on clarification: a planning file change may wake `cmux` checks early during backoff.
</stress_tested>

<deferred>
## Deferred Ideas
- Richer lifecycle-specific `cmux` status/progress/log semantics remain Phase 186 work.
- Any broader `cmux` UX redesign or multi-session orchestration behavior stays outside this phase.
</deferred>

---
*Phase: 185-cmux-coordination-backbone*
*Context gathered: 2026-04-01*
