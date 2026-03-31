# Phase 172: Ambient Attention UX & Noise Control - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Add trustworthy ambient log and notification behavior for attached `cmux` sessions so meaningful moments are surfaced without turning the sidebar into background noise.
- **Expected User Change:** Before: Phase 171 can show stable sidebar state, compact context, and trustworthy progress, but meaningful lifecycle moments do not yet have a clear log-versus-notification policy. After: users see concise sidebar log entries for major lifecycle events, get notifications for attention-worthy moments, and do not get repetitive churn from routine or repeated events. Examples: workflow start and task completion appear as short sidebar log entries instead of silent state changes; a blocker or checkpoint raises a notification instead of being buried in the sidebar; repeated non-essential updates collapse or stay suppressed instead of spamming the user.
- **Non-Goals:**
  - Building a persistent notification center, alert history viewer, or searchable event timeline.
  - Reopening Phase 170 targeting rules or Phase 171 state/progress trust logic.
  - Adding user-configurable notification preferences or per-event customization in this phase.
</phase_intent>

<domain>
## Phase Boundary
Phase 172 defines which lifecycle moments produce sidebar logs, which moments escalate to notifications, and how repeated or low-value events are deduped or rate-limited so the ambient UX stays useful. It extends the already-attached, trust-gated `cmux` sidebar from Phases 170-171 into an attention surface, but it does not broaden into persistent inboxes, custom preferences, or new targeting/state semantics.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Notification aggressiveness - Locked. Optimize for quiet-by-default attention: routine starts and task completions should log, while notifications are reserved for attention-worthy moments such as checkpoints, blockers, warnings, phase completion, plan completion, and terminal completion moments. Reasoning: the user wants ambient visibility without spam, but still wants meaningful completion boundaries and intervention-needed moments to break through.
- Attention channel split - Locked. Treat sidebar logs as the default narrative surface and notifications as the interruptive escalation surface. Reasoning: this gives users a readable activity trail without making every lifecycle event compete for attention.
- Trust gate reuse - Locked. Reuse the Phase 171 trust-first gate so suppressed, weak-signal, or unattached sessions stay quiet rather than inventing a second ambient signal path. Reasoning: attention UX should inherit the same trust boundary as status and progress instead of bypassing it.

### Medium Decisions
- Completion escalation - Locked. Notify on plan and phase completion, not just the final workflow completion. Reasoning: long-running background work needs meaningful milestone alerts even when the overall workflow has not fully ended yet.
- Noise-control strategy - Defaulted. Deduplicate repeated non-essential events by semantic event key and workspace context, and rate-limit bursty repeats until the underlying state meaningfully changes. Reasoning: the phase goal explicitly rejects repetitive churn, and this is the safest default without over-designing the exact algorithm before planning.
- Log format - Defaulted. Use concise one-line, action-first log entries rather than verbose prose. Reasoning: the sidebar should stay glanceable and secondary to the main work surface.

### Low Defaults and Open Questions
- Routine success visibility - Defaulted. Task completion stays log-only unless it also marks a plan or phase boundary.
- Warning persistence - Delegated. The exact decay window or repeat interval for warning and blocker reminders is left to the agent, as long as repeated alerts are clearly quieter than first-occurrence alerts.
- Lifecycle wording - Defaulted. Prefer consistent human-readable lifecycle labels over dense internal identifiers.

### Agent's Discretion
- The implementation can choose the concrete event taxonomy, dedupe keys, and rate-limit mechanics, but it must preserve the quiet-by-default policy, the log-versus-notification channel split, the trust-gated `cmux` boundary, and the explicit notification of plan and phase completion.
</decisions>

<specifics>
## Specific Ideas
- Reuse the existing attached `cmux` adapter and lifecycle hooks from Phases 170-171 instead of inventing a parallel attention pipeline.
- Keep log copy terse enough that several recent events remain scannable in a compact sidebar.
- Make notifications feel exceptional: intervention-needed moments first, meaningful completion boundaries second, routine activity in logs only.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Original decision: keep notifications limited to checkpoints, blockers, warnings, and only the final workflow completion.
- Stress-test revision: users also want plan and phase completion to notify when background work crosses a meaningful boundary.
- Follow-on clarification from post-stress-test reassessment: routine task completion stays log-only, but plan and phase completion should escalate even before the terminal workflow end.
- Original decision: keep the ambient surface as quiet as possible, even if that means relying mostly on logs.
- Stress-test revision: preserve the quiet-by-default stance, but explicitly separate readable log coverage from interruptive notification coverage so important milestones are not missed.
</stress_tested>

<deferred>
## Deferred Ideas
- User-configurable notification preferences, snoozing, or per-event subscription controls.
- Persistent event history, inbox-style review, or searchable logs.
- Cross-device or OS-native notification integrations beyond the current `cmux` attention surface.
</deferred>

---
*Phase: 172-ambient-attention-ux-noise-control*
*Context gathered: 2026-03-31*
