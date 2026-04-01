---
phase: 174-greenfield-compatibility-surface-cleanup
verified: 2026-03-31T23:59:00Z
status: gaps_found
score: 11/12
intent_alignment: misaligned
requirements_coverage: partial
gaps:
  - id: GAP-174-RV-03
    severity: blocker
    requirement: CLEAN-03
    type: truth
    summary: Shipped command-integrity behavior still flags the phase-owned planning workflows as invalid surfaced guidance, so the repo does not yet present one fully aligned greenfield support surface end-to-end.
    evidence:
      - workflows/plan-phase.md:17
      - workflows/plan-phase.md:22
      - workflows/discuss-phase.md:53
      - workflows/discuss-phase.md:67
      - node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs util:validate-commands --raw
---

# Phase 174 Verification

## Intent Alignment

**Verdict:** misaligned

Phase 174's rebuild fixed the bundled artifact-verification helper, but the core expected user change still has not fully landed: shipped command-integrity validation continues to flag `workflows/plan-phase.md` and `workflows/discuss-phase.md` as invalid surfaced guidance. Because those phase-local workflow surfaces are still not cleanly aligned with the intended greenfield/JJ workspace-first support model in the shipped runtime, the phase remains misaligned.

## Goal Achievement

| Truth | Status | Evidence |
|---|---|---|
| Migration-only commands/helpers for obsolete installs or upgrades are removed without leaving routed dead surfaces behind. | ✓ VERIFIED | `src/**/*.js` contains no `config-migrate` matches; focused validation tests still pass, including `config-migrate is absent from discovery inventory and canonical config docs`. |
| Active memory/init flows no longer auto-import legacy JSON memory stores. | ✓ VERIFIED | `src/commands/memory.js:497-509` keeps the active read path on SQLite-backed canonical stores with `source = 'sql'`. |
| Canonical `.planning/` files still parse and validate without legacy normalization paths for superseded planning/config shapes. | ✓ VERIFIED | `src/plugin/parsers/roadmap.js:5-15` retains only `normalizeTddHintValue`; no broader legacy rewrite-on-read normalization helper remains in this parser. |
| The final Phase 174 command-integrity source changes distinguish internal workflow fallback reconstruction from surfaced runnable guidance. | ✓ VERIFIED | `src/lib/commandDiscovery.js:933-954` contains the fallback-reconstruction guard; focused test `tests/validate-commands.test.cjs:425-468` passes. |
| Removed planning aliases such as `/bgsd-plan-phase` are treated as legacy surfaced guidance instead of generic unknown commands. | ✓ VERIFIED | `src/lib/commandDiscovery.js:919-925` defines legacy planning aliases; focused validation tests pass. |
| Docs/templates teach the supported JJ/workspace-first model on the touched canonical surfaces. | ✓ VERIFIED | `templates/config-full.json:51-54`, `docs/configuration.md:81-84`, and `docs/expert-guide.md:579-590` all teach the supported workspace/JJ model. |
| Shipped command-integrity validation now accepts the cleaned planning workflow guidance and exposes one canonical surfaced model. | ✗ FAILED | `node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs util:validate-commands --raw` still reports `missing-argument` and `nonexistent-command` issues for `workflows/plan-phase.md` and `workflows/discuss-phase.md`. |
| Shipped verifier tooling can consume the phase's artifact metadata without crashing. | ✓ VERIFIED | `node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs verify:verify artifacts .planning/phases/174-greenfield-compatibility-surface-cleanup/174-08-PLAN.md` now returns `status: present` and `all_passed: true`. |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Notes |
|---|---|---|---|---|
| `src/lib/commandDiscovery.js` | ✓ | ✓ | ✓ | Contains legacy-alias handling and workflow-fallback-context detection. |
| `tests/validate-commands.test.cjs` | ✓ | ✓ | ✓ | Focused regression slice covers legacy alias classification and the Phase 174 workflow-guidance boundary. |
| `workflows/plan-phase.md` | ✓ | ✓ | PARTIAL | Source guidance is present and covered by focused tests, but shipped broad validation still flags it. |
| `workflows/discuss-phase.md` | ✓ | ✓ | PARTIAL | Same remaining shipped-validation gap as `plan-phase.md`. |

## Key Link Verification

| Link | Status | Evidence |
|---|---|---|
| `tests/validate-commands.test.cjs` → `src/lib/commandDiscovery.js` | WIRED | `verify:verify key-links` for `174-08-PLAN.md` returned `verified: true`. |
| `tests/validate-commands.test.cjs` → `workflows/plan-phase.md` | WIRED | `verify:verify key-links` for `174-08-PLAN.md` returned `verified: true`. |
| `tests/validate-commands.test.cjs` → `workflows/discuss-phase.md` | WIRED | `verify:verify key-links` for `174-08-PLAN.md` returned `verified: true`. |

## Requirement Coverage

| Requirement | Verdict | Evidence |
|---|---|---|
| CLEAN-01 | covered | Migration-only command surface cleanup remains real: no `config-migrate` source references remain and focused validation coverage stays green. |
| CLEAN-02 | covered | Canonical roadmap parsing remains intact without broad legacy rewrite-on-read normalization (`src/plugin/parsers/roadmap.js:5-15`). |
| CLEAN-03 | partial | The rebuilt bundle fixed artifact verification, but shipped command-integrity validation still flags the two phase-owned planning workflows, so the cleaned surfaced guidance is not yet fully aligned end-to-end. |

**Overall requirement coverage verdict:** partial

All phase requirement IDs from phase context (`CLEAN-01`, `CLEAN-02`, `CLEAN-03`) are present in `.planning/REQUIREMENTS.md:20-22`; no orphaned requirement IDs were found.

## Anti-Patterns Found

| Severity | Finding | Evidence |
|---|---|---|
| 🛑 Blocker | Source and shipped runtime behavior still diverge on the final command-integrity cleanup for the two phase-owned workflows. | Focused test pass in `tests/validate-commands.test.cjs:425-468` versus bundled `util:validate-commands --raw` failures for `workflows/plan-phase.md` and `workflows/discuss-phase.md`. |
| ℹ️ Info | Broad surfaced-command drift still exists elsewhere in the repo, but those additional files are outside this phase-local gap accounting. | `util:validate-commands --raw` also reports unrelated issues in other agents/docs/workflows. |

## Human Verification Required

None. The remaining phase-local failure is directly observable in repository source and shipped CLI output.

## Gaps Summary

Re-verification after the rebuild closes the prior bundled-helper instability gap: the shipped `verify:verify artifacts` helper now passes for `174-08-PLAN.md`, and the plan's artifact and key-link metadata verify cleanly.

Phase 174 still does **not** fully achieve its goal because the shipped runtime continues to treat `workflows/plan-phase.md` and `workflows/discuss-phase.md` as invalid surfaced guidance in broad command-integrity validation. Until those phase-local workflow surfaces validate cleanly in the shipped runtime, maintainers still do not have one fully aligned greenfield-only support model across the planning artifacts this phase owns.
