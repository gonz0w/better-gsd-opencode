# Phase 187: Reconstruct Phase 182 Verification Coverage - Research

**Researched:** 2026-04-02
**Domain:** phase-verification reconstruction, workflow contract regression repair, and requirement cross-reference recovery
**Confidence:** HIGH

## User Constraints

<user_constraints>
- Keep scope on milestone acceptance recovery for the Phase 182 verification-routing slice. Do not reopen the Phase 182 feature design unless current proof shows the implementation contract is actually broken.
- Honor the effective intent priorities: prove JJ workspace truth, preserve single-writer shared planning artifacts, keep cmux truthful, and carry `verification_route` through planning, execution, proof, and verification.
- Treat the milestone audit as the gap source, not as proof by itself. Planning must restore the missing three-source cross-reference for `TEST-01` through `TEST-04` and remove the one live workflow wording regression.
- Use `jj_planning_context` only as advisory capability context. Do not plan around live workspace inventory or sibling auto-routing.
- If explicit overlap evidence is absent, ignore safe-sibling routing preferences.
- No `.planning/ASSERTIONS.md` exists in this repo today, so there are no pre-existing assertions to reuse for `TEST-01` through `TEST-04`.
- The installed `verify:verify artifacts` and `verify:verify key-links` helpers are still untrustworthy because they crash with `ReferenceError: createPlanMetadataContext is not defined`; plan verification work around that tooling debt instead of depending on it.
- Preserve the locked workflow/report contract wording where tests assert exact phrases. This phase includes one current exact-phrase regression tied to rebuilt-runtime proof guidance.
</user_constraints>

## Phase Requirements

<phase_requirements>
- **TEST-01:** Planner and execution artifacts carry an explicit `verification_route` of `skip`, `light`, or `full` for implementation work.
- **TEST-02:** Runtime, shared-state, plugin, and generated-artifact changes in this milestone require focused proof plus broad regression when the blast radius is high.
- **TEST-03:** Docs-, workflow-, template-, and guidance-only slices can use structural or focused proof without defaulting to repeated broad-suite runs.
- **TEST-04:** Verifier output distinguishes missing behavior proof, missing regression proof, and missing human verification instead of conflating them.
</phase_requirements>

## Summary

Phase 187 is a gap-closure phase, not a fresh implementation phase. The repo already contains the Phase 182 behavior surfaces the earlier plans claimed: `src/lib/decision-rules.js`, `src/plugin/command-enricher.js`, `src/commands/verify/quality.js`, `src/commands/scaffold.js`, `workflows/execute-phase.md`, `workflows/verify-work.md`, and `templates/verification-report.md` all now expose explicit `verification_route` handling or separated proof buckets. The current blocker is that milestone acceptance still cannot cross-reference those behaviors through a formal Phase 182 verification artifact, and one exact wording contract in `tests/workflow.test.cjs` is currently red.

Authoritative live proof confirms the audit is still accurate. `node --test tests/workflow.test.cjs` fails one test because `workflows/execute-phase.md` says `run \`npm run build\` before the first green runtime-backed proof, then rerun the focused proof...`, while the locked test still expects the exact wording `run \`npm run build\`, then rerun the focused proof`. The broader focused Phase 182 suite (`npm run build && node --test tests/decisions.test.cjs tests/enricher-decisions.test.cjs tests/verify.test.cjs tests/workflow.test.cjs`) is otherwise green except for that same workflow wording failure, which means planning should treat this as a narrow contract repair plus formal evidence reconstruction rather than a broad feature rewrite.

The planner should also account for an important verification-method constraint: neighboring milestone phases 181, 183, and 186 explicitly document that `verify:verify artifacts` and `verify:verify key-links` currently crash, so their verification had to be completed manually from source plus focused proof. Phase 187 should follow that same pattern. The deliverable is therefore twofold: repair the live wording regression, then produce a Phase 182 verification report that manually traces requirement coverage, artifacts, key links, live commands, and requirement cross-references strongly enough for a follow-up milestone audit to mark `TEST-01` through `TEST-04` satisfied.

**Primary recommendation:** Plan this as two small slices: first restore the exact rebuilt-runtime workflow wording contract, then author a source-backed `182-VERIFICATION.md` with focused proof and explicit requirement/evidence mapping for all four TEST requirements.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | local runtime via repo toolchain | Run authoritative `node --test` proof commands | Existing repo standard for workflow and contract verification |
| npm | repo toolchain | Rebuild generated runtime artifacts before runtime-backed proof | Existing repo standard; required by the locked rebuilt-runtime contract |
| Existing phase verification format | current repo | Canonical structure for `*-VERIFICATION.md` evidence | Neighbor phases 181, 183, 186 already show the expected verification style |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tests/workflow.test.cjs` | current repo | Exact workflow contract gate | Use to prove the Phase 165 wording regression is repaired |
| `tests/decisions.test.cjs` + `tests/enricher-decisions.test.cjs` + `tests/verify.test.cjs` | current repo | Focused proof for Phase 182 verification-route behavior | Use as the smallest authoritative automated evidence set for TEST coverage |
| `workflows/execute-phase.md` / `workflows/verify-work.md` / `templates/verification-report.md` | current repo | Human-readable workflow/report contract source of truth | Use for wording verification and requirement mapping |
| `.planning/v19.0-MILESTONE-AUDIT.md` | current repo | Gap source and acceptance target | Use to ensure the reconstructed evidence closes the exact blockers the audit named |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reconstructing formal verification | Mark requirements complete from summaries only | Reject: the audit explicitly requires three-source cross-reference, and summaries alone already failed that gate |
| Manual source plus focused-proof verification | `verify:verify artifacts` / `verify:verify key-links` helpers | Reject for this phase because those helpers are currently crashing in neighboring milestone verification runs |
| Small gap-closure slices | Re-implement Phase 182 behavior broadly | Reject unless new contradictory proof appears; current evidence points to missing verification evidence plus one wording regression, not missing functionality |

## Architecture Patterns

### Recommended Project Structure
- Keep implementation repair scoped to the exact workflow file and test contract that disagree.
- Keep verification reconstruction in the existing Phase 182 directory as `182-VERIFICATION.md` rather than inventing a Phase 187-owned verification format.
- Use the milestone audit, Phase 182 plans, Phase 182 summaries, live source files, and live proof commands together to build the requirement cross-reference chain.

### Pattern 1: Audit-driven gap closure
1. Start from the specific blocker claims in `v19.0-MILESTONE-AUDIT.md`.
2. Re-run the smallest authoritative proof commands.
3. Compare live results against the audit claims.
4. Repair only the real delta.
5. Write verification evidence that closes the exact requirement and integration gaps the audit named.

### Pattern 2: Three-source requirement reconstruction
For each of `TEST-01` through `TEST-04`, show all three:
- planning traceability: Phase 182 plans/frontmatter
- implementation or workflow/report source evidence
- verification evidence: focused proof and explicit Phase 182 verification write-up

### Pattern 3: Manual artifact and key-link verification
- Reuse the neighboring milestone verification style.
- Inspect real source wiring directly when helper commands are broken.
- Record the tooling failure as non-blocking verification debt, not as a reason to skip evidence.

### Anti-Patterns to Avoid
- Reopening Phase 182 policy design without proof of broken behavior.
- Treating the audit file as sufficient verification evidence by itself.
- Writing a thin `182-VERIFICATION.md` that repeats summary claims without live proof commands and source references.
- Depending on currently broken artifact/key-link helper commands as a critical plan dependency.
- Mixing the wording regression repair into a large workflow refactor that risks new contract drift.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| New verification format | Custom Phase 187 report structure | Existing phase verification style from phases 181, 183, and 186 | Keeps audit consumption predictable |
| Broad new test harness | New verification tooling | Existing focused `node --test` files plus `npm run build` | Smallest authoritative live proof already exists |
| Heuristic requirement closure | Summary-only interpretation | Explicit three-source requirement mapping in `182-VERIFICATION.md` | Needed to satisfy milestone audit rules |

## Common Pitfalls

### Pitfall 1: Fixing only the red test and forgetting the missing verification artifact
**What goes wrong:** `tests/workflow.test.cjs` turns green, but the milestone audit still blocks on absent Phase 182 verification coverage.
**Why it happens:** The workflow failure is loud while the missing verification report is a planning/documentation gap.
**How to avoid:** Treat the wording repair as one slice and the verification reconstruction as a separate required slice.
**Warning signs:** Phase 187 plan stops after the workflow test passes without creating `182-VERIFICATION.md`.

### Pitfall 2: Writing a verification report that does not actually satisfy the audit's three-source rule
**What goes wrong:** `182-VERIFICATION.md` exists, but it does not clearly map each TEST requirement through plan claim, source evidence, and proof command.
**Why it happens:** Verifiers often summarize phase behavior globally instead of tracing each requirement explicitly.
**How to avoid:** Include a requirement coverage table with per-requirement evidence and call out the exact focused commands used.
**Warning signs:** The report says "Phase 182 is covered" without separate rows for `TEST-01` through `TEST-04`.

### Pitfall 3: Relying on broken helper commands
**What goes wrong:** Verification work blocks on `verify:verify artifacts` or `verify:verify key-links` crashing.
**Why it happens:** Those commands look canonical, but neighboring milestone phases already documented the runtime crash.
**How to avoid:** Plan manual artifact/key-link review from source plus focused proof as the primary method for this phase.
**Warning signs:** The plan assumes helper-command output must exist before verification can complete.

### Pitfall 4: Over-broad workflow edits create new drift
**What goes wrong:** Repairing the exact rebuilt-runtime wording test accidentally changes other locked workflow language.
**Why it happens:** The failing contract lives inside a large workflow file with many other exact-phrase assertions.
**How to avoid:** Make the smallest wording change that restores the locked phrase and rerun the full workflow contract file.
**Warning signs:** Multiple unrelated `tests/workflow.test.cjs` assertions start failing after the edit.

## Recommended Planning Slices

### Slice 1: Restore the rebuilt-runtime wording contract
- Files: `workflows/execute-phase.md`, `tests/workflow.test.cjs` only if evidence proves the contract intentionally changed; otherwise prefer workflow-only repair.
- Verify with: `node --test tests/workflow.test.cjs`.
- Outcome: the live blocker named in the audit is gone.

### Slice 2: Reconstruct formal Phase 182 verification coverage
- Files: `.planning/phases/182-risk-routed-hardening-proof-policy/182-VERIFICATION.md` and, only if needed for audit traceability, adjacent planning artifacts such as `REQUIREMENTS.md` if requirement status must be advanced during the same slice.
- Evidence set should include:
  - `npm run build`
  - `node --test tests/decisions.test.cjs tests/enricher-decisions.test.cjs tests/verify.test.cjs tests/workflow.test.cjs`
  - direct source references across Phase 182-owned implementation, workflow, and template/report surfaces
  - explicit note that artifact/key-link helpers were manually substituted due to known crash
- Outcome: a follow-up audit can cross-reference plan claim, implementation/report surface, and verification evidence for each TEST requirement.

### Slice 3: Optional milestone audit refresh
- Only if the phase plan wants a closing proof loop in-scope.
- Re-run or update the milestone audit after the above slices to prove the blocker is actually closed.
- This is useful but should stay last, since it depends on both the wording repair and reconstructed Phase 182 verification artifact.

## Code Examples

Verified live repo patterns.

### Example 1: Current exact wording mismatch driving the red test
```md
When changed deliverables include generated runtime artifacts (for example `plugin.js` or `bin/bgsd-tools.cjs`), verify against the repo-local current checkout plus the rebuilt local runtime in this repo. Never trust stale generated artifacts: run `npm run build` before the first green runtime-backed proof, then rerun the focused proof against the rebuilt local runtime before reporting success.
```

Source: `workflows/execute-phase.md`

### Example 2: Locked test expectation still requiring the older phrase
```js
assert.match(execute, /run `npm run build`, then rerun the focused proof/i);
```

Source: `tests/workflow.test.cjs`

### Example 3: Existing route-aware workflow contract that Phase 182 verification should prove
```md
Verification route: {verification_route}. Apply it as: `skip` = structural proof only, `light` = named focused proof plus smoke regression, `full` = named focused proof plus one broad regression gate at plan end or overall verification.
```

Source: `workflows/execute-phase.md`

### Example 4: Existing verifier bucket separation that should be cited in verification evidence
```md
### Behavior Proof
**Status:** {provided | missing | not required}

### Regression Proof
**Status:** {provided | missing | not required}

### Human Verification
**Status:** {provided | missing | not required}
```

Source: `templates/verification-report.md`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase summaries implied requirement closure | Milestone audit requires plan + summary/source + verification cross-reference | Current v19.0 audit rules | Missing verification artifacts are now milestone blockers |
| Helper commands could be assumed for artifact/link checks | Neighboring milestone phases manually verified artifacts/links because helpers crash | Verified in phases 181, 183, 186 | This phase should not block on helper repair |
| Phase 182 was treated as complete from prior summaries | Phase 182 is now explicitly incomplete for acceptance until formal verification evidence exists | Phase 187 roadmap addition | Planning must target acceptance recovery, not implementation novelty |

## Open Questions

1. Should Phase 187 also update `.planning/REQUIREMENTS.md` from pending to complete for `TEST-01` through `TEST-04`, or is that expected to happen only through the normal finalize flow after verification lands?
2. Does the follow-up phase plan want the milestone audit refresh in-scope, or is producing the evidence sufficient and the audit rerun happens immediately after?

No unresolved high-impact product or technical ambiguity remains about the core work: the blockers are explicit, reproducible, and narrowly scoped.

## Sources

### Primary (HIGH confidence)
- `/Users/cam/DEV/bgsd-oc/.planning/ROADMAP.md`
- `/Users/cam/DEV/bgsd-oc/.planning/REQUIREMENTS.md`
- `/Users/cam/DEV/bgsd-oc/.planning/v19.0-MILESTONE-AUDIT.md`
- `/Users/cam/DEV/bgsd-oc/.planning/phases/182-risk-routed-hardening-proof-policy/182-01-PLAN.md`
- `/Users/cam/DEV/bgsd-oc/.planning/phases/182-risk-routed-hardening-proof-policy/182-02-PLAN.md`
- `/Users/cam/DEV/bgsd-oc/.planning/phases/182-risk-routed-hardening-proof-policy/182-01-SUMMARY.md`
- `/Users/cam/DEV/bgsd-oc/.planning/phases/182-risk-routed-hardening-proof-policy/182-02-SUMMARY.md`
- `/Users/cam/DEV/bgsd-oc/.planning/phases/181-workspace-root-truth-safe-fallback/181-VERIFICATION.md`
- `/Users/cam/DEV/bgsd-oc/.planning/phases/183-plan-local-workspace-ownership/183-VERIFICATION.md`
- `/Users/cam/DEV/bgsd-oc/.planning/phases/186-cmux-truthful-lifecycle-signals/186-VERIFICATION.md`
- `/Users/cam/DEV/bgsd-oc/workflows/execute-phase.md`
- `/Users/cam/DEV/bgsd-oc/workflows/verify-work.md`
- `/Users/cam/DEV/bgsd-oc/templates/verification-report.md`
- `/Users/cam/DEV/bgsd-oc/tests/workflow.test.cjs`
- Live proof commands run in this research pass:
  - `node --test tests/workflow.test.cjs`
  - `npm run build && node --test tests/decisions.test.cjs tests/enricher-decisions.test.cjs tests/verify.test.cjs tests/workflow.test.cjs`

### Secondary (MEDIUM confidence)
- `/Users/cam/DEV/bgsd-oc/.planning/phases/182-risk-routed-hardening-proof-policy/182-RESEARCH.md`
- `/Users/cam/DEV/bgsd-oc/.planning/STATE.md`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:** HIGH for blocker identification, live regression reproduction, and verification-method constraints; MEDIUM for finalize-status assumptions around when REQUIREMENTS.md should be advanced.
**Research date:** 2026-04-02
**Valid until:** Until Phase 187 planning or implementation changes the blocker set.
