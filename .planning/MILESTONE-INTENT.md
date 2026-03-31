# Milestone Intent: v18.0 Adaptive Models & Ambient cmux UX

## Why Now

The workflow foundation is stable enough to turn outward again: operators need better control over which models each agent uses, and the plugin already has enough state to surface a trustworthy ambient workspace HUD through `cmux`. Shipping these together makes bGSD easier to tune and easier to monitor without changing OpenCode core behavior.

## Targeted Outcomes

- DO-117 - Explore dynamic model configuration and smarter profile management
- DO-121 - Explore a CMUX-first OpenCode UX that surfaces working, waiting, blocked, and idle state
- Advance the enduring project objective by reducing operator friction and making agent behavior more legible per token spent

## Priorities

- Make model configuration editable through settings rather than workflow text or provider-specific defaults
- Keep model resolution and routing provider-agnostic while preserving migration-safe legacy behavior
- Bias the first `cmux` slice toward trustworthy workspace-level status, progress, and attention moments
- Prefer quiet fallback behavior over ambitious but noisy instrumentation

## Non-Goals

- Modifying OpenCode core UI or chat behavior
- Building deep per-agent panes before workspace-level truth is reliable
- Solving multi-user repo coordination, ownership, or GitHub issue workflow in this milestone
- Replacing the whole runtime or packaging model as part of model configuration work

## Notes

- Use `.planning/research/DYNAMIC-MODEL-CONFIG-PRD.md`, `.planning/research/CMUX-FIRST-UX-PRD.md`, and `.planning/research/CMUX-FIRST-UX-BACKLOG.md` as the primary planning seeds.
- Prefer existing plugin lifecycle signals and persisted planning state over inventing new orchestration layers.
- Keep `cmux` integration workspace-scoped first; only add richer agent detail if signal quality proves reliable.
