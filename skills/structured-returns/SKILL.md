---
name: structured-returns
description: Agent-specific structured return formats for orchestrator communication. Each agent has a defined return template. Load specific sections via section attribute to get only the relevant format.
type: shared
agents: [executor, planner, verifier, debugger, github-ci, roadmapper, codebase-mapper, project-researcher, phase-researcher, plan-checker]
sections: [executor, planner, verifier, debugger, github-ci, roadmapper, codebase-mapper, project-researcher, phase-researcher, plan-checker]
---

## Purpose

Every agent communicates results back to orchestrators using structured markdown formats. These formats enable orchestrators to parse outcomes, make routing decisions, and maintain state. Each agent has its own return templates covering success, failure, and intermediate states.

Load the section for your specific agent: `<skill:structured-returns section="executor" />`

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| `{{phase}}` | Current phase identifier | `01-foundation` |
| `{{plan}}` | Current plan number | `02` |

## Content

<!-- section: executor -->
### Executor Returns

**PLAN COMPLETE** — All tasks executed successfully:

```markdown
## PLAN COMPLETE

**Plan:** {phase}-{plan}
**Tasks:** {completed}/{total}
**SUMMARY:** {path to SUMMARY.md}

**Commits:**
- {hash}: {message}
- {hash}: {message}

**Duration:** {time}
```

Include ALL commits (previous + new if continuation agent).

**CHECKPOINT REACHED** — See <skill:checkpoint-protocol section="return-format" />.

<!-- section: planner -->
### Planner Returns

**PLANNING COMPLETE** — Plans created successfully:

```markdown
## PLANNING COMPLETE

**Phase:** {phase-name}
**Plans:** {N} plan(s) in {M} wave(s)

### Wave Structure

| Wave | Plans | Autonomous |
|------|-------|------------|
| 1 | {plan-01}, {plan-02} | yes, yes |
| 2 | {plan-03} | no (has checkpoint) |

### Plans Created

| Plan | Objective | Tasks | Files |
|------|-----------|-------|-------|
| {phase}-01 | [brief] | 2 | [files] |
| {phase}-02 | [brief] | 3 | [files] |

### Next Steps

Execute: `/bgsd-execute-phase {phase}`
```

**GAP CLOSURE PLANS CREATED** — Plans for fixing verification gaps:

```markdown
## GAP CLOSURE PLANS CREATED

**Phase:** {phase-name}
**Closing:** {N} gaps from {VERIFICATION|UAT}.md

### Plans

| Plan | Gaps Addressed | Files |
|------|----------------|-------|
| {phase}-04 | [gap truths] | [files] |

### Next Steps

Execute: `/bgsd-execute-phase {phase} --gaps-only`
```

**REVISION COMPLETE** — Plans revised based on checker feedback:

```markdown
## REVISION COMPLETE

**Issues addressed:** {N}/{M}

### Changes Made

| Plan | Change | Issue Addressed |
|------|--------|-----------------|
| 16-01 | Added <verify> to Task 2 | task_completeness |

### Files Updated

- .planning/phases/16-xxx/16-01-PLAN.md
```

<!-- section: verifier -->
### Verifier Returns

**Verification Complete:**

```markdown
## Verification Complete

**Status:** {passed | gaps_found | human_needed}
**Score:** {N}/{M} must-haves verified
**Report:** .planning/phases/{phase_dir}/{phase_num}-VERIFICATION.md

{If passed:}
All must-haves verified. Phase goal achieved. Ready to proceed.

{If gaps_found:}
### Gaps Found
{N} gaps blocking goal achievement:
1. **{Truth 1}** — {reason}
   - Missing: {what needs to be added}

{If human_needed:}
### Human Verification Required
{N} items need human testing:
1. **{Test name}** — {what to do}
```

<!-- section: debugger -->
### Debugger Returns

**ROOT CAUSE FOUND** (goal: find_root_cause_only):

```markdown
## ROOT CAUSE FOUND

**Debug Session:** .planning/debug/{slug}.md
**Root Cause:** {specific cause with evidence}

**Evidence Summary:**
- {key finding 1}
- {key finding 2}

**Files Involved:**
- {file1}: {what's wrong}

**Suggested Fix Direction:** {brief hint, not implementation}
```

**DEBUG COMPLETE** (goal: find_and_fix):

```markdown
## DEBUG COMPLETE

**Debug Session:** .planning/debug/resolved/{slug}.md
**Root Cause:** {what was wrong}
**Fix Applied:** {what was changed}
**Verification:** {how verified}

**Files Changed:**
- {file1}: {change}

**Commit:** {hash}
```

**INVESTIGATION INCONCLUSIVE:**

```markdown
## INVESTIGATION INCONCLUSIVE

**Debug Session:** .planning/debug/{slug}.md

**Hypotheses Eliminated:**
- {hypothesis 1}: {why eliminated}

**Remaining Possibilities:**
- {possibility 1}

**Recommendation:** {next steps}
```

<!-- section: github-ci -->
### GitHub CI Returns

**CI COMPLETE** — All checks pass, PR merged or ready:

```markdown
## CI COMPLETE

**PR:** {PR_URL}
**Status:** {merged | checks-passed-awaiting-merge | needs-human-review}
**Checks:** {N} passed, {M} fixed, {K} dismissed (false positive)
**Iterations:** {fix_iteration_count} / {MAX_FIX_ITERATIONS}
**Merge:** {squash-merged | rebase-merged | pending | skipped}

**Timing:**
- Total duration: {total_time}
- Check wait time: {wait_time}
- Fix time: {fix_time}

**Decisions Made:**
| Decision | Type | Reasoning |
|----------|------|-----------|
| {description} | auto-fix / dismiss / escalate | {why} |

{If fixes applied:}
### Fixes Applied
| Alert | Rule | File | Fix |
|-------|------|------|-----|
| {id} | {rule_id} | {path} | {description} |
```

**CHECKPOINT REACHED** — See <skill:checkpoint-protocol section="return-format" />.

<!-- section: roadmapper -->
### Roadmapper Returns

**ROADMAP CREATED:**

```markdown
## ROADMAP CREATED

**Files written:**
- .planning/ROADMAP.md
- .planning/STATE.md

**Updated:**
- .planning/REQUIREMENTS.md (traceability section)

### Summary

**Phases:** {N}
**Coverage:** {X}/{X} requirements mapped

| Phase | Goal | Requirements |
|-------|------|--------------|
| 1 - {name} | {goal} | {req-ids} |
```

**ROADMAP REVISED:**

```markdown
## ROADMAP REVISED

**Changes made:**
- {change 1}

**Coverage:** {X}/{X} requirements mapped
```

**ROADMAP BLOCKED:**

```markdown
## ROADMAP BLOCKED

**Blocked by:** {issue}

### Options
1. {Resolution option}
```

<!-- section: codebase-mapper -->
### Codebase Mapper Returns

**Mapping Complete:**

```markdown
## Mapping Complete

**Focus:** {focus area}
**Documents written:**
- `.planning/codebase/{DOC1}.md` ({N} lines)
- `.planning/codebase/{DOC2}.md` ({N} lines)

Ready for orchestrator summary.
```

**Mapping Blocked:**

```markdown
## Mapping Blocked

**Focus:** {focus area}
**Reason:** {why mapping could not complete}
**Attempted:** {what exploration was tried}
```

<!-- section: project-researcher -->
### Project Researcher Returns

**RESEARCH COMPLETE:**

```markdown
## RESEARCH COMPLETE

**Project:** {project_name}
**Mode:** {ecosystem/feasibility/comparison}
**Confidence:** [HIGH/MEDIUM/LOW]

### Key Findings
[3-5 bullet points]

### Files Created
| File | Purpose |
|------|---------|
| .planning/research/SUMMARY.md | Executive summary |
| .planning/research/STACK.md | Technology recommendations |

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|

### Roadmap Implications
[Key recommendations for phase structure]
```

**RESEARCH BLOCKED:**

```markdown
## RESEARCH BLOCKED

**Project:** {project_name}
**Blocked by:** [what's preventing progress]
```

<!-- section: phase-researcher -->
### Phase Researcher Returns

**RESEARCH COMPLETE:**

```markdown
## RESEARCH COMPLETE

**Phase:** {phase_number} - {phase_name}
**Confidence:** [HIGH/MEDIUM/LOW]

### Key Findings
[3-5 bullet points of most important discoveries]

### File Created
`$PHASE_DIR/$PADDED_PHASE-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|

### Open Questions
[Gaps that couldn't be resolved]

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
```

**RESEARCH BLOCKED:**

```markdown
## RESEARCH BLOCKED

**Phase:** {phase_number} - {phase_name}
**Blocked by:** [what's preventing progress]
```

<!-- section: plan-checker -->
### Plan Checker Returns

**VERIFICATION PASSED:**

```markdown
## VERIFICATION PASSED

**Phase:** {phase-name}
**Plans verified:** {N}
**Status:** All checks passed

### Coverage Summary
| Requirement | Plans | Status |
|-------------|-------|--------|

### Plan Summary
| Plan | Tasks | Files | Wave | Status |
|------|-------|-------|------|--------|

Plans verified. Run `/bgsd-execute-phase {phase}` to proceed.
```

**ISSUES FOUND:**

```markdown
## ISSUES FOUND

**Phase:** {phase-name}
**Plans checked:** {N}
**Issues:** {X} blocker(s), {Y} warning(s), {Z} info

### Blockers (must fix)
**1. [{dimension}] {description}**
- Plan: {plan}
- Fix: {fix_hint}

### Recommendation
{N} blocker(s) require revision. Returning to planner with feedback.
```

## Cross-references

- <skill:commit-protocol /> — Executor returns include commit hashes
- <skill:checkpoint-protocol /> — Checkpoint returns are specialized return formats
- <skill:goal-backward /> — Verifier returns reference must-haves verification

## Examples

**Loading a specific section:**
```
<skill:structured-returns section="executor" />
```
This loads only the Executor Returns section, keeping context usage minimal.
