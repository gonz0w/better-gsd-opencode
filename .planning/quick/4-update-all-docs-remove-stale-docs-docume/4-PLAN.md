---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
  - docs/milestones.md
  - docs/decisions.md
  - docs/research.md
  - docs/architecture.md
  - docs/agents.md
  - docs/commands.md
  - docs/workflows.md
  - docs/getting-started.md
  - docs/expert-guide.md
  - docs/configuration.md
  - docs/troubleshooting.md
  - docs/planning-system.md
  - docs/tdd.md
autonomous: true
must_haves:
  truths:
    - "All docs reference 9 agents, not 11 or 12"
    - "v8.0 features (SQLite caching, namespace routing, agent consolidation, profiler, RACI, token budgets, auto changelog) are documented"
    - "milestones.md has complete v7.1 and v8.0 entries"
    - "README is compelling for testers with accurate stats and v8.0 highlights"
    - "No stale references to removed agents (gsd-integration-checker, gsd-research-synthesizer)"
    - "Node.js requirement updated to >= 22.5 where SQLite is mentioned"
    - "decisions.md Out of Scope table no longer contradicts v8.0 SQLite addition"
  artifacts:
    - path: "README.md"
      provides: "Release-ready project overview"
    - path: "docs/milestones.md"
      provides: "Complete version history through v8.0"
    - path: "docs/decisions.md"
      provides: "Updated decisions reflecting v8.0"
  key_links: []
---

<objective>
Release-readiness documentation pass for v8.0 — update all docs to reflect current state, remove stale references, document all 9 agents and 41 slash commands accurately, and make the README compelling for testers.

Purpose: The project is going to testers. Every doc must be accurate, no stale agent/command references, and the README must sell why bGSD matters.
Output: All 13 docs + README updated, v8.0 features highlighted, stale content removed.
</objective>

<execution_context>
@workflows/execute-plan.md
@templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update README.md and docs/milestones.md — the two most visible files</name>
  <files>README.md, docs/milestones.md</files>
  <action>
**README.md updates:**

1. Update stats bar from `**7 milestones shipped**` to `**8 milestones shipped**` (v1.0 through v8.0, though v7.1 was a sub-milestone, there are 8 versions total). Keep `762 tests` and `9 specialized AI agents`.

2. Update the Node.js requirement at the bottom from `>= 18` to `>= 22.5` — this is required for `node:sqlite` (v8.0 feature). Also update it in `docs/getting-started.md`.

3. Add a new section after "### Trajectory Engineering (v7.1)" for v8.0 features. Title: `### Performance & Architecture (v8.0)`. Content should highlight:

   - **SQLite Caching (L1/L2)** — Two-layer cache: in-memory Map (L1) for instant hits + SQLite via `node:sqlite` (L2) for persistent cache across CLI invocations. Graceful degradation to Map-only on Node <22.5. Zero dependencies — uses Node's built-in `DatabaseSync`.
   - **Agent Consolidation (12→9)** — Merged gsd-integration-checker into gsd-verifier, gsd-research-synthesizer into gsd-roadmapper. Fewer agents, same capabilities, less coordination overhead.
   - **Namespace Routing** — Commands organized into semantic namespaces (`init:`, `plan:`, `execute:`, `verify:`, `util:`) with colon syntax for clarity.
   - **Token Budgets** — Each agent has a declared token budget (60-80K). Context builder warns when injection approaches budget, preventing context rot.
   - **RACI Matrix** — Every lifecycle step has exactly one responsible agent. No ambiguity in agent roles.
   - **Profiler Instrumentation** — `GSD_PROFILE=1` emits timing data for file reads, git operations, markdown parsing, and AST analysis. `profiler compare` shows before/after timing deltas with color-coded regression highlighting.
   - **Auto Changelog** — `gsd-tools milestone complete` auto-generates version docs from git log and STATE.md metrics.

4. In the "Source Architecture" section, update the `src/` tree to include `profiler.js` (already there) and `cache.js` if it exists. Add comment about namespace routing to `router.js` line.

5. Keep the current structure and tone — it's already well-written.

**docs/milestones.md updates:**

1. Update v7.1 entry: Change "In Progress" to shipped. Add shipped date (2026-03-01). Update plans to 10. Add test count 762 and bundle 1050KB.

2. Add v8.0 section after v7.1. Title: `## v8.0 Performance & Architecture`. Content:
   - **Shipped:** 2026-03-03 | **Phases:** 51-55 | **Plans:** ~10
   - **Goal:** Optimize runtime performance with SQLite caching, consolidate agent system from 12 to 9, add namespace routing, profiler instrumentation, and release-readiness improvements.
   - Subsections for each phase group:
     - **Cache Foundation (Phases 51-52)**: L1/L2 caching via `node:sqlite` DatabaseSync, graceful Map fallback, hot-path command wiring, cache warm with auto-discovery, explicit invalidation on file writes
     - **Agent Consolidation (Phase 53)**: RACI matrix, merged integration-checker→verifier and research-synthesizer→roadmapper (12→9 agents), token budgets for all 9 agents (60-80K)
     - **Command Consolidation (Phase 54)**: Namespace routing (`init:`, `plan:`, `execute:`, `verify:`, `util:`), auto changelog generation
     - **Profiler & Validation (Phase 55)**: Profiler instrumentation on hot paths, profiler compare and cache-speedup commands

3. Update summary table: Add v8.0 row with phases 5, plans ~10, timeline 3 days, tests 762, bundle 1058KB. Update totals row.

4. Update the timeline section at the bottom to include v8.0.

5. Update the closing line to reflect 8 milestones shipped.

6. In the decisions.md "Intelligence as Data" section, update the cap from 12 to 9: "Hard cap at 9 agent roles" and remove the "(11 original + gsd-reviewer)" note. Also update the out-of-scope table entry for "SQLite codebase index" — it should be rewritten to note that v8.0 DID add SQLite, but for caching (not codebase indexing), and the original decision was correct for its time.
  </action>
  <verify>
    - `grep -c "12 agent" README.md docs/milestones.md` returns 0
    - `grep "Node.js >= 22.5" README.md` finds the updated requirement
    - `grep "v8.0" docs/milestones.md` finds the new section
    - `grep "gsd-integration-checker\|gsd-research-synthesizer" README.md docs/milestones.md` returns 0 matches
  </verify>
  <done>README has accurate stats, v8.0 features section, correct Node.js requirement. milestones.md has complete v7.1 and v8.0 entries with metrics.</done>
</task>

<task type="auto">
  <name>Task 2: Update all remaining docs for v8.0 accuracy and remove stale references</name>
  <files>docs/decisions.md, docs/research.md, docs/architecture.md, docs/agents.md, docs/commands.md, docs/workflows.md, docs/getting-started.md, docs/expert-guide.md, docs/configuration.md, docs/troubleshooting.md, docs/planning-system.md, docs/tdd.md</files>
  <action>
Sweep all 12 remaining docs files for accuracy. For each file, apply these corrections:

**docs/decisions.md:**
1. In "Intelligence as Data, Not Agents" section: Change "Hard cap at 12 agent roles (11 original + gsd-reviewer)" to "Hard cap at 9 agent roles (consolidated from 12 in v8.0)."
2. In Out of Scope table: Update "SQLite codebase index" row. Change description to: "SQLite for codebase indexing | v8.0 added SQLite for caching (L1/L2), validating that `node:sqlite` works; codebase indexing via SQLite remains out of scope (JSON + git suffices)"
3. Add a v8.0 Decisions section at the end of "Decisions by Milestone":

```
### v8.0 Decisions (Performance & Architecture)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `node:sqlite` (built-in DatabaseSync) over `better-sqlite3` | Preserves single-file deploy, zero native dependencies | Good — graceful fallback to Map-only on Node <22.5 |
| Agent consolidation 12→9 | DeepMind research on quadratic coordination cost; merged redundant roles | Good — same capabilities, simpler system |
| Namespace routing with colon syntax | Semantic organization (`init:`, `plan:`, `execute:`, `verify:`, `util:`) improves discoverability | Good — all 762 tests pass with namespace format |
| Token budgets per agent (60-80K) | Prevents context rot from unbounded injection | Good — context builder warns on budget exceedance |
| No backward compatibility aliases for command renames | Single user, rename and update all references | Good — clean codebase, no alias debt |
```

4. Update "Agent role explosion" in Out of Scope from ">12" to ">9": "Agent role explosion (>9) | Coordination overhead grows quadratically; intelligence = data, not agents"

**docs/research.md:**
1. In "Intelligence as Data, Not Agents" section: Change "Hard cap at 12 agent roles" to "Hard cap at 9 agent roles (consolidated from 12 in v8.0)"

**docs/architecture.md:**
1. Update any references to agent count. Currently says "10 agents" in the table — verify and update to 9 if wrong. The table already lists exactly the correct 10 rows (planner, executor, verifier, plan-checker, debugger, phase-researcher, project-researcher, roadmapper, codebase-mapper, reviewer) — that's 10 rows, but should be 9 agents. Check: reviewer IS the 10th row. Actually there are exactly 10 in that table. Count the actual 9 agents from `agents/` directory: planner, executor, verifier, reviewer, debugger, phase-researcher, project-researcher, roadmapper, codebase-mapper, plan-checker. That's 10. Wait — check agents/ dir listing: gsd-codebase-mapper, gsd-debugger, gsd-executor, gsd-phase-researcher, gsd-plan-checker, gsd-planner, gsd-project-researcher, gsd-roadmapper, gsd-verifier. That's 9 — NO gsd-reviewer file. So gsd-reviewer is referenced in docs but has NO agent definition file. Either: (a) reviewer is embedded in a workflow, not a standalone agent, or (b) it was removed. For this task: verify if `gsd-reviewer` should still be documented. If there's no `agents/gsd-reviewer.md` file, note it as a workflow-embedded review step (part of execute-plan.md), not a standalone agent. Update the architecture table to list exactly the 9 agents that have definition files. Add a note that code review is a step within the execute-plan workflow, not a separate agent spawn.

2. In the "Build" note, update bundle size from "1000KB" to "~1058KB".

3. Add a brief section about SQLite caching in the architecture overview or data flow section:
   "### Caching Layer" — Two-layer cache: L1 (in-memory Map, per-invocation) + L2 (SQLite via `node:sqlite`, persistent across invocations). Falls back gracefully to Map-only on Node <22.5. Wired into `cachedReadFile()` for hot-path commands."

4. Add `profiler.js` to lib/ description if not already there (it IS already listed).

**docs/agents.md:**
1. If gsd-reviewer has no agent definition file in `agents/`, update the document: either remove the gsd-reviewer section OR clearly note it's a workflow-embedded review step. Count should say "9 specialized AI agents" consistently.
2. Update the model profiles table — remove gsd-reviewer row if it's not a standalone agent, OR keep it and note it's embedded in the execution workflow.
3. Update all "10" agent counts to "9" if applicable.

**docs/commands.md:**
1. Header says "41" — verify this is correct (we counted 41 slash command entries). Keep as-is if correct.
2. Add `GSD_PROFILE` environment variable reference to the global flags section or at the end.
3. Add v8.0 CLI commands if not already documented: `profiler compare`, `cache warm`, `cache stats`, `cache clear`, `agent-audit` (if they exist as standalone commands). Check what v8.0 added by looking at STATE.md decisions.

**docs/configuration.md:**
1. Add `GSD_PROFILE` to Environment Variables section (it's already there — verify).
2. No other changes needed — config schema is already accurate.

**docs/getting-started.md:**
1. Update Node.js requirement from ">= 18" to ">= 22.5".
2. All other content looks current — verify agent counts say 9.

**docs/expert-guide.md:**
1. No major changes needed — already comprehensive. Verify all "9 agents" references.

**docs/troubleshooting.md:**
1. Update Node.js requirement from ">= 18" to ">= 22.5".
2. Add a performance section note about the profiler: "Enable performance profiling: `GSD_PROFILE=1 node bin/gsd-tools.cjs <command>`" — already there, verify.
3. Add a note about SQLite caching: "If SQLite caching issues occur on Node <22.5, bGSD falls back to in-memory Map cache automatically. No action needed."

**docs/workflows.md:**
1. Verify count is 45 workflows (matches directory listing). Header says correct count.
2. No stale agent references to fix — already uses correct agent names.

**docs/planning-system.md:**
1. No changes needed — already accurate.

**docs/tdd.md:**
1. No changes needed — already accurate.

**For ALL files:** Run a final sweep to ensure:
- No mention of "gsd-integration-checker" or "gsd-research-synthesizer" (deleted agents)
- No mention of "11 agents" or "12 agents" (should be 9)
- No mention of "Node.js >= 18" without noting the v8.0 SQLite requirement of >= 22.5
  </action>
  <verify>
    - `grep -rn "gsd-integration-checker\|gsd-research-synthesizer" docs/` returns 0 matches
    - `grep -rn "12 agent\|11 agent" docs/ README.md` returns 0 matches (excluding historical context in milestones/decisions where it's described as a past state)
    - `grep -rn "Node.js >= 18" docs/ README.md` returns 0 matches (should be >= 22.5 everywhere)
    - `grep -c "v8.0" docs/decisions.md` returns at least 1
  </verify>
  <done>All 12 docs files updated for v8.0 accuracy. No stale agent references. Node.js requirement correct. Agent count consistently 9 (or 10 including workflow-embedded reviewer, clearly noted).</done>
</task>

</tasks>

<verification>
- `grep -rn "gsd-integration-checker\|gsd-research-synthesizer" README.md docs/` — zero matches (stale agents purged)
- `grep -rn "12 agent" README.md docs/` — zero matches in current-state context (OK in historical "consolidated from 12" language)
- `grep "v8.0" README.md docs/milestones.md docs/decisions.md` — present in all three
- All 13 docs + README render correctly as markdown
</verification>

<success_criteria>
- README is compelling and accurate for testers, with v8.0 features highlighted
- milestones.md has complete v7.1 (shipped) and v8.0 entries
- decisions.md reflects v8.0 decisions and updated agent cap
- All docs reference exactly 9 agents (no stale 11/12 counts)
- No references to deleted agents (gsd-integration-checker, gsd-research-synthesizer)
- Node.js requirement updated to >= 22.5 across all docs
- SQLite out-of-scope contradiction resolved in decisions.md
</success_criteria>

<output>
After completion, create `.planning/quick/4-update-all-docs-remove-stale-docs-docume/4-SUMMARY.md`
</output>
