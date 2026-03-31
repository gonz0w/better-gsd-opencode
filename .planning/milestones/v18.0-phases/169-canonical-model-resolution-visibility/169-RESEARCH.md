# Phase 169: Canonical Model Resolution & Visibility - Research

**Researched:** 2026-03-30
**Domain:** Internal model-resolution architecture, workflow visibility, and provider-agnostic routing
**Confidence:** HIGH

## User Constraints

- Keep the Phase 168 public contract intact: `model_settings.default_profile`, built-in `quality` / `balanced` / `budget` profiles, and sparse `model_settings.agent_overrides` only.
- Do not reintroduce `opus` / `sonnet` / `haiku` as public contract language or as the thing users must understand to change behavior.
- Model behavior must change from settings alone; no prompt edits, workflow-specific exceptions, or path-specific resolver logic.
- Keep one selected global profile as the normal control surface; per-agent overrides stay explicit sparse exceptions keyed by canonical agent id.
- Prefer extending the existing config-first resolver path over adding new persistence, alias, or migration systems in this phase.

## Phase Requirements

- `MODEL-04` User can change model behavior from settings alone because all workflow spawn paths resolve through one canonical model resolver.
- `MODEL-05` User can inspect both the configured global profile or direct override and the resolved concrete model in settings or init output where model state is shown.
- `MODEL-08` User gets consistent agent routing behavior even when concrete providers change because routing logic no longer depends directly on Anthropic tier names.

## Summary

Phase 168 already did the hard contract work: `model_settings` is canonical, `resolveModelSelectionFromConfig()` exists, touched runtime paths already honor override > selected profile > shipped defaults, and the plugin enricher already exposes `selected_profile` plus `resolved_model`. The remaining Phase 169 gap is not “invent a new model system”; it is “finish applying the existing one everywhere users and workflows actually trust.”

The main unfinished work is concentrated in three places: visibility surfaces that still only emit concrete `*_model` values (`src/commands/init.js`), routing/orchestration code that still compares provider-tier strings like `haiku` / `sonnet` / `opus` (`src/lib/orchestration.js`), and legacy SQLite/cache/state surfaces that can still leak old provider-shaped assumptions if they stay on any live path. The right plan is to extend the current canonical resolver with one shared display/view-model helper, then refactor routing to recommend shared profiles or capability bands first and resolve concrete model ids second.

**Primary recommendation:** Make `resolveModelSelectionFromConfig()` the only live resolver, add one shared “configured vs resolved model state” presenter for init/settings/state surfaces, and replace provider-string routing with profile-based recommendation (`quality` / `balanced` / `budget`) before final concrete-model resolution.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `src/lib/config-contract.js` | current repo | Canonical `model_settings` normalization and compatibility mirrors | Already ships the contract introduced in Phase 168 |
| `src/lib/helpers.js` (`buildCanonicalModelSettings`, `resolveModelSelectionFromConfig`) | current repo | Single config-first resolver | Already powers the touched runtime path and should stay the only resolver |
| `src/plugin/command-enricher.js` + `src/commands/init.js` | current repo | Workflow handoff data and visible model state | These are the surfaces users and spawned agents rely on |
| `src/lib/orchestration.js` | current repo | Task complexity routing | This is the main remaining provider-coupled surface for `MODEL-08` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/commands/verify.js` | current repo | Validate `model_settings` contract shape | Keep config validation aligned with any visibility/schema additions |
| `tests/decisions.test.cjs`, `tests/enricher-decisions.test.cjs`, `tests/integration.test.cjs` | current repo | Resolver parity regression coverage | Use for canonical resolution and visibility parity |
| `tests/init.test.cjs`, `tests/orchestration.test.cjs` | current repo | Init-output and routing regression coverage | Use when expanding visibility and removing provider-tier routing |
| OpenAI Models docs / OpenAI API docs | current official docs | Confirm shipped concrete model ids are normal string model parameters | Use for current model-id guidance, not for internal routing logic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending the canonical resolver everywhere | Keep per-surface resolver logic | Guaranteed drift; fails `MODEL-04` |
| Profile-based routing | Keep `haiku` / `sonnet` / `opus` priority tables | Fails `MODEL-08` when provider/model ids change |
| Config-first visibility | Read SQLite `model_profiles` for display | Reintroduces stale provider-shaped state |
| Shared display helper | Hand-format configured/resolved state in each command | Easy to drift and miss parity tests |

## Architecture Patterns

### Recommended Project Structure
- `src/lib/config-contract.js` owns normalization and compatibility mirrors.
- `src/lib/helpers.js` owns canonical resolution and should also own any reusable display/view-model helper.
- `src/plugin/command-enricher.js`, `src/commands/init.js`, `src/commands/misc.js`, and other user-visible surfaces consume helper output only.
- `src/lib/orchestration.js` recommends a shared profile or capability band first, then resolves the concrete model through the same helper path.
- Tests should mirror these four layers: contract, resolver, visibility surfaces, and routing.

### Pattern 1: Normalize Once, Resolve Everywhere
Use `normalizeConfig()`/`applyDerivedModelSettings()` to produce canonical config, then route all model reads through `resolveModelSelectionFromConfig()`. No command or plugin surface should reconstruct precedence locally.

### Pattern 2: Display Configured State Separately From Resolved State
Treat “what the user selected” and “what concrete model will run” as different fields:
- configured state: selected default profile or direct agent override
- resolved state: concrete model id after precedence and defaults

This avoids forcing callers to infer configuration from a model string.

### Pattern 3: Route by Shared Profile, Not Provider Name
Complexity/routing should recommend `quality`, `balanced`, or `budget` (or an internal equivalent capability band), then resolve that recommendation through canonical config. Do not compare provider strings or model ids directly to decide routing priority.

### Anti-Patterns to Avoid
- Direct `config.model_profile` lookups outside normalization/compatibility boundaries
- String-priority logic on `haiku`, `sonnet`, `opus`, or raw model ids
- SQLite `model_profiles` reads on any live user-facing resolution path
- Init/settings/state surfaces that show only `*_model` and hide the configured source
- Regression coverage that proves helper parity but not init/orchestration parity

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shared routing semantics | New alias or per-agent profile matrix | Existing `quality` / `balanced` / `budget` contract | Phase 168 explicitly locked the simpler contract |
| Visibility schema | Ad hoc init/settings/state objects | One shared helper that returns configured + resolved model state | Keeps parity across surfaces |
| Provider ranking | `haiku` / `sonnet` / `opus` comparisons or model-id heuristics | Profile/capability recommendation plus canonical resolution | Survives provider swaps |
| Persistence changes | Expanded SQLite schema or new storage layer | Config-first reads; defer storage cleanup unless strictly required | Lower risk and smaller phase |
| Configuration inference | Reverse-engineer profile/override from resolved model id | Carry explicit `selected_profile`, `source`, and configured value | Prevents ambiguity |

## Common Pitfalls

### Pitfall 1: Compatibility mirrors become the real API
**What goes wrong:** `model_profile` or old provider-tier defaults quietly become the thing new code reads.
**Why it happens:** Compatibility fields are convenient and already present.
**How to avoid:** Allow compatibility mirrors only at normalization boundaries; live logic should consume canonical `model_settings` or helper output.
**Warning signs:** New code branches on `config.model_profile`; new tests only mention the mirror fields.

### Pitfall 2: Visibility parity stops at touched Phase 168 paths
**What goes wrong:** Some commands show `selected_profile` + `resolved_model`, while init/settings/state still only show concrete model ids or `model_profile`.
**Why it happens:** Visibility work is spread across multiple command surfaces.
**How to avoid:** Introduce one shared model-state presenter and update all model-visible init/settings/state surfaces together.
**Warning signs:** `src/commands/init.js` still emits only `executor_model`/`planner_model`/`verifier_model`; formatted state output still prints `model_profile` only.

### Pitfall 3: Routing still depends on provider-tier strings
**What goes wrong:** Settings may resolve canonically, but task routing still changes behavior based on legacy provider names.
**Why it happens:** `src/lib/orchestration.js` still uses `MODEL_MAP` and priority maps keyed by `haiku` / `sonnet` / `opus`.
**How to avoid:** Replace provider-tier outputs with profile/capability recommendations, then resolve via canonical config.
**Warning signs:** Tests still assert `recommended_model` is one of `haiku`, `sonnet`, `opus`.

### Pitfall 4: SQLite legacy tables silently reintroduce old semantics
**What goes wrong:** A future read path uses `model_profiles` rows seeded with `opus`/`sonnet`/`haiku` defaults and bypasses the canonical config path.
**Why it happens:** The tables and helper APIs still exist in `db.js`, `planning-cache.js`, and plugin DB cache code.
**How to avoid:** Fence legacy tables off from live resolution; if kept, treat them as dead compatibility/storage debt, not truth.
**Warning signs:** New code reads `getModelProfile()`/`getModelProfiles()` to determine current agent model behavior.

### Pitfall 5: Tests lock in the old routing contract
**What goes wrong:** Refactor lands in code, but tests keep provider-tier assertions, blocking or distorting the Phase 169 implementation.
**Why it happens:** Current orchestration tests explicitly validate `haiku` / `sonnet` / `opus` outputs.
**How to avoid:** Update tests early in the phase to express profile-based or provider-agnostic routing expectations.
**Warning signs:** `tests/orchestration.test.cjs` remains the only routing truth source and still names provider tiers.

## Code Examples

Verified patterns from official and project sources.

### Canonical concrete-model resolution (official API shape + repo contract)
OpenAI’s current API docs use a plain string `model` parameter such as `gpt-5.4`; bGSD should therefore resolve to a concrete model id before spawn, not leave provider-tier placeholders in runtime handoff.

```javascript
const response = await openai.responses.create({
  model: "gpt-5.4",
  input: "..."
});
```

### Recommended display/view-model shape for bGSD surfaces
Pattern only; actual implementation should reuse `resolveModelSelectionFromConfig()`.

```javascript
const resolved = resolveModelSelectionFromConfig(config, agentType);

const configured = resolved.source === 'agent_override'
  ? { kind: 'agent_override', agent: agentType, value: config.model_settings.agent_overrides[agentType] }
  : { kind: 'default_profile', value: resolved.selected_profile };

return {
  configured,
  selected_profile: resolved.selected_profile,
  resolved_model: resolved.model,
  source: resolved.source,
};
```

### Recommended routing pattern
Route to a shared profile first; resolve the concrete model second.

```javascript
const recommendedProfile = score >= 4 ? 'quality' : score === 3 ? 'balanced' : 'budget';
const model = resolveModelSelectionFromConfig({
  model_settings: {
    ...config.model_settings,
    default_profile: recommendedProfile,
  }
}, 'bgsd-executor').model;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static per-agent provider-tier tables in `MODEL_PROFILES` | Shared `model_settings` contract plus config-first resolver | Phase 168 | Settings can already change live behavior on touched runtime paths |
| SQLite `model_profiles` defaults as live selection backing | Canonical config normalization with compatibility mirrors | Phase 168 | Public contract is provider-agnostic; legacy tables should not drive resolution |
| Routing outputs and priorities tied to `haiku` / `sonnet` / `opus` | Profile/capability recommendation resolved through canonical config | Recommended for Phase 169 | Provider/model changes stop altering routing semantics |
| Init surfaces showing only concrete `*_model` values | Configured selection/override shown alongside resolved concrete model | Required in Phase 169 | Users can verify both intent and actual runtime behavior |

## Open Questions

- Which init outputs need configured-vs-resolved model state in compact mode versus verbose-only mode?
- Should legacy SQLite `model_profiles` writes stay in place but be fenced off from reads, or is it worth deleting any remaining live APIs in this phase?
- Should `state show` be updated in this phase if it is still user-facing model state, or can it wait until a broader diagnostics cleanup pass?

## Sources

### Primary (HIGH confidence)
- `src/lib/config-contract.js:106-130` — canonical `model_settings` normalization and compatibility mirrors
- `src/lib/helpers.js:633-696` — canonical resolution path and precedence
- `src/lib/decision-rules.js:321-340` — decision engine already delegates to the canonical resolver
- `src/plugin/command-enricher.js:342-374, 537-546` — enricher already surfaces `selected_profile` and `resolved_model`
- `src/commands/init.js:326-329, 673-677, 1031-1036, 1784-1787` — init still exposes concrete model ids without configured-vs-resolved view data
- `src/lib/orchestration.js:73-79, 213-218, 361-403` — routing still depends on provider-tier strings
- `src/lib/db.js:250-280`, `src/lib/planning-cache.js:868-976`, `src/plugin/lib/db-cache.js:179-188` — legacy SQLite model-profile persistence still uses provider-tier defaults
- `tests/decisions.test.cjs:525-604`, `tests/enricher-decisions.test.cjs:435-469`, `tests/integration.test.cjs:190-233`, `tests/orchestration.test.cjs:349-355` — current regression surface and remaining routing debt
- OpenAI official docs: `https://platform.openai.com/docs/models` and OpenAI API docs via Context7 — current concrete model ids and `model` string parameter usage (`gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`)

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md:32-39` — Phase 169 goal and success criteria
- `.planning/REQUIREMENTS.md:18-22, 58-62` — requirement text for `MODEL-04`, `MODEL-05`, `MODEL-08`
- `.planning/phases/168-adaptive-model-settings-contract/168-RESEARCH.md` — Phase 168 recommendations and boundaries
- `.planning/phases/168-adaptive-model-settings-contract/168-CONTEXT.md` — locked user decisions carried forward
- `.planning/phases/168-adaptive-model-settings-contract/168-03-PLAN.md` and `168-03-SUMMARY.md` — what Phase 168 intentionally left for Phase 169
- `docs/agents.md:341-345`, `docs/configuration.md:105-140`, `workflows/settings.md`, `workflows/set-profile.md` — current user-facing profile contract and routing intent

### Tertiary (LOW confidence)
- Brave search result for OpenAI models index, used only to confirm current official model-doc URLs before checking the official pages directly

## Metadata

**Confidence breakdown:** Canonical resolver and current gaps: HIGH. Legacy SQLite reintroduction risk: HIGH. Exact compact-mode visibility scope: MEDIUM. Whether storage cleanup should happen in Phase 169 or later: MEDIUM.

**Research date:** 2026-03-30

**Valid until:** 2026-04-30 or until Phase 169 materially changes model-resolution/routing surfaces, whichever comes first.
