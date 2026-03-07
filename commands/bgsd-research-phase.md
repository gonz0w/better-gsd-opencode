---
description: Research how to implement a phase (standalone - usually use /bgsd-plan-phase instead)
---

<objective>
Research how to implement a phase. Spawns gsd-phase-researcher agent with phase context.

**Note:** This is a standalone research command. For most workflows, use `/bgsd-plan-phase` which integrates research automatically.

**Use this command when:**
- You want to research without planning yet
- You want to re-research after planning is complete
- You need to investigate before deciding if a phase is feasible

**Orchestrator role:** Parse phase, validate against roadmap, check existing research, gather context, spawn researcher agent, present results.

**Why subagent:** Research burns context fast (WebSearch, Context7 queries, source verification). Fresh 200k context for investigation. Main context stays lean for user interaction.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/get-shit-done/workflows/research-phase.md
</execution_context>

<context>
Phase number: $ARGUMENTS (required)

Normalize phase input in step 1 before any directory lookups.
</context>

<process>
Follow the workflow loaded in execution_context.
</process>
