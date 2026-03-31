# Phase 171: Ambient Workspace Status & Progress - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Surface trustworthy ambient workspace state, workflow context, and progress in `cmux` only when the plugin has strong enough evidence to avoid misleading the user.
- **Expected User Change:** Before: Phase 170 could safely attach to the right `cmux` workspace, but it did not define what state, context, or progress should appear once attached. After: users see a stable primary state plus compact workflow-aware context and progress that stays conservative about trust instead of guessing. Examples: a required user action shows `Input needed` instead of generic idle; an active workspace can still show a non-deceptive "work is active" progress signal when exact percentages are unavailable; a verifying run prefers `Verifying` context over raw phase/plan numbers when that workflow meaning is directly trustworthy.
- **Non-Goals:**
  - Shipping sidebar log-stream policy, notification policy, or rate-limiting/dedupe behavior beyond what Phase 171 needs for state and progress.
  - Reopening Phase 170 targeting or multi-workspace proof rules.
  - Building dense roadmap-structure displays that matter more than glanceable workflow meaning.
</phase_intent>

<domain>
## Phase Boundary
Phase 171 defines the user-facing state vocabulary, precedence rules, compact status-pill context, and trustworthy progress behavior for a single already-proven `cmux` workspace. It decides what the sidebar should show, what should win when multiple signals compete, and when context or progress should degrade or hide. It does not broaden into log-stream UX, attention notifications, or low-noise tuning policies reserved for later phases.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- State precedence - Locked. Use an action-first precedence model: `Input needed` > `Blocked` > `Warning` > `Working` > `Complete` > `Idle`. Reasoning: the pill should surface the most actionable current truth first, with true user-gated work ahead of hard-stop failures, and both ahead of advisory or routine activity.
- Hard-stop boundary - Locked. `Blocked` is reserved for true problems where progress cannot continue without repair; degraded trust or partial-confidence conditions stay `Warning`. Reasoning: this keeps `Blocked` meaningful after broadening `Input needed`, instead of using it for every imperfect state.
- Trust gate - Locked. Use a conservative, trust-first gate with tiered degradation: show only fresh, workspace-scoped, directly-derived context; keep coarse context when it is independently trustworthy; hide or simplify surfaces instead of guessing from weak signals. Reasoning: Phase 171 should preserve the trust-first foundation from Phase 170 while still allowing useful ambient status when the source is solid.
- Pill context format - Locked. Show the primary state first, then compact workflow-first context such as `Planning`, `Executing`, or `Verifying`; only fall back to structural phase/plan context when workflow meaning is not directly trustworthy. Reasoning: long-term users care more about what kind of work is happening than about roadmap bookkeeping.

### Medium Decisions
- Input-needed boundary - Locked. Show `Input needed` whenever progress cannot continue without human action, including checkpoints, direct decisions, auth/manual setup steps, repair steps, or required replies. Reasoning: one consistent "you need to do something" state is more trustworthy than splitting those moments across `Idle`, `Warning`, and `Blocked`.
- Progress contract - Locked. Show exact numeric progress when the plugin has trustworthy phase, plan, task, or workflow counts; when exact counts are unavailable but active work is clearly happening, keep some non-deceptive activity signal visible instead of going blank. Reasoning: complete silence during real activity feels flaky, but numeric precision should still be earned.
- Fallback progress presentation - Delegated. The exact UI shape for that non-numeric active-progress signal is left to the agent, as long as it is visibly distinct from exact percentages and does not imply fake precision. Reasoning: the user wants a reliable sign of activity but did not want to over-lock the specific visual form this early.

### Low Defaults and Open Questions
- State labels - Defaulted. Keep the canonical user-facing names in readable Title Case: `Working`, `Input needed`, `Blocked`, `Idle`, `Warning`, `Complete`.
- Silent suppression - Defaulted. Non-`cmux` and suppressed sessions stay quiet and unchanged, consistent with Phase 170 fail-open behavior.
- Structural fallback wording - Defaulted. If workflow meaning is unavailable but structural context is still trustworthy, use short readable labels rather than dense codes.

### Agent's Discretion
- The implementation can choose the exact non-numeric active-progress presentation and compact suffix wording, but it must preserve the action-first precedence model, the hard-stop-only `Blocked` rule, the workflow-first context preference, and the trust-first degradation policy.
</decisions>

<specifics>
## Specific Ideas
- Reuse existing plugin lifecycle signals, `STATE.md` truth, and workflow state rather than inventing a parallel ambient-state engine.
- Treat workflow meaning (`Planning`, `Executing`, `Verifying`) as more useful than raw plan numbering when both cannot fit.
- Make the fallback activity signal clearly different from exact percentage progress so users can tell "active" from "42% complete."
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Original decision: show progress only when exact numeric counts are trustworthy.
- Stress-test revision: keep a visible sign of activity when the workspace is clearly working, even if exact numeric progress is unavailable.
- Follow-on clarification from post-stress-test reassessment: exact percentages still require trustworthy counts; the fallback active-progress presentation is delegated, but it must be non-deceptive and visually distinct from exact progress.
- Original decision: `Blocked` outranks `Input needed` in the primary state order.
- Stress-test revision: `Input needed` should outrank `Blocked` because user action is usually the most actionable truth.
- Follow-on clarification from post-stress-test reassessment: `Blocked` now means a true hard stop that cannot continue without repair, while degraded or partial-confidence conditions stay `Warning`.
- Original decision: compact context should lean on phase/plan structure.
- Stress-test revision: compact context should prefer workflow meaning like `Planning`, `Executing`, and `Verifying`.
- Original decision: `Input needed` should be limited to explicit checkpoints.
- Stress-test revision: broaden `Input needed` to any human-gated progress state, including auth, setup, repair, and required replies.
</stress_tested>

<deferred>
## Deferred Ideas
- Sidebar log-stream wording and lifecycle event policy for major moments such as start, completion, blockers, and warnings.
- `cmux` notification policy for attention-worthy moments.
- Noise-control details such as aggressive dedupe, rate-limiting, and churn suppression beyond what this phase needs for truthful state and progress.
</deferred>

---
*Phase: 171-ambient-workspace-status-progress*
*Context gathered: 2026-03-31*
