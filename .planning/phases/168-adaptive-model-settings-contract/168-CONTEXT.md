# Phase 168: Adaptive Model Settings Contract - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<phase_intent>
## Phase Intent

- **Local Purpose:** Replace Anthropic-shaped model assumptions with a simple project settings contract built around shared profiles, one project default, and sparse agent exceptions.
- **Expected User Change:** Before: model behavior is effectively coupled to provider-specific workflow assumptions, so changing projects or preferring local models means fighting baked-in Anthropic defaults. After: the user can define the concrete models for `quality`, `balanced`, and `budget`, choose one project-wide active profile, and optionally override a specific agent with a different concrete model without editing workflow prompts.
  - A project can set `balanced` to an OpenAI GPT model and make that the default behavior for the whole workflow surface
  - A different project can switch the global default to `quality` or `budget` without editing prompt files or agent definitions
  - One agent can be overridden to a local model for a specific task while the rest of the project continues using the selected global profile
- **Non-Goals:**
  - Preserving `opus`, `sonnet`, or `haiku` compatibility paths just because older workflow assumptions used them
  - Building a separate alias system beyond the built-in `quality`, `balanced`, and `budget` profile names
  - Forcing users through a full agent-by-agent mapping matrix before the settings contract is useful

</phase_intent>

<domain>
## Phase Boundary

Deliver the user-authored settings surface for model profiles and overrides, plus the `/bgsd-settings` flow needed to configure it. The normal path is one project-wide selected profile backed by user-configurable concrete models for `quality`, `balanced`, and `budget`; agent-specific overrides are sparse exceptions for cases like local models. This phase defines and exposes that contract. It does not need to preserve legacy Anthropic naming or build a migration-safe compatibility layer.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Contract center of gravity - Locked. Remove model aliases from this phase and make the contract revolve around the three built-in profile names `quality`, `balanced`, and `budget`. Reasoning: the user only wants to set concrete models for those profiles and does not want extra abstraction beyond what is needed to stop Anthropic-coupled behavior.
- Global profile first - Locked. Use one project-wide selected profile as the normal control surface instead of per-agent profile mapping. Reasoning: startup configuration should be simple and obvious, with one default that governs the project unless the user chooses an exception.
- Sparse override model - Locked. Agent-specific overrides remain in scope, but only as optional exceptions whose default state is empty. Reasoning: overrides are justified for edge cases like pointing one agent at a local model, not as the main day-to-day configuration surface.
- Greenfield break over compatibility - Locked. Treat Phase 168 as a break-and-replace contract that does not preserve legacy `opus` / `sonnet` / `haiku` behavior. Reasoning: this is a single-user greenfield app and the user explicitly wants the planner to optimize for the new settings system working cleanly rather than carrying migration safety.

### Medium Decisions
- Concrete profile definitions - Locked. Users configure the concrete model behind each of `quality`, `balanced`, and `budget`, and shipped defaults should target OpenAI GPT-family models so projects work without extra setup. Reasoning: the user wants convenient defaults for personal use, with OpenAI as the baseline rather than an empty abstraction layer.
- Override target shape - Locked. Agent overrides should point directly to a concrete model identifier so exceptions can use cloud or local models outside the three shared profiles when needed. Reasoning: the motivating override case is a one-off local model for a specific agent or task.
- Settings UX scope - Locked. `/bgsd-settings` should land in this phase and lead with the global profile choice plus profile definitions, with overrides presented as advanced sparse exceptions rather than a required matrix. Reasoning: the new contract is not complete for the user unless the settings flow exposes it in the same phase.

### Low Defaults and Open Questions
- Provider-agnostic language - Defaulted. Copy should describe profiles in terms of capability, speed, and use case even though the default shipped concrete models are OpenAI GPT models. Reasoning: the user wants freedom from Anthropic assumptions, but not empty generic prose.
- Canonical agent keys - Defaulted. Use canonical agent IDs like `bgsd-planner` and `bgsd-executor` anywhere overrides need explicit ownership. Reasoning: the planner and settings flow need one stable naming scheme.
- Empty override representation - Delegated. Unset overrides may be omitted or represented by an empty value, as long as the resulting contract reads clearly and behaves as "use the project default profile." Reasoning: this is implementation detail, not a user-facing product decision.

### Agent's Discretion
- Exact settings key names and JSON nesting, as long as the contract clearly separates shared profile definitions, one project default profile, and sparse agent overrides.
- Exact validation wording and error messages for invalid profile names, missing default profiles, or malformed override values.
- Exact `/bgsd-settings` interaction flow, as long as the first-run path is project-default-first and override editing is clearly secondary.
</decisions>

<specifics>
## Specific Ideas

- The core user problem is not theoretical provider neutrality; it is escaping today's Anthropic-shaped assumptions without editing workflow prompts.
- The user expects built-in profile names `quality`, `balanced`, and `budget` to stay as the main reusable knobs across projects.
- OpenAI GPT models should be the shipped defaults so the system works out of the box for the current user.
- Agent overrides exist mainly for exceptions such as routing a specific agent to a local model while the rest of the project keeps using the selected global profile.
- A large agent-by-agent configuration matrix would feel overbuilt; the desired UX is one obvious global default with optional exceptions.
</specifics>

<stress_tested>
## Stress-Tested Decisions

- Contract simplified under pushback. Original direction: include aliases, profile-to-agent mappings, and compatibility-oriented structure. Stress-test revision: drop aliases entirely, remove the per-agent mapping as the normal path, and center the contract on shared profiles plus one global selected profile.
- Compatibility posture reversed intentionally. Original direction: honor roadmap wording around migration-safe legacy support. Stress-test revision: treat this as a greenfield break-and-replace phase and make legacy Anthropic naming explicitly out of scope.
- Override semantics narrowed to exceptions. Original direction: discuss whether overrides should point to aliases or raw values inside a broader mapping system. Stress-test revision: keep overrides only for sparse exceptions and let them target a direct concrete model so local-model cases are possible.
- Settings UX narrowed to the simplest useful path. Original direction: `/bgsd-settings` could expose a richer agent/profile mapping surface. Stress-test revision: open with one project default profile and treat agent overrides as optional, mostly-empty advanced configuration.
</stress_tested>

<deferred>
## Deferred Ideas

- Legacy compatibility or migration tooling for `opus`, `sonnet`, and `haiku` naming - explicitly out of scope for this greenfield contract.
- A separate reusable alias layer beyond `quality`, `balanced`, and `budget` - unnecessary for the current user and deferred unless a future phase proves the need.
- Multi-user or provider-marketplace style abstraction beyond simple profile-backed model selection - outside the scope of this phase's single-user settings contract.
</deferred>

---
*Phase: 168-adaptive-model-settings-contract*
*Context gathered: 2026-03-30*
