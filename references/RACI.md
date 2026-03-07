# RACI Responsibility Matrix & Handoff Contracts

**Version:** 1.0
**Created:** 2026-03-07
**Agents:** 9 (+ reviewer-agent reference, + orchestrators)

## Overview

This document defines which agent is Responsible for each lifecycle step in the GSD workflow, and documents the handoff contracts between agents at each transition point.

**Rules:**
- Each lifecycle step has exactly ONE Responsible (R) agent
- Orchestrator commands appear as Accountable (A) — they spawn the R agent
- Multiple agents can share C/I columns without triggering warnings
- "User" appears where the human is R or A (e.g., discussion decisions)

## RACI Matrix

| Step | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |
|------|----------------|-----------------|---------------|--------------|
| project-init | gsd-roadmapper | /bgsd-new-project | gsd-project-researcher | User |
| intent-capture | User | /bgsd-new-project | — | gsd-roadmapper |
| project-research | gsd-project-researcher | /bgsd-new-project | — | gsd-roadmapper |
| roadmap-creation | gsd-roadmapper | /bgsd-new-project | gsd-project-researcher | User |
| phase-discussion | User | /bgsd-discuss-phase | — | gsd-planner, gsd-phase-researcher |
| phase-research | gsd-phase-researcher | /bgsd-plan-phase | — | gsd-planner |
| plan-creation | gsd-planner | /bgsd-plan-phase | gsd-phase-researcher, gsd-codebase-mapper | User |
| plan-checking | gsd-plan-checker | /bgsd-plan-phase | gsd-planner | User |
| plan-revision | gsd-planner | /bgsd-plan-phase | gsd-plan-checker | User |
| execution-dispatch | User | /bgsd-execute-phase | — | gsd-executor |
| task-execution | gsd-executor | /bgsd-execute-phase | gsd-codebase-mapper | User |
| commit-management | gsd-executor | /bgsd-execute-phase | — | User |
| checkpoint-handling | User | /bgsd-execute-phase | gsd-executor | — |
| deviation-handling | gsd-executor | /bgsd-execute-phase | — | User |
| post-execution-review | reviewer-agent | /bgsd-execute-phase | gsd-executor | User |
| phase-verification | gsd-verifier | /bgsd-verify-work | gsd-executor | User, gsd-planner |
| milestone-audit | gsd-verifier | /bgsd-audit-milestone | — | User |
| codebase-mapping | gsd-codebase-mapper | /bgsd-map-codebase | — | gsd-planner, gsd-executor |
| debug-investigation | gsd-debugger | /bgsd-debug | User | — |
| gap-diagnosis | gsd-debugger | /bgsd-verify-work | — | gsd-planner |
| gap-closure-planning | gsd-planner | /bgsd-plan-phase --gaps | gsd-verifier, gsd-debugger | User |
| progress-reporting | gsd-executor | /bgsd-progress | — | User |
| state-management | gsd-executor | /bgsd-execute-phase | — | User |

**Total:** 23 lifecycle steps
**Agents referenced:** 9 agents + reviewer-agent + User + orchestrators
**Overlap check:** Zero dual-R assignments ✓

## Handoff Contracts

Handoff contracts define what artifact passes between agents, what file it lives in, and what required sections the receiving agent expects.

---

### 1. gsd-project-researcher → gsd-roadmapper

**Artifact:** `.planning/research/SUMMARY.md`, `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`

**Required sections in SUMMARY.md:**
- `## Executive Summary` — 3-4 paragraph synthesis
- `## Key Findings` — stack, architecture, critical pitfall one-liners
- `## Implications for Roadmap` — suggested phase structure with rationale
- `## Confidence Assessment` — per-area confidence table
- `## Gaps to Address` — unresolved research areas

**Required sections in STACK.md:**
- `## Recommended Stack` — Core, Database, Infrastructure, Supporting Libraries tables
- `## Alternatives Considered` — tradeoff table
- `## Installation` — concrete npm/pip install commands

**Required sections in FEATURES.md:**
- `## Table Stakes` — expected features table
- `## Differentiators` — value-add features table
- `## MVP Recommendation` — prioritized list

**How roadmapper consumes:** Reads research files to inform phase structure, technology decisions, and risk flags. Uses `## Implications for Roadmap` as starting input for phase identification.

---

### 2. gsd-roadmapper → gsd-planner

**Artifact:** `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`

**Required sections in ROADMAP.md:**
- `## Phases` — summary checklist (`- [ ] **Phase N: Name** - description`)
- `## Phase Details` — `### Phase N: Name` with `**Goal**`, `**Depends on**`, `**Requirements**`, `**Success Criteria**`, `**Plans**`
- `## Progress` — execution tracking table

**Required sections in REQUIREMENTS.md:**
- Requirement entries with IDs (`**REQ-ID**: description`)
- `## Traceability` — requirement-to-phase mapping table

**How planner consumes:** Reads phase goal and success criteria from ROADMAP.md `### Phase N:` detail section. Reads requirement IDs from `**Requirements:**` line. Uses success criteria to derive must_haves. Distributes requirement IDs across plan `requirements:` frontmatter fields.

---

### 3. gsd-phase-researcher → gsd-planner

**Artifact:** `.planning/phases/XX-name/{phase}-RESEARCH.md`

**Required sections:**
- `## User Constraints` (if CONTEXT.md exists) — locked decisions, discretion areas, deferred ideas copied verbatim
- `## Standard Stack` — Core and Supporting library tables with versions
- `## Architecture Patterns` — recommended structure and pattern examples
- `## Don't Hand-Roll` — problems with existing solutions table
- `## Common Pitfalls` — named pitfalls with prevention strategies
- `## Code Examples` — verified patterns from official sources
- `## Phase Requirements` (if requirement IDs provided) — ID-to-research-support mapping table

**How planner consumes:** Uses Standard Stack for library choices in task actions. Uses Architecture Patterns for file structure decisions. Uses Don't Hand-Roll to avoid custom solutions. Uses Common Pitfalls to add verification checks. Honors User Constraints as non-negotiable.

---

### 4. User → gsd-planner (via discuss-phase)

**Artifact:** `.planning/phases/XX-name/{phase}-CONTEXT.md`

**Required sections:**
- `## Implementation Decisions` — locked decisions (non-negotiable for planner)
- `## Agent's Discretion` — areas where planner/executor can choose freely
- `## Deferred Ideas` — explicitly out-of-scope items (must NOT appear in plans)

**How planner consumes:** Locked decisions become task requirements. Discretion areas allow planner judgment. Deferred ideas are scope boundaries.

---

### 5. gsd-planner → gsd-plan-checker

**Artifact:** `.planning/phases/XX-name/{phase}-{plan}-PLAN.md`

**Required frontmatter fields:**
- `phase`, `plan`, `type`, `wave`, `depends_on`, `files_modified`, `autonomous`
- `requirements` — array of requirement IDs this plan addresses (MUST NOT be empty)
- `must_haves` — object with `truths` (array), `artifacts` (array with path/provides), `key_links` (array with from/to/via/pattern)

**Required XML elements:**
- `<objective>` — what this plan accomplishes, with Purpose and Output
- `<context>` — @file references for execution context
- `<tasks>` — containing `<task type="auto|checkpoint:*">` elements
- Each `<task type="auto">` must have: `<name>`, `<files>`, `<action>`, `<verify>`, `<done>`
- `<verification>` — overall phase checks
- `<success_criteria>` — measurable completion criteria
- `<output>` — path to SUMMARY.md

**How checker consumes:** Validates across 7 dimensions: requirement_coverage, task_completeness, dependency_correctness, key_links_planned, scope_sanity, verification_derivation, context_compliance (if CONTEXT.md). Returns structured issues with severity (blocker/warning/info) and fix hints.

---

### 6. gsd-plan-checker → gsd-planner (revision loop)

**Artifact:** Structured issues (inline, passed via orchestrator)

**Required fields per issue:**
- `plan` — which plan has the issue
- `dimension` — which verification dimension failed
- `severity` — blocker | warning | info
- `description` — what's wrong
- `fix_hint` — suggested resolution

**How planner consumes (revision mode):** Groups issues by plan and dimension. Makes targeted surgical updates (not rewrites). Fixes blockers first, then warnings. Re-validates after changes.

---

### 7. gsd-planner → gsd-executor

**Artifact:** `.planning/phases/XX-name/{phase}-{plan}-PLAN.md`

**Required elements (same as contract #5):**
- Frontmatter with `phase`, `plan`, `type`, `wave`, `depends_on`, `files_modified`, `autonomous`, `requirements`, `must_haves`
- `<objective>` with Purpose and Output
- `<context>` with @file references
- `<tasks>` with typed tasks containing `<name>`, `<files>`, `<action>`, `<verify>`, `<done>`
- `<verification>` and `<success_criteria>`

**How executor consumes:** Reads plan as execution prompt. Iterates through tasks sequentially. For each auto task: implements action, runs verify, confirms done criteria, commits atomically. Applies deviation rules (1-4) for unplanned work. Creates SUMMARY.md upon completion.

---

### 8. gsd-executor → gsd-verifier

**Artifact:** `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`

**Required frontmatter fields:**
- `phase`, `plan`, `subsystem`, `tags`
- `requires` — dependency on prior phases
- `provides` — what this plan built/delivered
- `affects` — downstream phases needing this context
- `tech-stack` — added libraries and patterns established
- `key-files` — created and modified file lists
- `key-decisions` — decisions made during execution
- `duration`, `completed`

**Required sections:**
- `## Performance` — duration, timestamps, task count, file count
- `## Accomplishments` — key outcomes
- `## Task Commits` — atomic commit hashes per task
- `## Files Created/Modified` — file paths with descriptions
- `## Decisions Made` — key decisions with rationale
- `## Deviations from Plan` — auto-fixed issues or "None"
- `## Issues Encountered` — problems and resolutions
- `## Next Phase Readiness` — what's ready, blockers

**How verifier consumes:** Does NOT trust SUMMARY claims. Uses SUMMARY to identify files to verify, then checks actual codebase. Extracts must_haves from PLAN.md frontmatter. Verifies artifacts exist (3 levels: exists, substantive, wired). Checks key links. Produces VERIFICATION.md.

---

### 9. gsd-executor → reviewer-agent (post-execution review)

**Artifact:** Changed files from commits (assembled by `gsd-tools review` command)

**Required context:**
- Recent commit diffs
- Changed file list
- Convention data (from `.planning/codebase/CONVENTIONS.md`)
- Plan's `must_haves` from PLAN.md frontmatter

**How reviewer consumes:** Reviews each changed file against 4 dimensions: convention compliance, architectural fit, completeness, bundle awareness. Produces structured findings with severity (warning/info) and suggestions. Review is NON-BLOCKING — findings are informational.

---

### 10. gsd-codebase-mapper → gsd-planner / gsd-executor

**Artifact:** `.planning/codebase/*.md` (STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md)

**Required sections vary by document type:**
- STACK.md: Languages, Runtime, Frameworks, Key Dependencies, Configuration
- ARCHITECTURE.md: Pattern Overview, Layers, Data Flow, Entry Points
- STRUCTURE.md: Directory Layout, Where to Add New Code
- CONVENTIONS.md: Naming Patterns, Code Style, Import Organization
- TESTING.md: Test Framework, Test Structure, Mocking patterns
- CONCERNS.md: Tech Debt, Known Bugs, Performance Bottlenecks
- INTEGRATIONS.md: APIs & External Services, Data Storage, Auth

**How planner/executor consume:** Planner selects relevant docs by phase type (UI→CONVENTIONS+STRUCTURE, API→ARCHITECTURE+CONVENTIONS, etc.). Executor references docs for conventions, file placement, testing patterns.

---

### 11. gsd-debugger (standalone — no outgoing handoff chain)

**Artifact:** `.planning/debug/{slug}.md` → `.planning/debug/resolved/{slug}.md`

**Internal sections (no downstream consumer except user):**
- Frontmatter: `status`, `trigger`, `created`, `updated`
- `## Current Focus` — hypothesis, test, expecting, next_action
- `## Symptoms` — expected, actual, errors, reproduction
- `## Eliminated` — disproven hypotheses with evidence
- `## Evidence` — timestamped findings
- `## Resolution` — root_cause, fix, verification, files_changed

**Exception — gap diagnosis mode:** When spawned by diagnose-issues workflow, debugger output (root cause + fix direction) feeds back to gsd-planner via orchestrator for gap closure planning. The debug file itself is the handoff artifact.

---

### 12. gsd-verifier → gsd-planner (gap closure)

**Artifact:** `.planning/phases/XX-name/{phase}-VERIFICATION.md`

**Required frontmatter for gap closure:**
- `status: gaps_found`
- `gaps:` array with `truth`, `status`, `reason`, `artifacts` (path + issue), `missing` (specific items to add/fix)

**Required sections:**
- `## Goal Achievement` — Observable Truths table with status and evidence
- `## Required Artifacts` — artifact table with status
- `## Key Link Verification` — wiring status table
- `## Gaps Summary` — narrative of what's missing

**How planner consumes (--gaps mode):** Reads `gaps:` frontmatter YAML. Groups gaps by concern. Creates gap closure plans with `gap_closure: true` frontmatter. Tasks derive from `missing:` items in each gap.

---

## Agent Coverage Summary

| Agent | Lifecycle Steps (R) | Primary Inputs | Primary Outputs |
|-------|--------------------|----------------|-----------------|
| gsd-project-researcher | project-research | Research dimensions (orchestrator) | .planning/research/*.md |
| gsd-roadmapper | project-init, roadmap-creation | RESEARCH files, REQUIREMENTS.md | ROADMAP.md, STATE.md |
| gsd-phase-researcher | phase-research | Phase context (orchestrator), CONTEXT.md | {phase}-RESEARCH.md |
| gsd-planner | plan-creation, plan-revision, gap-closure-planning | RESEARCH.md, ROADMAP.md, CONTEXT.md, checker issues | PLAN.md files |
| gsd-plan-checker | plan-checking | PLAN.md files | Structured issues (inline) |
| gsd-executor | task-execution, commit-management, deviation-handling, progress-reporting, state-management | PLAN.md | SUMMARY.md, code commits |
| gsd-verifier | phase-verification, milestone-audit | SUMMARY.md, PLAN.md must_haves | VERIFICATION.md |
| gsd-codebase-mapper | codebase-mapping | Codebase files | .planning/codebase/*.md |
| gsd-debugger | debug-investigation, gap-diagnosis | Bug report (user), UAT gaps | .planning/debug/*.md |
| reviewer-agent | post-execution-review | Changed files, conventions | Review findings (inline) |
| User | intent-capture, phase-discussion, execution-dispatch, checkpoint-handling | — | CONTEXT.md, decisions |

---

*References: agents/gsd-*.md, workflows/*.md, references/reviewer-agent.md*
*Created: 2026-03-07*
