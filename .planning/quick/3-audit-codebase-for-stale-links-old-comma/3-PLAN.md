---
phase: quick-3
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/gsd-research-synthesizer.md (DELETE)
  - agents/gsd-integration-checker.md (DELETE)
  - references/model-profiles.md
  - docs/agents.md
  - docs/architecture.md
  - docs/commands.md
  - docs/expert-guide.md
  - docs/workflows.md
  - docs/milestones.md
  - README.md
  - AGENTS.md
autonomous: true
requirements: [AUDIT-01]

must_haves:
  truths:
    - "No references to gsd-research-synthesizer or gsd-integration-checker in active source files (agents/, workflows/, references/, docs/, README.md, AGENTS.md)"
    - "Agent file count in agents/ is 9 (not 11)"
    - "Version references say v8.0 where appropriate"
    - "Test count references say 762 (not 669)"
    - "All 762 tests still pass after changes"
  artifacts:
    - path: "agents/"
      provides: "9 agent files (gsd-research-synthesizer.md and gsd-integration-checker.md deleted)"
    - path: "references/model-profiles.md"
      provides: "Model profiles for 9 agents only"
    - path: "README.md"
      provides: "Accurate agent table and counts"
  key_links:
    - from: "workflows/plan-phase.md"
      to: "agents/gsd-plan-checker.md"
      via: "subagent_type reference"
      pattern: "gsd-plan-checker"
---

<objective>
Audit and clean the codebase for release readiness: remove stale agent files from Phase 53 merge, update all references to removed agents in docs/references, fix version and test count strings, and verify full test suite passes.

Purpose: The Phase 53 agent consolidation (11→9 agents) removed files from production deploy but left them in the source repo. Docs still reference removed agents. Version strings are stale (v7.0→v8.0, 669→762 tests).
Output: Clean codebase with accurate references, 9 agent files, current version/test counts.
</objective>

<execution_context>
@workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@README.md
@references/model-profiles.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete stale agent files and clean references/model-profiles</name>
  <files>agents/gsd-research-synthesizer.md, agents/gsd-integration-checker.md, references/model-profiles.md</files>
  <action>
1. Delete `agents/gsd-research-synthesizer.md` (248 lines, merged into gsd-roadmapper in Phase 53)
2. Delete `agents/gsd-integration-checker.md` (446 lines, merged into gsd-verifier in Phase 53)
3. Edit `references/model-profiles.md`: Remove the two rows for `gsd-research-synthesizer` and `gsd-integration-checker` from the model profiles table. The table should list 9 agents only.
4. Verify: `ls agents/*.md | wc -l` returns 9
5. Verify: `grep -c "gsd-research-synthesizer\|gsd-integration-checker" references/model-profiles.md` returns 0
  </action>
  <verify>
- `ls agents/*.md | wc -l` → 9
- `grep "gsd-research-synthesizer\|gsd-integration-checker" references/model-profiles.md` → no output
- `ls agents/gsd-research-synthesizer.md agents/gsd-integration-checker.md 2>&1` → "No such file"
  </verify>
  <done>Only 9 agent files exist. Model profiles reference only active agents.</done>
</task>

<task type="auto">
  <name>Task 2: Update docs and README with accurate agent info, version, and test counts</name>
  <files>docs/agents.md, docs/architecture.md, docs/commands.md, docs/expert-guide.md, docs/workflows.md, docs/milestones.md, README.md, AGENTS.md</files>
  <action>
Update each file to remove stale references. Specific changes per file:

**docs/agents.md** (4 refs):
- Remove the `#### gsd-research-synthesizer` section entirely (section + description)
- Remove the `#### gsd-integration-checker` section entirely (section + description)
- Remove their rows from any model profile tables in the file
- Add a note where appropriate that these were merged (into gsd-roadmapper and gsd-verifier respectively)

**docs/architecture.md** (2 refs):
- Remove `gsd-research-synthesizer` and `gsd-integration-checker` from the agent table
- Update any agent counts from 11 to 9

**docs/commands.md** (3 refs):
- Line mentioning "gsd-research-synthesizer" in new-milestone agents: change to just "gsd-roadmapper" (since synthesizer merged into roadmapper)
- Line mentioning "gsd-integration-checker" in audit-milestone agents: change to "gsd-verifier" (since integration-checker merged into verifier)

**docs/expert-guide.md** (1 ref):
- Change "gsd-integration-checker" reference to "gsd-verifier"

**docs/workflows.md** (2 refs):
- Change "gsd-integration-checker" reference to "gsd-verifier"
- Change "gsd-research-synthesizer" reference to "gsd-roadmapper"

**README.md** (2 refs):
- Remove `gsd-integration-checker` and `gsd-research-synthesizer` rows from agent table
- Update agent count if mentioned

**AGENTS.md** (version + test count):
- Change "v7.0" to "v8.0" (line 9 area)
- Change "669+ tests" to "762+ tests" in both occurrences (lines 28-29 area and line 48-49 area)

**docs/milestones.md** (test count):
- Change "669 tests" to "762 tests"
  </action>
  <verify>
- `grep -r "gsd-research-synthesizer\|gsd-integration-checker" docs/ README.md AGENTS.md references/` → no output
- `grep "v7\.0" AGENTS.md` → no output
- `grep "669" AGENTS.md docs/milestones.md` → no output
- `grep "762" AGENTS.md` → shows updated count
  </verify>
  <done>All active files reference only the 9 current agents. Version is v8.0. Test count is 762+.</done>
</task>

<task type="auto">
  <name>Task 3: Run full test suite and build to confirm no regressions</name>
  <files>(no files modified — validation only)</files>
  <action>
1. Run `npm run build` — confirm clean build with no errors
2. Run `npm test` — confirm all 762 tests pass with 0 failures
3. Run `grep -r "gsd-research-synthesizer\|gsd-integration-checker" agents/ workflows/ references/ docs/ README.md AGENTS.md` — confirm zero matches (comprehensive final sweep)
4. Run `ls agents/*.md | wc -l` — confirm exactly 9

If any test fails, investigate whether it's related to our changes (it shouldn't be — we only touched docs/agents/references, not source code). If unrelated test failure, note it but don't block.
  </action>
  <verify>
- `npm run build` exits 0
- `npm test` shows "pass 762, fail 0"
- Final grep returns zero matches for removed agents
  </verify>
  <done>Build passes, all 762 tests pass, zero stale references to removed agents anywhere in active codebase.</done>
</task>

</tasks>

<verification>
- `ls agents/*.md | wc -l` → 9
- `grep -r "gsd-research-synthesizer\|gsd-integration-checker" agents/ workflows/ references/ docs/ README.md AGENTS.md` → empty
- `grep "v7\.0" AGENTS.md` → empty
- `grep "669" AGENTS.md docs/milestones.md` → empty
- `npm test` → 762 pass, 0 fail
- `npm run build` → exit 0
</verification>

<success_criteria>
1. Exactly 9 agent files in agents/ (stale files deleted)
2. Zero references to gsd-research-synthesizer or gsd-integration-checker in active files
3. AGENTS.md shows v8.0 and 762+ tests
4. All 762 tests pass
5. Build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/3-audit-codebase-for-stale-links-old-comma/3-SUMMARY.md`
</output>
