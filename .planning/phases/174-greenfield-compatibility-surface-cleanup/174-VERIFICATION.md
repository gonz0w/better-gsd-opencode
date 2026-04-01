---
phase: 174-greenfield-compatibility-surface-cleanup
verified: 2026-04-01T02:06:29.433Z
status: gaps_found
score: 10/12
intent_alignment: partial
requirements_coverage: partial
gaps:
  - id: GAP-174-RV-01
    severity: blocker
    requirement: CLEAN-03
    type: truth
    summary: Shipped workflow guidance still fails command-integrity validation because `workflows/plan-phase.md` and `workflows/discuss-phase.md` contain surfaced fallback examples that are not canonical-safe.
    evidence:
      - workflows/plan-phase.md:17
      - workflows/plan-phase.md:22
      - workflows/discuss-phase.md:53
      - workflows/discuss-phase.md:67
      - tests/validate-commands.test.cjs:420
  - id: GAP-174-RV-02
    severity: warning
    requirement: CLEAN-03
    type: regression
    summary: The focused command-integrity regression slice is still red because legacy planning alias classification no longer reports `/bgsd-plan-phase 159` as legacy surfaced guidance.
    evidence:
      - tests/validate-commands.test.cjs:38
      - src/lib/commandDiscovery.js:1051
      - src/lib/commandDiscovery.js:1063
---

# Phase 174 Verification

## Intent Alignment

**Verdict:** partial

The core cleanup intent mostly landed: migration-only command drag is removed, canonical planning artifacts still parse without the old plugin normalization helper surface, hidden NL fallback mappings were cleaned up, and workspace-first docs/templates are in place. But the phase still falls short of full alignment because shipped workflow guidance in `workflows/plan-phase.md` and `workflows/discuss-phase.md` does not yet pass the canonical command-integrity gate, so the repo does not completely present one clean greenfield support story end-to-end.

## Goal Achievement

| Truth | Status | Evidence |
|---|---|---|
| Migration-only commands/helpers for obsolete installs or upgrades are removed without leaving routed dead surfaces behind. | ✓ VERIFIED | `node bin/bgsd-tools.cjs util:config-migrate` returns `Unknown util subcommand`; `src/router.js`; `src/lib/constants.js`; `tests/validate-commands.test.cjs:333-364`. |
| Active memory/init flows no longer auto-import legacy JSON memory stores. | ✓ VERIFIED | `src/commands/memory.js:497-529` keeps canonical SQL-first reads; `node bin/bgsd-tools.cjs util:memory read --store decisions --query Legacy` returned `{ count: 0, source: "sql" }`. |
| Canonical `.planning/` files still parse and validate without legacy normalization paths for superseded planning/config shapes. | ✓ VERIFIED | `node --test tests/plugin.test.cjs --test-name-pattern "parseRoadmap|normalization|canonical roadmap"` passed the targeted parser assertions before the broad suite timeout; `src/plugin/parsers/roadmap.js` no longer contains the old helper names. |
| The plugin roadmap parser no longer ships dead legacy TDD normalization helpers behind canonical behavior. | ✓ VERIFIED | `src/plugin/parsers/roadmap.js` contains only the canonical parse path; `verify:verify artifacts` and `verify:verify key-links` both passed for `174-06-PLAN.md`. |
| Touched NL and fallback helpers point only at supported canonical command routes instead of unsupported internal command names. | ✓ VERIFIED | `src/lib/nl/command-registry.js`; `src/lib/nl/help-fallback.js`; no matches for `execute:phase|execute:quick|verify:work|session:resume|session:pause|verify:phase|session:progress|roadmap:show|milestone:new`; `verify:verify key-links` passed for `174-07-PLAN.md`. |
| Docs and templates teach the supported JJ/workspace-first model instead of stale worktree-era guidance. | ✓ VERIFIED | `templates/config-full.json:51-54` uses `workspace`; no `config-migrate` matches in `src/**/*.js`; `docs/commands.md` and `docs/workflows.md` now teach canonical slash-command families. |
| Surfaced docs and workflow guidance used by command-integrity validation match the canonical CLI and planning-family surface. | ✗ FAILED | `validateCommandIntegrity` still reports `missing-argument` and `nonexistent-command` issues in `workflows/plan-phase.md` and `workflows/discuss-phase.md`; focused test `tests/validate-commands.test.cjs:420-455` fails. |
| Regression coverage protects against reintroducing removed compatibility surfaces. | ✗ FAILED | Focused slice `node --test tests/validate-commands.test.cjs --test-name-pattern "stale registry commands|fallback surfaces|canonical command guidance|Phase 174"` is red, including `tests/validate-commands.test.cjs:38-76` and `:420-455`. |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Notes |
|---|---|---|---|---|
| `src/plugin/parsers/roadmap.js` | ✓ | ✓ | ✓ | Dead normalization helper surface removed; targeted plugin assertions pass. |
| `tests/plugin.test.cjs` | ✓ | ✓ | ✓ | Contains explicit `parseRoadmap` and normalization-regression checks. |
| `src/lib/nl/command-registry.js` | ✓ | ✓ | ✓ | Hidden mappings now point at canonical routed commands only. |
| `src/lib/nl/help-fallback.js` | ✓ | ✓ | ✓ | Fallback suggestions no longer preserve the stale internal command names from the prior verification gaps. |
| `docs/commands.md` | ✓ | ✓ | ✓ | Canonical command reference is aligned. |
| `docs/workflows.md` | ✓ | ✓ | ✓ | Canonical workflow-family reference is aligned. |
| `workflows/plan-phase.md` | ✓ | ✗ | PARTIAL | Still contains surfaced fallback examples that the validator treats as non-canonical guidance (`/bgsd-plan phase` without args and `init:plan-phase`). |
| `workflows/discuss-phase.md` | ✓ | ✗ | PARTIAL | Same remaining issue pattern as `plan-phase.md` (`/bgsd-plan discuss` without args and `init:phase-op`). |
| `tests/validate-commands.test.cjs` | ✓ | ✓ | ✓ | Coverage exists, but the focused slice is currently red, so regression proof is incomplete. |

## Key Link Verification

| Link | Status | Evidence |
|---|---|---|
| `tests/plugin.test.cjs` → `src/plugin/parsers/roadmap.js` | WIRED | `verify:verify key-links` passed for `174-06-PLAN.md`; targeted parser tests exercise `parseRoadmap` normalization behavior. |
| `tests/validate-commands.test.cjs` → `src/lib/nl/help-fallback.js` | WIRED | `verify:verify key-links` passed for `174-07-PLAN.md`. |
| `tests/validate-commands.test.cjs` → `docs/commands.md` | WIRED | `verify:verify key-links` passed for `174-07-PLAN.md`. |
| `tests/validate-commands.test.cjs` → `workflows/plan-phase.md` | PARTIAL | The test targets this surface, but the current assertion remains red because the surfaced fallback guidance is still being flagged. |
| `tests/validate-commands.test.cjs` → `workflows/discuss-phase.md` | PARTIAL | Same as above; the workflow remains in the validation failure set. |

## Requirement Coverage

| Requirement | Verdict | Evidence |
|---|---|---|
| CLEAN-01 | covered | `util:config-migrate` is gone from the routed surface; legacy memory reads stay on the canonical store. |
| CLEAN-02 | covered | Canonical roadmap parsing works without the old plugin normalization helper surface; plan 06 artifact and key-link checks passed. |
| CLEAN-03 | partial | Docs/templates and hidden NL mappings are aligned, but surfaced workflow guidance and the command-integrity regression slice are still not fully green. |

**Overall requirement coverage verdict:** partial

## Anti-Patterns Found

| Severity | Finding | Evidence |
|---|---|---|
| 🛑 Blocker | Two shipped workflow files still contain fallback command examples that fail canonical command-integrity validation. | `workflows/plan-phase.md:17-23`; `workflows/discuss-phase.md:53-68`; `tests/validate-commands.test.cjs:420-455` |
| ⚠️ Warning | The focused command-integrity regression slice is still red because legacy alias classification no longer reports `/bgsd-plan-phase 159` the way the test expects. | `tests/validate-commands.test.cjs:38-76`; `src/lib/commandDiscovery.js:1051-1073` |
| ⚠️ Warning | `verify:verify artifacts` for `174-07-PLAN.md` crashed in the bundled runtime because `writeDebugDiagnostic` is undefined on a cache-warm path. | `/Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs`; `ReferenceError: writeDebugDiagnostic is not defined` |

## Human Verification Required

None. The remaining issues are directly observable in repository source and focused test output.

## Gaps Summary

This re-verification confirms that the earlier blocker gaps on the plugin roadmap parser and hidden NL compatibility mappings are closed. Phase 174 now clearly removes `util:config-migrate`, keeps legacy memory data off active canonical paths, preserves canonical `.planning/` parsing without the old rewrite-on-read helper surface, and aligns the main docs/template slice with the workspace-first model.

The phase still does not fully achieve its goal because one part of the shipped command/help surface remains inconsistent: `workflows/plan-phase.md` and `workflows/discuss-phase.md` still fail command-integrity validation, and the focused regression suite is not green. Until those workflow fallback examples are made canonical-safe and the regression slice passes, the repo does not yet fully reflect one clean greenfield support model end-to-end.
