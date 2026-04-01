# Phase 175: Canonical Command Surface Alignment - Research

**Researched:** 2026-03-31
**Domain:** OpenCode slash-command architecture, canonical command routing, and CLI command-surface validation
**Confidence:** HIGH

## User Constraints

- `/bgsd-plan` is the canonical planning-family entrypoint. Teach and validate that family, not legacy wrappers.
- Canonical planning commands must use explicit sub-action-first syntax: `/bgsd-plan phase|discuss|research|assumptions <phase>`.
- Routing must be deterministic from the normalized planning-family prefix and explicit sub-action only; do not infer intent from free text or shorthand like `/bgsd-plan 175`.
- Preserve workflow-owned operands after the normalized prefix. Keep contracts like `roadmap add`, `roadmap insert`, `roadmap remove`, `gaps [milestone-or-context] [flags]`, and `todo add|check` intact.
- Keep planning-family breadth under `/bgsd-plan`; do not split roadmap, gaps, or plan-scoped todos into new top-level families.
- Keep settings and read-only inspection outside `/bgsd-plan`.
- Route first, then load only the selected workflow; do not preload sibling planning workflows.
- Prefer deletion and source-of-truth reduction over adding another compatibility layer.
- Pair risky command-surface cleanup with regression proof around router/help/metadata drift.

## Phase Requirements

- **CLEAN-03:** docs, templates, and help must match the supported model.
- **CLI-01:** maintainers must be able to change dispatch/help/aliases/discovery from a clearer canonical definition.
- **CLI-02:** routing behavior should stop depending on repeated hand-written scans and ambiguous parsing.
- **SAFE-03:** surfaced help/workflow guidance must match the real supported command surface.

## Summary

This phase should use the OpenCode custom-command model exactly as intended: a single markdown command file (`commands/bgsd-plan.md`) acts as the canonical planning-family definition, and that file owns the route table for planning-family sub-actions. The established architecture pattern is umbrella command -> explicit sub-action grammar -> selected workflow only. In this repo, that is already the right product shape and should become the only surfaced source of truth for planning-family guidance.

The highest-risk failure mode is not routing itself; it is drift. Today the same planning-family contract appears in command prompt text, workflow prose, docs, advisory guardrails, discovery/validation rules, and tests. The safe implementation pattern is therefore to centralize the canonical route matrix in one maintained definition, then make validators/tests prove parity instead of hand-maintaining parallel phrasing everywhere. Legacy wrappers should remain classified as compatibility aliases for validation/reporting, but never reintroduced into surfaced guidance.

Current SOTA is stricter than older agent intuition in two ways: OpenCode’s current docs explicitly support markdown-file custom commands as the canonical command surface, and Node now has a stable built-in `util.parseArgs` API for schema-driven CLI parsing instead of bespoke argv scanning. For this phase, do not invent a new command framework. Use the existing markdown command file as the slash-command source of truth, keep operand passthrough intact, and use regression tests plus command-integrity validation to prove every surfaced planning-family reference matches the canonical `/bgsd-plan <sub-action>` contract.

**Primary recommendation:** Make `commands/bgsd-plan.md` the canonical planning-family route matrix, keep routing explicit and passthrough-based, and update docs/validators/tests to derive or verify against that one surface instead of teaching parallel wrappers.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenCode custom markdown commands | Current docs updated 2026-03-30 | Canonical slash-command definition layer | Official OpenCode pattern is command-file driven; this phase is specifically about making one command file the planning-family source of truth. |
| Node.js | `>=18` in repo; `util.parseArgs` stable since Node 20 | Runtime and deterministic CLI parsing underneath the command surface | Already the repo runtime; built-in parser removes need for new parsing deps and reduces bespoke argv logic. |
| Valibot | `^1.2.0` | Structured validation for route payloads/options when schema validation is needed | Already shipped in repo and lighter-weight than adding a new validation layer; use for structured command-context validation, not hand-rolled checks. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:test | Built into Node >=18 | Regression coverage for canonical route/help/validation behavior | Use for command-integrity, alias-classification, and routing parity tests. |
| Zod | `^4.3.6` | Existing plugin-tool arg validation | Keep where already used in plugin tools; do not expand it just for this phase unless touching those surfaces. |
| Existing command-integrity validator (`src/lib/commandDiscovery.js`) | repo-local | Surface drift detection for slash commands and CLI examples | Use to classify legacy aliases, missing operands, wrong-command guidance, and reference-only exceptions. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One canonical `/bgsd-plan` umbrella | Keep standalone wrappers like `/bgsd-plan-phase` in surfaced docs | Reject: preserves drift and teaches compatibility history instead of the supported model. |
| Explicit sub-action grammar | Allow `/bgsd-plan 175` shorthand | Reject: ambiguous, forces intent guessing, weakens validation. |
| Existing OpenCode command file | Introduce a new command-definition framework | Reject: unnecessary architecture churn for a phase whose goal is surface alignment, not platform replacement. |
| Built-in `util.parseArgs` + schema validation | More ad hoc `indexOf('--flag')` scans | Reject: duplicates logic and increases router drift risk. |

## Architecture Patterns

### Recommended Project Structure

- `commands/bgsd-plan.md` — canonical planning-family route matrix and routing contract
- `workflows/*.md` — owned behavior per selected sub-action
- `docs/commands.md` — human-facing rendered explanation of the same canonical family
- `src/lib/commandDiscovery.js` — validation/discovery rules, including legacy alias classification and surfaced-guidance checks
- `tests/validate-commands.test.cjs` + plugin/tests — regression proof that surfaced guidance matches canonical routes

### Pattern 1: Canonical Umbrella Command File

Use one OpenCode command markdown file as the planning-family entrypoint. Put the supported sub-actions, route targets, and operand passthrough rules in that file. Treat it as the maintained definition of the family.

Implementation rule: change planning-family routing in `commands/bgsd-plan.md` first, then update downstream docs/tests/validators to match that definition.

### Pattern 2: Explicit Grammar, Not Intent Guessing

Normalize only:

- `/bgsd-plan phase <phase> [flags]`
- `/bgsd-plan discuss <phase> [flags]`
- `/bgsd-plan research <phase> [flags]`
- `/bgsd-plan assumptions <phase> [flags]`
- `/bgsd-plan roadmap add|insert|remove ...`
- `/bgsd-plan gaps [milestone-or-context] [flags]`
- `/bgsd-plan todo add|check ...`

Do not infer a route from bare operands or prose context. Missing sub-actions or required operands should fail with corrective help.

### Pattern 3: Prefix Normalization + Operand Passthrough

Route selection should consume only the canonical planning-family prefix and required sub-action tokens. After that, pass remaining operands through unchanged to the selected workflow contract.

This is the established low-risk pattern because it keeps workflow behavior stable while simplifying command teaching.

### Pattern 4: Route Then Load One Workflow

After route selection, load only the selected workflow file. Do not preload sibling planning workflows into context. This matches the current `commands/bgsd-plan.md` contract and keeps token usage aligned with project goals.

### Pattern 5: Compatibility Aliases as Validation Metadata Only

Keep legacy wrappers in a centralized alias map for validation/reporting (`legacy-command` classification and migration suggestions), not as surfaced runnable guidance and not as a second canonical route table.

### Anti-Patterns to Avoid

- Reintroducing standalone planning wrappers into docs/help/examples
- Accepting `/bgsd-plan 175` or other shorthand that requires guessing
- Mirroring the same route matrix by hand across router/help/docs/tests without parity checks
- Using operand-tail inspection to decide route ownership beyond the canonical prefix
- Pulling settings or read-only inspection into `/bgsd-plan`
- Preloading multiple sibling workflows “for convenience”

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Planning-family entrypoint definition | Separate parallel wrapper commands and duplicated route prose | One canonical `commands/bgsd-plan.md` route matrix | Lowest-drift source of truth for slash-command teaching. |
| Command inference | Free-text or operand-only guessing | Explicit sub-action grammar with corrective errors | Matches locked deterministic-routing decision. |
| Flag parsing | More `indexOf('--flag')` / `includes('--flag')` scans | Node `util.parseArgs` for CLI parsing, plus schema validation where needed | Current built-in API is stable and safer. |
| Option payload validation | Custom nested `if`/`switch` trees | Valibot `safeParse` / object schemas for structured payloads | Already in repo dependency set and returns issues cleanly. |
| Legacy wrapper handling | Scattered hard-coded alias exceptions | Centralized alias map in validation/discovery layer | Keeps compatibility history visible without teaching it. |
| Drift detection | Manual spot checks | `validateCommandIntegrity` tests plus focused plugin/help regressions | This phase needs proof, not hope. |

## Common Pitfalls

### Pitfall 1: Canonical route changes land in one place only

**What goes wrong:** `commands/bgsd-plan.md` changes but docs, plugin guidance, advisory guardrails, or validation messages keep older wording.

**Why it happens:** planning-family knowledge is currently spread across command files, workflows, docs, validators, and tests.

**How to avoid:** treat the command file as the canonical definition and add parity-focused updates/tests in the same slice.

**Warning signs:** tests still reference removed wrappers; docs show canonical examples that differ from validator suggestions.

### Pitfall 2: Ambiguous shorthand sneaks back in

**What goes wrong:** examples like `/bgsd-plan 175` or `/bgsd-plan discuss` appear in runnable prose.

**Why it happens:** authors confuse reference-style family labels with runnable commands.

**How to avoid:** keep explicit examples everywhere; keep missing-argument validation active; allow placeholder family references only in clearly reference-style contexts.

**Warning signs:** validator starts allowing runnable prose without a phase operand.

### Pitfall 3: Alias removal breaks migration messaging

**What goes wrong:** removed wrappers fall through as generic unknown commands instead of being classified as legacy aliases with a canonical suggestion.

**Why it happens:** alias knowledge is deleted instead of being demoted to validation metadata.

**How to avoid:** preserve centralized alias mapping in discovery/validation while removing surfaced usage.

**Warning signs:** `/bgsd-plan-phase` starts surfacing as `nonexistent-command` instead of `legacy-command`.

### Pitfall 4: Route selection starts inspecting workflow-owned tails

**What goes wrong:** router logic grows special cases for `roadmap`, `todo`, or `gaps` payload shapes, making behavior brittle.

**Why it happens:** maintainers conflate route selection with downstream argument semantics.

**How to avoid:** only normalize the prefix and delegated sub-action; let the selected workflow own the tail contract.

**Warning signs:** routing edits require touching unrelated operand parsing rules or help text for multiple sibling flows.

### Pitfall 5: Cleanup drifts into adjacent command families

**What goes wrong:** settings, inspect, or generalized task management get folded into `/bgsd-plan` during “surface cleanup.”

**Why it happens:** umbrella-command work often attracts unrelated consolidation ideas.

**How to avoid:** keep non-goals explicit in docs/tests and verify only planning-family routes changed.

**Warning signs:** new `/bgsd-plan settings ...` or `/bgsd-plan inspect ...` examples appear during edits.

## Code Examples

Verified patterns from official sources and current repo surfaces.

### 1. OpenCode canonical command-file pattern

Official OpenCode docs say custom commands are defined by markdown files in `commands/` and the file becomes the slash command. That matches using `commands/bgsd-plan.md` as the canonical planning-family command definition.

### 2. Current repo route-matrix pattern

`commands/bgsd-plan.md` already models the right shape:

- one umbrella command
- explicit sub-action list
- route mapping to selected workflow
- operand passthrough
- “load only the selected workflow file” guidance

This is the pattern to strengthen, not replace.

### 3. Validation pattern for compatibility aliases

`src/lib/commandDiscovery.js` centralizes legacy planning aliases:

- `/bgsd-plan-phase` -> `/bgsd-plan phase`
- `/bgsd-discuss-phase` -> `/bgsd-plan discuss`
- `/bgsd-research-phase` -> `/bgsd-plan research`
- `/bgsd-assumptions-phase` -> `/bgsd-plan assumptions`

Keep this map centralized for classification/suggestions only.

### 4. Built-in Node parser pattern

Official Node docs: `util.parseArgs({ args, options, strict, allowPositionals, tokens })` is stable and supports defaults, repeated values, and token output. Use it whenever touched CLI parsing would otherwise add more bespoke scans.

### 5. Structured validation pattern

Official Valibot docs: prefer `safeParse` when validating structured input that should return issues instead of throwing. That fits command payload validation and route-shape checks better than custom nested conditionals.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple standalone wrappers per planning action | One canonical umbrella slash command with sub-actions | Current repo direction; OpenCode command-file model current as of 2026-03 docs | Lower drift, clearer discoverability, easier maintenance. |
| Ambiguous shorthand / implicit intent | Explicit sub-action-first grammar | Locked in Phase 175 context | Deterministic routing and better validation. |
| Hand-written argv scanning everywhere | Node `util.parseArgs` stable built-in parser | Stable since Node 20; repo already on Node >=18 | No extra dependency needed for structured parsing; safer future router cleanup. |
| Ad hoc validation branches | Schema-driven validation with Valibot `safeParse` | Current official Valibot docs | Cleaner issue reporting and less custom glue logic. |
| Deleting aliases entirely during cleanup | Preserve alias map only for validation/migration messaging | Proven in Phase 174 verification/tests | Lets surfaced guidance stay strict without losing precise legacy classification. |

## Open Questions

- Should docs/help parity be enforced by a generated shared route matrix or by strong tests around manually maintained prose? Recommendation: tests first; generation only if repeated drift persists.
- If Phase 175 touches deeper CLI parsing, which slices can safely adopt `util.parseArgs` now without broad router refactoring? Keep scope narrow and additive.
- Are there any remaining surfaced planning-family examples outside the currently tested inventories (for example niche reference docs or archived templates) that need parity coverage?

## Sources

### Primary (HIGH confidence)

- Phase context: `.planning/phases/175-canonical-command-surface-alignment/175-CONTEXT.md`
- Requirements traceability: `.planning/REQUIREMENTS.md`
- Canonical command definition: `commands/bgsd-plan.md`
- Planning workflow boundaries: `workflows/plan-phase.md`, `workflows/discuss-phase.md`, `workflows/research-phase.md`
- Current surfaced command docs: `docs/commands.md`
- Validation/discovery logic: `src/lib/commandDiscovery.js`
- Regression coverage: `tests/validate-commands.test.cjs`
- Repo runtime/dependency versions: `package.json`
- OpenCode commands docs: https://opencode.ai/docs/commands/
- Node util.parseArgs docs: https://nodejs.org/api/util.html#utilparseargsconfig
- Valibot parse-data docs: https://valibot.dev/guides/parse-data/

### Secondary (MEDIUM confidence)

- CLI Simplification PRD: `.planning/research/CLI-SIMPLIFICATION-PRD.md`
- Greenfield Compatibility Cleanup PRD: `.planning/research/GREENFIELD-COMPAT-CLEANUP-PRD.md`
- Plugin tool example using schema-validated args: `src/plugin/tools/bgsd-plan.js`

### Tertiary (LOW confidence)

- General model prior that umbrella command surfaces reduce cognitive load; included only where supported by repo-local evidence.

## Metadata

**Confidence breakdown:** command-surface architecture HIGH; OpenCode command-file pattern HIGH; alias/validator behavior HIGH; parser modernization guidance HIGH for Node built-in parser, MEDIUM-HIGH for phased adoption scope.

**Research date:** 2026-03-31

**Valid until:** Re-check if OpenCode command-file docs, Node runtime floor, or repo routing architecture changes materially.
