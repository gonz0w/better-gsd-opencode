# Phase 169: Canonical Model Resolution & Visibility - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Make model resolution, routing, and visible model-state reporting all run through the shared profile-based settings contract so users can change behavior once and trust every workflow path.
- **Expected User Change:** Before: users could change settings and still hit paths that exposed only concrete model ids, hid whether the source was a global profile or an override, or behaved differently because routing still depended on provider-tier names. After: every user-facing model surface for this phase shows both the configured choice and the resolved model, and routing follows `quality` / `balanced` / `budget` consistently regardless of provider changes. Examples: compact init shows the active configured choice plus resolved model; verbose/settings/diagnostic surfaces show per-agent override vs default-profile source alongside the concrete model; routing recommendations use shared profiles instead of `haiku` / `sonnet` / `opus`.
- **Non-Goals:**
  - Add new public profiles, new provider-specific tiers, or a second routing vocabulary beyond `quality` / `balanced` / `budget`.
  - Build a new persistence or migration system just to preserve old model-selection storage patterns.
  - Expand this into a broader settings UX redesign unrelated to canonical model resolution, visibility, or routing.
</phase_intent>

<domain>
## Phase Boundary
This phase finishes applying the canonical model-settings contract everywhere users rely on model state or model-driven routing: one live resolution path, one consistent configured-versus-resolved visibility story, and provider-agnostic routing that uses the shared profile contract directly.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Visibility scope — Locked. Update all user-facing surfaces that expose model state in this phase, including both human-readable and structured outputs. Users should not have to infer whether a surface is showing configured intent or the resolved concrete model.
- Routing contract — Locked. Orchestration recommends the public shared profiles `quality`, `balanced`, and `budget` directly, then canonical resolution selects the concrete model. Do not introduce an internal capability-band abstraction in this phase.
- Legacy cleanup boundary — Locked. Remove legacy provider-shaped model APIs in this phase, but only when there is proof that they have no live reads or callers. Legacy storage and helpers must not remain as alternate truth sources.

### Medium Decisions
- Compact init depth — Locked. Compact init shows a concise configured-plus-resolved summary for the active path, while verbose output expands to per-agent details and overrides.
- Structured output compatibility — Locked. Structured outputs that expose model state are updated in this phase, and old structured model-state fields are replaced rather than kept as additive compatibility baggage.
- Diagnostics timing — Locked. If a diagnostics or state surface is user-facing and exposes model state, it belongs in this phase rather than waiting for a later cleanup pass.

### Low Defaults and Open Questions
- Terminology — Defaulted. Use `configured` and `resolved` as the standard user-facing labels for model state.

### Agent's Discretion
- Exact helper naming and placement are up to the planner/implementer as long as all live resolution and visibility surfaces consume one canonical resolver path and one shared display/view-model shape.
- Verification strategy can choose the most direct test split, but it must cover resolver parity, visibility parity across touched surfaces, routing behavior, and legacy-path removal safety.
</decisions>

<specifics>
## Specific Ideas
- Prefer one shared presenter/view-model helper for configured-versus-resolved state instead of hand-formatting each command surface.
- Treat direct overrides as explicit sparse exceptions; when no override exists, show the selected global profile as the configured source.
- Deletion of legacy model APIs needs explicit evidence of no live reads/callers before removal, not just “seems unused” judgment.
- Keep the user contract simple and literal: routing language and visible settings language should both stay on `quality` / `balanced` / `budget`.
</specifics>

<stress_tested>
## Stress-Tested Decisions
All decisions held up under stress testing — no revisions needed.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---
*Phase: 169-canonical-model-resolution-visibility*
*Context gathered: 2026-03-30*
