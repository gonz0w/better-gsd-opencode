---
phase: 63-dead-code-removal
verified: 2026-03-07T03:57:13Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "All unreferenced workflow, template, and reference files are removed from the project"
    status: failed
    reason: "Phase 63 plans only addressed JS source files (exports, constants, config). DEAD-02 requirement covers workflow/template/reference .md files, which were never audited or cleaned."
    artifacts:
      - path: "workflows/complete-and-clear.md"
        issue: "Not referenced by any command, workflow, or agent"
      - path: "workflows/diagnose-issues.md"
        issue: "Referenced only by gsd-debugger agent description text, not as @path import"
      - path: "workflows/discovery-phase.md"
        issue: "Referenced by other workflows (help.md, resume-project.md, transition.md) but no command loads it"
      - path: "workflows/transition.md"
        issue: "Not referenced by any command or agent"
      - path: "workflows/verify-phase.md"
        issue: "Not referenced by any command, workflow, or agent. Contains @references/verification-patterns.md"
      - path: "templates/phase-prompt.md"
        issue: "Not referenced by any command or workflow"
      - path: "templates/user-setup.md"
        issue: "Not referenced by any command or workflow"
      - path: "templates/dependency-eval.md"
        issue: "Not referenced by any command or workflow"
      - path: "templates/planner-subagent-prompt.md"
        issue: "Not referenced by any command or workflow"
      - path: "references/decimal-phase-calculation.md"
        issue: "Not referenced by any command, workflow, or agent"
      - path: "references/git-planning-commit.md"
        issue: "Not referenced by any command, workflow, or agent"
      - path: "references/model-profiles.md"
        issue: "Not referenced by any command, workflow, or agent (model-profile-resolution.md IS referenced)"
      - path: "references/planning-config.md"
        issue: "Not referenced by any command, workflow, or agent"
      - path: "references/tdd-antipatterns.md"
        issue: "Not referenced by any command, workflow, or agent (tdd.md IS referenced via templates)"
    missing:
      - "Audit workflow/*.md files for cross-references from commands/*.md, agents/*.md, and other workflows"
      - "Audit templates/*.md files for cross-references from commands/*.md, workflows/*.md, and agents/*.md"
      - "Audit references/*.md files for cross-references from all other .md files"
      - "Remove confirmed dead files or document why they should be kept (e.g., loaded by agents at runtime)"
      - "Note: some 'unreferenced' files (discovery-phase.md, research-phase.md, diagnose-issues.md) are soft-referenced by agents — need careful evaluation before removal"
---

# Phase 63: Dead Code Removal Verification Report

**Phase Goal:** Remove all confirmed dead exports, unreferenced files, stale constants, and orphaned config — verified by test suite after each batch
**Verified:** 2026-03-07T03:57:13Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All unused function exports identified by audit are removed from src/ modules | ✓ VERIFIED | 21 lib/ exports verified removed, 22 commands/ exports verified removed, 9 test-referenced exports preserved, cross-module exports correctly preserved (branchInfo, trajectoryBranch, detectCliTools, etc.) |
| 2 | All unreferenced workflow, template, and reference files are removed from the project | ✗ FAILED | 6 unreferenced workflows, 4 unreferenced templates, ~5 unreferenced references remain. Plans never addressed DEAD-02 scope — focused exclusively on JS source exports. |
| 3 | constants.js has been audited and unused regex patterns, constants, and mappings are removed | ✓ VERIFIED | COMMAND_HELP reduced from 168→167 (stale `profile` entry removed). CONFIG_SCHEMA reduced from 26→22 (model_profiles, mcp_brave_enabled, mcp_context7_enabled, mcp_exa_enabled removed). |
| 4 | Stale config.json keys and agent manifest fields are cleaned up | ✓ VERIFIED | config.json verified clean. 4 dead CONFIG_SCHEMA keys removed. model_profile (singular, active) correctly preserved vs model_profiles (plural, dead). |
| 5 | All 762+ tests still pass after removals | ✓ VERIFIED | 762 tests run: 759 pass, 3 fail (pre-existing config-migrate failures, unchanged from before phase). Build succeeds. Bundle loads cleanly. |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/review/stage-review.js` | Deleted from disk | ✓ VERIFIED | `ls` confirms file does not exist |
| `bin/gsd-tools.cjs` | Rebuilt bundle without dead code | ✓ VERIFIED | 1,239,666 bytes (~1211KB), 30,073 lines. Build succeeds. |
| `src/lib/constants.js` | Cleaned constants with no stale entries | ✓ VERIFIED | COMMAND_HELP at 167 entries, CONFIG_SCHEMA at 22 keys |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| module.exports blocks | test file imports | 10 test-referenced exports preserved | ✓ WIRED | All 10 patterns found in test file: _tmpFiles (source scan), AGENT_MANIFESTS, compactPlanState, compactDepGraph, LANG_MANIFESTS, parsePlanId, computeRiskLevel, classifyTaskComplexity, parseTasksFromPlan, getTimings |
| src/lib/constants.js COMMAND_HELP | src/router.js command table | every COMMAND_HELP key must exist as router command | ✓ WIRED | Router uses namespace:subcommand dispatch + help lookup uses exact key match (line 138-139). Both colon-form and space-form entries required. Stale `profile` entry removed. |
| Cross-module exports | Consuming modules | require('./module') imports | ✓ WIRED | branchInfo/trajectoryBranch→router.js, detectCliTools/detectMcpServers/calculateTier→init.js, readCodebaseIntel/checkCodebaseIntelStaleness/spawnBackgroundAnalysis→init.js, checkBinary→research.js |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEAD-01 | 63-01 | All unused function exports identified by audit are removed from src/ modules | ✓ SATISFIED | 43 exports verified removed across 24 files. Cross-module + test-referenced exports correctly preserved. |
| DEAD-02 | 63-01 | All unreferenced workflow, template, and reference files are removed | ✗ BLOCKED | Plan 01 claimed this requirement but only deleted 1 JS source file (stage-review.js). 6 workflows, 4 templates, ~5 references remain unreferenced by any command, workflow, or agent @path import. |
| DEAD-03 | 63-02 | Constants.js audited and unused regex patterns, constants, and mappings removed | ✓ SATISFIED | 1 stale COMMAND_HELP entry removed, 4 dead CONFIG_SCHEMA keys removed. Both colon/space help forms verified necessary. |
| DEAD-04 | 63-02 | Stale config.json keys and agent manifest fields cleaned | ✓ SATISFIED | config.json verified clean. Dead schema keys removed. Snapshot updated. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found in modified files |

No TODO, FIXME, PLACEHOLDER, or stub patterns found in any of the 24 modified source files.

### Human Verification Required

#### 1. Unreferenced Workflow/Reference File Audit

**Test:** Review each unreferenced file (6 workflows, 4 templates, ~5 references) to determine if they are truly dead or used by agents at runtime via mechanisms not captured by grep.
**Expected:** Each file is either (a) confirmed dead and should be removed, or (b) confirmed in-use by an agent/feature not traceable by static analysis.
**Why human:** Some workflows (diagnose-issues.md, discovery-phase.md, research-phase.md) are soft-referenced by agent description text but not via @path imports. Runtime agent behavior can't be verified statically — an agent may load these dynamically based on user commands.

### Gaps Summary

**1 gap blocks goal achievement:**

The phase goal says "Remove all confirmed dead exports, **unreferenced files**, stale constants, and orphaned config." Success Criterion #2 (DEAD-02) explicitly requires "All unreferenced workflow, template, and reference files are removed from the project."

Neither Plan 01 nor Plan 02 addressed this scope. The Phase 62 audit focused exclusively on JS source code (knip-based export analysis + router cross-reference). No audit was performed on the 45 workflow files, 29 template files, or 15 reference files to determine which ones are orphaned.

Static analysis reveals **6 workflow files**, **4 template files**, and **~5 reference files** that have no @path import from any command, workflow, or agent definition. However, some of these may be loaded dynamically by agents at runtime, so a careful human review is needed before removal.

**Root cause:** The Phase 62 audit scoped to JS source files only. DEAD-02 requirement covers .md deployment files. The plans consumed the audit output but didn't notice the gap between audit scope and requirement scope.

**Impact:** Moderate. The files are small (~2-10KB each) and don't affect bundle size or runtime behavior. But DEAD-02 is not satisfied per its stated definition.

---

_Verified: 2026-03-07T03:57:13Z_
_Verifier: AI (gsd-verifier)_
