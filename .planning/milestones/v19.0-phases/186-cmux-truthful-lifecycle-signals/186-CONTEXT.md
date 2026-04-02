# Phase 186: cmux Truthful Lifecycle Signals - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Make `cmux` surface truthful workspace lifecycle state so operators can tell which workspaces are progressing normally versus which ones need intervention.
- **Expected User Change:** Before: operators had to infer workspace health by polling panes or guessing from sparse status. After: operators can scan workspace-scoped lifecycle signals in `cmux`, immediately spot states that require action, and see enough inline progress context to avoid blind pane-hopping. Examples: a `finalize-failed` workspace visibly stands out as needing action; a recovering workspace lingers briefly after recovery so a user who looked away still notices it; quiet states like `reconciling` use plain-English labels instead of opaque internal jargon.
- **Non-Goals:**
  - Build a full dashboard or raw-log browser inside `cmux`
  - Turn every abnormal state into an urgent alert
  - Add new execution lifecycle states beyond the roadmap-defined signal set
</phase_intent>

<domain>
## Phase Boundary
Show readable workspace-scoped lifecycle status, progress context, and intervention signals inside `cmux` so the real execution and recovery lifecycle is understandable without guessing.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Attention signal semantics — Locked. Use loud attention only for states that require human action. This keeps the signal trustworthy and avoids turning every degraded-but-non-actionable condition into alert fatigue.
- Workspace signal layout — Locked. Keep the overview compact, but include a lightweight inline progress or log hint so users do not need to change focus just to understand a workspace's current activity. Richer detail can still exist when a workspace is focused.

### Medium Decisions
- State persistence rules — Locked. Intervention-related states should linger briefly after recovery or completion so operators who are not watching continuously still catch what happened, but the bar should not retain stale warnings indefinitely.

### Low Defaults and Open Questions
- Normal-state visual treatment — Defaulted. `running`, `reconciling`, `idle`, and `complete` should stay visually quieter than intervention-required states.
- Quiet-state wording — Locked. Non-loud states should use plain-English labels so they remain understandable without looking like alarms.

### Agent's Discretion
- Exact severity styling, linger duration, and the specific formatting of lightweight inline hints can be chosen during planning as long as the overview remains compact and intervention states remain clearly distinguishable.
</decisions>

<specifics>
## Specific Ideas
- The user is comfortable treating this as a status-bar improvement rather than a full observability surface.
- The user does not want broad concern about degraded-but-non-actionable conditions; the main job is to highlight where action is required.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Workspace signal layout
  - Original decision: Use a two-level view where the overview shows status only and richer progress/log context appears when a workspace is focused.
  - Stress-test revision: Add a lightweight inline progress or log hint to the overview so users do not have to move focus just to understand current activity.
  - Follow-on clarification: Quiet non-loud states should use plain-English labels so terse inline hints stay meaningful.
- Attention signal semantics
  - Held under stress test: loud attention stays reserved for states that require human action because this phase is only adding a status bar, not a broader degradation alerting system.
- State persistence rules
  - Held under stress test: intervention states should linger briefly because users may not catch instant transitions in real time.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---
*Phase: 186-cmux-truthful-lifecycle-signals*
*Context gathered: 2026-04-01*
