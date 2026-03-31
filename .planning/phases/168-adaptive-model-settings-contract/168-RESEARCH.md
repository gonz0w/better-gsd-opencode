# Phase 168 Research: Adaptive Model Settings Contract

**Date:** 2026-03-30
**Desired outcome:** DO-117

## Decision Note

- Plan against `168-CONTEXT.md` as the governing artifact for this phase.
- Treat alias-heavy and migration-safe legacy wording in roadmap and requirements as stale inputs that Phase 168 should align before or alongside implementation.
- Favor the lightest implementation that solves the real problem: keep the existing global `model_profile` idea, let `quality` / `balanced` / `budget` point at user-chosen concrete models, and allow sparse direct agent overrides.
- Defer broad cleanup, alias layers, compatibility shims, and storage redesign unless they are strictly required to make the simple path work.

## Standard Stack

- Reuse the existing shared config pipeline: `src/lib/constants.js`, `src/lib/config-contract.js`, `src/lib/config.js`, and `src/plugin/parsers/config.js`.
- Keep the settings contract in `.planning/config.json` as the user-authored source of truth.
- Reuse existing workflow/settings surfaces instead of inventing a second editor or admin path: `commands/bgsd-settings.md`, `workflows/settings.md`, `workflows/set-profile.md`.
- Reuse the runtime injection path already feeding workflow spawns: `src/lib/helpers.js`, `src/lib/decision-rules.js`, `src/plugin/command-enricher.js`, `src/commands/init.js`.
- Reuse the existing Node test suite with targeted `node --test` slices plus `npm run build` for bundle validation.

## Architecture Patterns

- Keep the current mental model intact: one active global profile selector, built-in profile names, and optional agent exceptions.
- Use one canonical settings contract that expresses exactly three concepts: shared profile definitions, one selected project default profile, and sparse per-agent overrides.
- Collapse model selection to a config-first resolver path. Current code has two competing sources of truth: config keys and the SQLite `model_profiles` table.
- Keep workflow prompts model-agnostic. Workflows should continue consuming resolved `*_model` values from init/enricher output instead of learning model-selection rules themselves.
- Keep provider-agnostic language at the UX layer while shipping GPT-family concrete defaults in the canonical contract.
- Treat agent overrides as direct concrete model exceptions keyed by canonical agent ids such as `bgsd-planner` and `bgsd-executor`.

## Don't Hand-Roll

- Do not add a second alias abstraction on top of `quality`, `balanced`, and `budget` for this phase.
- Do not expand SQLite or cache-backed model storage into a richer contract for this phase if config can represent the needed state directly.
- Do not leave parallel resolver implementations in `helpers.js`, `decision-rules.js`, and `misc.js`; Phase 168 should move them behind one shared contract.
- Do not keep `opus` / `sonnet` / `haiku` as the canonical public language in settings, docs, or workflow guidance.

## Common Pitfalls

- `model_profile`, `model_profiles`, and `model_overrides` are currently inconsistent across docs and code. Partial cleanup will create more drift, not less.
- `src/lib/helpers.js`, `src/lib/decision-rules.js`, and `src/commands/misc.js` each resolve models differently today; Phase 168 must avoid fixing only one of them.
- `src/plugin/command-enricher.js` and `src/commands/init.js` inject model decisions into many workflows, so hidden fallback logic here can undermine an otherwise-correct config contract.
- The current SQLite `model_profiles` schema hard-codes `quality_model`, `balanced_model`, `budget_model`, and `override_model`; leaving it untouched risks preserving the old contract invisibly.
- Roadmap and requirements still promise aliases and migration-safe legacy behavior, while phase context explicitly rejects both. Execution needs truthful planning artifacts or verification will chase the wrong goal.

## Code Examples

- Shared config normalization pattern: `src/lib/config-contract.js`
- Current runtime resolver entrypoint: `src/lib/helpers.js:621`
- Current decision-rule resolver: `src/lib/decision-rules.js:322`
- Current command-surface resolver drift: `src/commands/misc.js:542`
- Current settings workflow still centered on `model_profile`: `workflows/settings.md:27`
- Current plugin enrichment still injects only `model_profile`: `src/plugin/command-enricher.js:362`

## Planning Implications

- Start by aligning stale planning artifacts so the execution phase, verifier, and user-facing docs all target the same contract.
- Keep the implementation minimal: no alias system, no migration layer, no broad storage redesign in this phase.
- Split config-contract work from runtime resolution work; they touch overlapping concepts but different failure modes.
- Keep settings UX and docs after the shared contract exists, otherwise workflow copy will drift immediately.
