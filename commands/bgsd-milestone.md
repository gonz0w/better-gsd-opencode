---
description: Group command for milestone operations - new, complete, audit, gaps
---
<objective>
Router command that delegates to specific milestone workflows based on first argument.

**Usage:**
- /bgsd milestone new → new-milestone
- /bgsd milestone complete → complete-milestone
- /bgsd milestone audit → audit-milestone
- /bgsd milestone gaps → plan-milestone-gaps
</objective>

<execution_context>
Routes to: new-milestone, complete-milestone, audit-milestone, plan-milestone-gaps
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- new → new-milestone
- complete → complete-milestone
- audit → audit-milestone
- gaps → plan-milestone-gaps

Route all arguments to the target command unchanged.
</process>
