---
description: Systematic debugging with persistent state across context resets
---

<objective>
Debug issues using scientific method with subagent isolation.

**Orchestrator role:** Gather symptoms, spawn gsd-debugger agent, handle checkpoints, spawn continuations.

**Why subagent:** Investigation burns context fast (reading files, forming hypotheses, testing). Fresh 200k context per investigation. Main context stays lean for user interaction.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/get-shit-done/workflows/debug.md
</execution_context>

<context>
User's issue: $ARGUMENTS

Check for active sessions:
```bash
ls .planning/debug/*.md 2>/dev/null | grep -v resolved | head -5
```
</context>

<process>
Follow the workflow loaded in execution_context.
</process>
