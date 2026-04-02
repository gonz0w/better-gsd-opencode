# Phase 182: Risk-Routed Hardening Proof Policy - Research

**Researched:** 2026-04-01
**Domain:** risk-routed verification policy, proof normalization, and verifier reporting for runtime hardening
**Confidence:** HIGH

## User Constraints

<user_constraints>
- Keep the route vocabulary fixed to `skip`, `light`, and `full`; do not invent a second taxonomy.
- Treat runtime, shared-state, and plugin changes as default-`full` work for this milestone unless a stricter future policy intentionally changes that contract.
- Treat docs-, workflow-, template-, and guidance-only slices as eligible for structural or focused proof without defaulting to broad regression.
- Generated-artifact changes (`plugin.js`, `bin/bgsd-tools.cjs`) do **not** auto-escalate to `full`; planners must write an explicit low-risk rationale when keeping them below `full`.
- Proof bundle is locked: `skip` = structural proof only; `light` = focused behavior proof plus smoke regression; `full` = focused behavior proof plus broad regression.
- Verifier output must separate missing behavior proof, missing regression proof, and missing human verification; route-exempt buckets must read `not required`, not like failures.
- Planners/executors may raise a route, but lowering below the default expectation requires explicit written justification.
- Keep scope inside this milestone's hardening-route contract. Do not redesign the whole verification system, add new route names, or force every artifact-adjacent change to `full`.
</user_constraints>

## Phase Requirements

<phase_requirements>
- **TEST-01:** Planner and execution artifacts carry an explicit `verification_route` of `skip`, `light`, or `full` for implementation work.
- **TEST-02:** Runtime, shared-state, plugin, and generated-artifact changes in this milestone require focused proof plus broad regression when the blast radius is high.
- **TEST-03:** Docs-, workflow-, template-, and guidance-only slices can use structural or focused proof without defaulting to repeated broad-suite runs.
- **TEST-04:** Verifier output distinguishes missing behavior proof, missing regression proof, and missing human verification instead of conflating them.
</phase_requirements>

## Summary

Phase 182 should be planned as a **single contract-normalization slice**, not as a docs cleanup and not as an abstract testing-policy debate. The repo already has the right seeds: the milestone intent requires `verification_route` to travel through planning, execution, proof, and verification; `workflows/execute-phase.md` already injects that field into execution; and the PRD/policy already define the layered-testing model. The missing piece is that the runtime contract is still partly heuristic and partly prose. Today `resolveVerificationRouting()` in `src/lib/decision-rules.js` still routes only by task/file counts, which does not match the locked risk policy for runtime, shared-state, plugin, or generated-artifact work.

The correct architecture is: choose or justify the route at planning time from **change type + blast radius**, carry that durable field into execution metadata, normalize required proof into a machine-readable shape, and let verifier/finalize/reporting consume that same normalized contract. This phase should not rely on free-form summary prose to infer whether proof is missing. Instead, it should make route expectations explicit enough that verifier output can say: behavior proof missing, regression proof not required, human verification not required.

Current SOTA for this repo is also narrower than older training-era habits: official Node docs confirm `node --test` supports explicit file lists, while `--test-name-pattern` filters test names but does **not** reduce which files are executed. That reinforces the repo's current execution guidance: prefer explicit targeted test files and direct smoke commands for `light`, and reserve one broad gate for `full` only when blast radius justifies it.

**Primary recommendation:** Replace the current size-based verification-routing heuristic with a policy-aligned route normalizer that records `{ verification_route, default_reason, downgrade_justification?, required_proof }` once, then reuse that exact structure in planner artifacts, executor proof reporting, and verifier bucket output.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | local `v25.8.2`, repo contract `>=18` | Runtime, `node:test`, proof normalization helpers | Already the repo runtime; official test runner is stable and sufficient for focused + broad proof orchestration |
| npm scripts | local `11.11.1` | Standard build/test entrypoints (`npm test`, `npm run test:file`, `npm run build`) | Existing repo contract; no new harness needed |
| `node:test` + `node:assert` | built-in | Focused behavior proof and smoke regression for `light`/`full` routes | Official, current, already used heavily in repo tests |
| Existing repo verification surfaces | current repo | Planner/executor/verifier contract carriage | `workflows/execute-phase.md`, templates, summaries, and verifier/report artifacts already form the policy path |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/decision-rules.js` | current repo | Route selection entrypoint | Replace simple size heuristic with change-classification + justification rules |
| `src/plugin/command-enricher.js` | current repo | Supplies routing inputs into workflow context | Extend when planner/runtime metadata needs richer route inputs than task/file counts |
| `templates/verification-report.md` | current repo | Canonical verifier bucket/report shape | Use for explicit required vs `not required` reporting |
| JJ CLI | local `0.39.0` | Runtime-hardening context | Relevant because workspace/shared-state/plugin changes are high-risk defaults in this milestone |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Explicit route normalizer | Keep free-form prose + verifier inference | Reject: too ambiguous to enforce `required` vs `not required` buckets honestly |
| Policy-driven classification | Keep task-count/files-count heuristic | Reject: conflicts with locked defaults for runtime/shared-state/plugin work |
| Existing Node test runner + repo scripts | New test framework or policy engine | Reject: milestone explicitly avoids new dependencies/frameworks |

## Architecture Patterns

### Recommended Project Structure
- Keep one canonical route decision source near `src/lib/decision-rules.js`.
- Carry the selected route into plan frontmatter/body, executor prompt/runtime metadata, proof summaries, and verifier reporting.
- Normalize proof expectations once in shared code; do not duplicate route semantics in each workflow/template.

### Pattern 1: Policy-first route selection
1. Start from change class, not plan size.
2. Apply locked defaults:
   - runtime/shared-state/plugin => default `full`
   - docs/workflows/templates/guidance => default `skip`
   - narrow code changes with bounded blast radius => default `light`
   - generated artifacts => derive from underlying source risk, not artifact existence alone
3. Allow elevation freely.
4. Require explicit written justification for downward overrides.

### Pattern 2: Durable route carriage
- Planner records `verification_route` and route rationale.
- Executor consumes the route and reports proof in the route's required buckets.
- Summary/proof metadata stores the same bucket names every time.
- Verifier renders the same bucket structure, marking exempt buckets `not required`.
- Final readiness/finalize eligibility should consume normalized proof status, not prose inference.

### Pattern 3: Proof-bundle normalization
Use one normalized contract such as:

```js
{
  verification_route: 'light',
  required_proof: {
    behavior: 'required',
    regression: 'smoke',
    human: 'not-required'
  },
  route_reason: 'narrow command-surface change with bounded blast radius'
}
```

This lets all downstream surfaces distinguish:
- missing required proof
- optional/exempt proof
- human proof that is actually required

### Pattern 4: Generated-artifact risk follows source risk
- Rebuild touched generated artifacts for trustworthy proof.
- Classify route from the touched source semantics and blast radius.
- If planner keeps artifact-impacting work below `full`, require a written low-risk rationale.

### Anti-Patterns to Avoid
- Using task count or file count as the primary routing rule.
- Treating `light` as “anything short of full” without naming the exact touched behavior.
- Collapsing verifier output into one generic “verification missing” bucket.
- Treating `--test-name-pattern` as a substitute for explicit targeted test-file selection.
- Auto-escalating every generated-artifact change to `full`.
- Hiding route exemptions by omitting buckets instead of marking them `not required`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route vocabulary | New route names or parallel taxonomy | Existing `skip` / `light` / `full` contract | Locked by context and milestone non-goals |
| Test harness | New framework/policy engine | `node:test`, `npm test`, `npm run test:file`, direct smoke commands | Existing repo tooling already matches the required proof shapes |
| Proof interpretation | Per-workflow ad hoc prose parsing | Shared normalized proof buckets | Needed for verifier clarity and finalize/readiness checks |
| Generated-artifact policy | Blanket “artifact touched => full” rule | Source-risk + blast-radius classification with explicit rationale | Matches stress-tested decision and avoids unnecessary broad gates |
| Regression targeting | Name-pattern filtering as file selection | Explicit test-file lists or explicit smoke commands | Node docs say name patterns do not change which files are executed |

## Common Pitfalls

### Pitfall 1: Heuristic routing by size instead of risk
**What goes wrong:** Small but high-risk runtime or plugin changes get routed too lightly, while larger low-risk docs/guidance work gets over-tested.
**Why it happens:** Current repo heuristic in `resolveVerificationRouting()` keys off task/file counts.
**How to avoid:** Route by change class and blast radius first; use size only as a secondary tie-breaker if needed.
**Warning signs:** `plugin.js`, planner/executor/verifier semantics, or shared-state changes showing `light` only because a plan touched few files.

### Pitfall 2: `light` becomes vague and loophole-like
**What goes wrong:** Executors attach any nearby test run and call `light` satisfied.
**Why it happens:** Focused proof is described narratively instead of tied to named touched behavior.
**How to avoid:** Require `light` evidence to name the touched behavior/risk explicitly and prove it with a focused test or smoke command plus smoke regression.
**Warning signs:** Proof says “targeted tests passed” without naming the behavior, file family, command surface, or risk.

### Pitfall 3: Verifier conflates omission with exemption
**What goes wrong:** `skip` or `light` plans look like failures because regression or human-proof fields appear missing rather than intentionally exempt.
**Why it happens:** Reporting lacks explicit bucket status.
**How to avoid:** Always render behavior/regression/human buckets and mark route-exempt ones `not required`.
**Warning signs:** Users cannot tell whether proof is missing or intentionally unnecessary.

### Pitfall 4: Generated artifacts are classified by file presence, not source risk
**What goes wrong:** Every `plugin.js` or `bin/bgsd-tools.cjs` touch is forced to `full`, or risky shared-runtime changes are under-classified as narrow rebuilds.
**Why it happens:** Artifact files are scary, so teams overfit the rule in both directions.
**How to avoid:** Rebuild always when touched, but classify route from the underlying source semantics and blast radius; require written rationale when below `full`.
**Warning signs:** Planner rationale says only “artifact touched” or only “artifact rebuilt” without discussing shared behavior impact.

### Pitfall 5: Misusing `--test-name-pattern`
**What goes wrong:** A supposedly focused `light` run still loads the broad suite's files.
**Why it happens:** Node's name filtering looks targeted, but it filters tests inside the selected file set rather than reducing file discovery.
**How to avoid:** Prefer explicit `node --test <file>...` lists or direct smoke commands for focused proof.
**Warning signs:** Slow or flaky “targeted” runs still traverse unrelated test files.

## Code Examples

Verified patterns from official sources and live repo.

### Example 1: Current execution contract already injects route semantics
```md
Verification route: {verification_route}. Apply it as: `skip` = no extra broad-suite reruns beyond explicit plan checks, `light` = focused verification only, `full` = one broad regression gate at plan end or overall verification, never per edit.
```

Source: `workflows/execute-phase.md`

### Example 2: Current heuristic that should be replaced
```js
function resolveVerificationRouting(state) {
  const { task_count = 0, files_modified_count = 0, verifier_enabled = true } = state || {};

  if (!verifier_enabled) return { value: 'skip', confidence: 'HIGH', rule_id: 'verification-routing' };
  if (task_count <= 2 && files_modified_count <= 4) {
    return { value: 'light', confidence: 'HIGH', rule_id: 'verification-routing' };
  }
  return { value: 'full', confidence: 'HIGH', rule_id: 'verification-routing' };
}
```

Source: `src/lib/decision-rules.js`

### Example 3: Official targeted Node test-file execution
```bash
node --test tests/decisions.test.cjs tests/enricher-decisions.test.cjs
```

### Example 4: Explicit proof-bucket normalization shape
```js
const proofStatus = {
  verification_route: 'skip',
  behavior_proof: 'not-required',
  regression_proof: 'not-required',
  human_verification: 'not-required',
  structural_proof: 'passed'
};
```

Use a variant of this normalized shape so verifier/reporting can distinguish omission from exemption.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Broad suite reruns by habit or blanket “all tests” phrasing | Risk-routed targeted proof with one broad gate only when blast radius justifies it | Current milestone PRD/policy direction | Reduces redundant proof cost without weakening high-risk runtime checks |
| Route inference from plan size | Route selection from change class + blast radius + explicit rationale | Needed now for v19.0 hardening | Makes runtime/shared-state/plugin defaults enforceable |
| Verifier treats absent buckets as generic missing proof | Verifier shows behavior/regression/human buckets with `not required` where exempt | Stress-tested phase decision | Makes required vs optional proof obvious |
| `--test-name-pattern` used as “focused enough” targeting | Explicit file lists and direct smoke commands for focused proof | Confirmed by current Node docs | Prevents accidentally loading unrelated test files during `light` proof |

## Open Questions

1. What is the smallest shared proof-status schema that planner, executor summary, finalize/readiness checks, and verifier can all consume without backward-compatibility breakage?
2. Should downgrade justifications live in plan frontmatter, plan body, or normalized proof metadata as well as prose?
3. Does finalize/readiness need route-aware gating in this phase, or is durable route carriage plus verifier clarity sufficient for the first slice?

## Sources

### Primary (HIGH confidence)
- `.planning/phases/182-risk-routed-hardening-proof-policy/182-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/MILESTONE-INTENT.md`
- `.planning/resources/RISK-BASED-TESTING-PRD.md`
- `.planning/resources/RISK-BASED-TESTING-POLICY.md`
- `.planning/research/ARCHITECTURE.md`
- `workflows/execute-phase.md`
- `src/lib/decision-rules.js`
- `src/plugin/command-enricher.js`
- `templates/verification-report.md`
- Node docs via Context7 `/nodejs/node` and official docs:
  - https://nodejs.org/api/test.html
  - https://nodejs.org/api/cli.html

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md`
- Jujutsu working-copy/workspace docs: https://docs.jj-vcs.dev/latest/working-copy/
- cmux API docs: https://www.cmux.dev/docs/api
- ISTQB glossary entry for risk-based testing: https://glossary.istqb.org/en_US/term/risk-based-testing

### Tertiary (LOW confidence)
- Brave web search ecosystem results for current risk-based testing guidance and community framing

## Metadata

**Confidence breakdown:** HIGH for locked route contract, current repo gaps, Node targeted-test behavior, and the need to replace size-based routing with policy-first classification. MEDIUM for broader ecosystem framing around risk-based testing because those sources are useful but not repo-authoritative.

**Research date:** 2026-04-01
**Valid until:** Revalidate when the route schema lands, verifier report shape changes, or Node test-runner targeting semantics materially change.
