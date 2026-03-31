---
name: model-profiles
description: AI model selection profiles for bGSD agents — quality/balanced/budget profile definitions, one selected global default, sparse direct overrides, and provider-agnostic guidance for resolving concrete models.
type: shared
agents: [planner, executor, verifier, debugger, roadmapper, project-researcher, phase-researcher, codebase-mapper, plan-checker, github-ci]
sections: [profiles, resolution, overrides, rationale]
---

## Purpose

Controls model selection through one shared project contract. Orchestrators resolve the selected profile plus any sparse direct overrides from `.planning/config.json`, then pass the resulting concrete model parameter to each agent spawn.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: profiles -->
### Profile Definitions

```json
{
  "model_settings": {
    "default_profile": "balanced",
    "profiles": {
      "quality": { "model": "gpt-5.4" },
      "balanced": { "model": "gpt-5.4-mini" },
      "budget": { "model": "gpt-5.4-nano" }
    },
    "agent_overrides": {}
  }
}
```

**quality** — Highest capability profile. Default concrete model: `gpt-5.4`. Use when best reasoning and review quality matter more than speed.

**balanced** (default) — Recommended day-to-day profile. Default concrete model: `gpt-5.4-mini`.

**budget** — Fastest / lowest-cost profile. Default concrete model: `gpt-5.4-nano`.
<!-- /section -->

<!-- section: resolution -->
### Resolution Logic

Resolve once at orchestration start from the canonical contract:

1. Read `.planning/config.json`
2. Check `model_settings.agent_overrides` for a direct concrete-model override for the current agent
3. Otherwise read `model_settings.default_profile`
4. Resolve the concrete model from `model_settings.profiles[default_profile].model`
5. If config is partial or missing, fall back to shipped defaults for `quality`, `balanced`, and `budget`

The public contract is the selected profile plus concrete model ids. Keep provider-specific alias behavior out of user-facing guidance.
<!-- /section -->

<!-- section: overrides -->
### Per-Agent Overrides

Override specific agents without changing the entire profile:

```json
{
  "model_settings": {
    "default_profile": "balanced",
    "profiles": {
      "quality": { "model": "gpt-5.4" },
      "balanced": { "model": "gpt-5.4-mini" },
      "budget": { "model": "gpt-5.4-nano" }
    },
    "agent_overrides": {
      "bgsd-executor": "ollama/qwen3-coder:latest",
      "bgsd-planner": "gpt-5.4"
    }
  }
}
```

Overrides take precedence over the selected project profile and should stay sparse.

**Switching profiles:** `/bgsd-settings profile quality` at runtime, or set `model_settings.default_profile` in `.planning/config.json`.
<!-- /section -->

<!-- section: rationale -->
### Design Rationale

**One selected project default:** Most projects should feel configurable after setting one default profile and three concrete model ids.

**Concrete profiles stay reusable:** `quality`, `balanced`, and `budget` remain the stable knobs across projects even when the actual provider or model id changes.

**Sparse overrides only:** Agent-specific exceptions exist for edge cases such as local models, not as the primary configuration surface.

**Provider-agnostic copy with seeded defaults:** Guidance should talk about capability, speed, and use case while shipping useful GPT-family defaults.
<!-- /section -->

## Cross-references

- <skill:raci /> — Agent roles that determine model assignments

## Examples

See `references/model-profiles.md` and `references/model-profile-resolution.md` for the original references.
