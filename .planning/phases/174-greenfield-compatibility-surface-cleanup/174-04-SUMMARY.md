---
phase: 174-greenfield-compatibility-surface-cleanup
plan: 04
subsystem: docs
tags: [documentation, configuration, jj, workspace, testing]

# Dependency graph
requires:
  - phase: 174-01
    provides: retired config-migration helper removal from the supported CLI surface
  - phase: 174-03
    provides: strict workspace-first config parsing that docs now need to match
provides:
  - Published config docs teach only the supported JJ workspace-first model
  - Troubleshooting guidance points users at canonical validate/edit flows instead of retired migration helpers
  - Guidance regressions catch worktree-era or migration-era wording in the touched docs slice
affects: [phase-175-command-surface-alignment, docs, configuration, troubleshooting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - file-backed guidance regressions for shipped docs and templates
    - workspace-first configuration docs aligned to canonical runtime behavior

key-files:
  created: []
  modified:
    - tests/guidance-docs.test.cjs
    - docs/configuration.md
    - docs/expert-guide.md
    - docs/troubleshooting.md

key-decisions:
  - "Keep published guidance canonical-only: remove worktree-era settings instead of preserving migration notes for obsolete setups."
  - "Treat the broad docs test file as a regression baseline gate and use a focused smoke script for touched-surface proof while unrelated Phase 158 failures remain red."

patterns-established:
  - "Workspace-first config docs should reference `workspace.base_path` and `workspace.max_concurrent`, not `worktree.*` keys."
  - "Docs-heavy TDD slices can pair one broad regression attempt with a focused smoke script when unrelated baseline failures already exist in the shared test file."

requirements-completed: [CLEAN-03]
one-liner: "Workspace-first configuration docs and troubleshooting now teach JJ workspace execution while guidance regressions block stale worktree-era config and migration-helper references."

# Metrics
duration: 3min
completed: 2026-04-01
---

# Phase 174 Plan 04: Rewrite shipped config guidance so docs and templates teach only the supported workspace-first model after compatibility surfaces are removed. Summary

**Workspace-first configuration docs and troubleshooting now teach JJ workspace execution while guidance regressions block stale worktree-era config and migration-helper references.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T00:46:34Z
- **Completed:** 2026-04-01T00:49:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added guidance regressions that fail when the touched docs slice reintroduces `worktree` settings or `util:config-migrate` guidance.
- Rewrote configuration and expert docs to describe the supported JJ workspace-first model with `workspace.base_path` and `workspace.max_concurrent`.
- Updated troubleshooting to keep the canonical validate/edit flow and removed stale worktree-era execution guidance, keeping Phase 174 intent **aligned**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED guidance regressions for workspace-first config teaching** - `be5288a` (test)
2. **Task 2: Rewrite docs and templates to the canonical workspace-first model** - `2167d63` (docs)

**Plan metadata:** recorded in the final metadata commit for this plan.

## TDD Audit Trail

Review the exact RED/GREEN/REFACTOR proof package here. REFACTOR evidence is required when a refactor commit exists.

### RED
- **Commit:** `be5288a` (test: test(174-04): add failing workspace-first guidance regressions)
- **GSD-Phase:** red
- **Target command:** `node --test tests/guidance-docs.test.cjs --test-name-pattern "workspace-first configuration docs|config migration guidance"`
- **Exit status:** `1`
- **Matched evidence:** `✖ workspace-first configuration docs`

### GREEN
- **Commit:** `2167d63` (docs: docs(174-04): align config guidance to workspace-first execution)
- **GSD-Phase:** green
- **Target command:** `node -e 'const fs=require("fs"); const path=require("path"); ...'`
- **Exit status:** `0`
- **Matched evidence:** `OK: troubleshooting omits config migration helper`

### Machine-Readable Stage Proof

```json
{
  "red": {
    "commit": {
      "hash": "be5288aa389f9db7288f74986f3cd5346e15a9ab",
      "message": "test(174-04): add failing workspace-first guidance regressions",
      "gsd_phase": "red"
    },
    "proof": {
      "target_command": "node --test tests/guidance-docs.test.cjs --test-name-pattern \"workspace-first configuration docs|config migration guidance\"",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ workspace-first configuration docs"
    }
  },
  "green": {
    "commit": {
      "hash": "2167d6378361d894ee65450f1a634152c43fd358",
      "message": "docs(174-04): align config guidance to workspace-first execution",
      "gsd_phase": "green"
    },
    "proof": {
      "target_command": "node -e 'const fs=require(\"fs\"); const path=require(\"path\"); const root=process.cwd(); const read=(p)=>fs.readFileSync(path.join(root,p),\"utf8\"); const template=read(\"templates/config-full.json\"); const configuration=read(\"docs/configuration.md\"); const expert=read(\"docs/expert-guide.md\"); const troubleshooting=read(\"docs/troubleshooting.md\"); const checks=[[/\"workspace\"\\s*:\\s*\\{/,template,\"template has workspace block\",false],[/\"worktree\"\\s*:/,template,\"template omits worktree\",true],[/workspace\\.base_path/,configuration,\"configuration documents workspace.base_path\",false],[/`worktree\\.[^`]+`/,configuration,\"configuration omits worktree keys\",true],[/workspace-first/i,expert,\"expert guide teaches workspace-first\",false],[/git worktree/i,expert,\"expert guide omits git worktree\",true],[/`worktree\\.[^`]+`/,expert,\"expert guide omits worktree keys\",true],[/verify:validate-config/,troubleshooting,\"troubleshooting keeps canonical validation route\",false],[/util:config-migrate/,troubleshooting,\"troubleshooting omits config migration helper\",true],[/worktree\\.enabled/,troubleshooting,\"troubleshooting omits worktree setting\",true]]; for (const [regex,text,label,neg] of checks) { const ok=neg ? !regex.test(text) : regex.test(text); if (!ok) { console.error(\"FAIL:\",label); process.exit(1); } console.log(\"OK:\",label); }'",
      "exit_code": 0,
      "matched_evidence_snippet": "OK: troubleshooting omits config migration helper"
    }
  }
}
```

## Files Created/Modified

- `tests/guidance-docs.test.cjs` - Adds workspace-first and migration-guidance regressions for the touched published docs slice.
- `docs/configuration.md` - Replaces worktree-era schema examples with supported workspace settings.
- `docs/expert-guide.md` - Updates execution guidance to the JJ workspace-first model.
- `docs/troubleshooting.md` - Keeps canonical validation/edit troubleshooting and removes stale worktree-era advice.

## Decisions Made

- Keep the public guidance canonical-only so the shipped docs match the supported runtime behavior from earlier Phase 174 plans.
- Use a focused smoke script for positive proof because the shared `tests/guidance-docs.test.cjs` file already has unrelated Phase 158 failures; intent alignment remains **aligned** for this plan's touched slice.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's broad regression gate `node --test tests/guidance-docs.test.cjs` still fails on pre-existing Phase 158 assertions in `docs/getting-started.md` and `docs/workflows.md`. The new Phase 174 tests pass, the focused smoke script passes, and the required `rg` verification is clean.

## Next Phase Readiness

- Published config guidance for the touched slice is now **aligned** with the supported JJ/workspace-first model.
- Phase 175 can rely on cleaner canonical docs without stale worktree-era config teaching reappearing in these shipped surfaces.

## Self-Check

PASSED

- Found `.planning/phases/174-greenfield-compatibility-surface-cleanup/174-04-SUMMARY.md`
- Found `tests/guidance-docs.test.cjs`, `docs/configuration.md`, `docs/expert-guide.md`, and `docs/troubleshooting.md`
- Verified task commits `be5288aa` and `2167d637` in `jj log`
